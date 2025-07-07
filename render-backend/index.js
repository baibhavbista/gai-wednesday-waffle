// render-backend/index.js
require('dotenv').config({ path: '.env.local' });

const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const tmp = require('tmp');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { Buffer } = require('buffer');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const { URL } = require('url'); // Use Node.js's built-in URL parser
const { zodResponseFormat } = require("openai/helpers/zod");
const { z } = require("zod");
const cors = require('cors');
const fsPromises = require('fs').promises;
const { promisify } = require('util');
const execAsync = promisify(exec);

const Suggestions = z.object({
  suggestions: z.array(z.string()),
});


const app = express();
const port = process.env.PORT || 3000;
app.use(express.json()); // Middleware to parse JSON bodies, needed for webhooks

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc)
    if (!origin) {
      console.log('[CORS] Allowing request with no origin');
      return callback(null, true);
    }
    
    // Log the origin for debugging
    console.log('[CORS] Request from origin:', origin);
    
    // Allow all origins in development
    // In production, you should restrict this to your actual domains
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('[Request Headers]:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('[Request Body]:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('[Health Check] OK');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const serviceRoleClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Initialize Postgres pool
console.log('Validating database connection string...');

let pool;
try {
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL environment variable is not set.');
  }

  // Let the 'pg' library handle the connection string directly.
  // This is more robust and correctly handles authentication protocols.
  pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: {
      rejectUnauthorized: false, // This is required for Supabase connections
    },
    // We can still add our specific overrides here
    family: 4, // Keep forcing IPv4 to prevent DNS issues
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 20,
  });

  // Add the error handler
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  console.log('✅ Database pool configured successfully.');

} catch (error) {
    console.error('❌ Failed to initialize database pool:', error.message);
    process.exit(1);
}


// Use multer for handling multipart/form-data (file uploads)
// We'll store the uploaded file in a temporary directory
const upload = multer({ dest: tmp.dirSync().name });

// Middleware to verify Supabase JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    return res.sendStatus(401); // if there isn't any token
  }

  jwt.verify(token, process.env.SUPABASE_JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403); // if the token is invalid
    }
    req.user = user;
    next();
  });
};

// The main endpoint for generating captions.
// It's protected by the authentication middleware.
// It now accepts either a 'videoChunk' or an 'audioChunk'.
app.post(
  '/generate-captions',
  authenticateToken,
  upload.fields([
    { name: 'videoChunk', maxCount: 1 },
    { name: 'audioChunk', maxCount: 1 },
  ]),
  async (req, res) => {
    const videoFile = req.files?.videoChunk?.[0];
    const audioFile = req.files?.audioChunk?.[0];

    if (!videoFile && !audioFile) {
      return res.status(400).json({ error: 'No video or audio chunk uploaded.' });
    }

    // Get group_id from request body
    const groupId = req.body.group_id || null;
    console.log('Caption generation request:', { 
      userId: req.user.sub, 
      groupId,
      hasVideo: !!videoFile,
      hasAudio: !!audioFile 
    });

    let tempFiles = [];
    let audioPathForTranscription;
    let userStyleCaptions = []; // We'll fetch these from the database

    try {
      if (audioFile) {
        // Option 1: An audio chunk was provided directly.
        console.log('Processing direct audio chunk:', {
          path: audioFile.path,
          originalname: audioFile.originalname,
          mimetype: audioFile.mimetype,
          size: audioFile.size
        });

        // Convert m4a to mp3 for better compatibility with Whisper
        const mp3Path = `${audioFile.path}.mp3`;
        await new Promise((resolve, reject) => {
          const command = `ffmpeg -i ${audioFile.path} -c:a libmp3lame -q:a 2 ${mp3Path}`;
          exec(command, (error, stdout, stderr) => {
            if (error) {
              console.error(`FFmpeg error: ${error.message}`);
              console.error('FFmpeg stderr:', stderr);
              return reject(new Error('Failed to convert audio to MP3.'));
            }
            audioPathForTranscription = mp3Path;
            tempFiles.push(mp3Path, audioFile.path);
            resolve();
          });
        });

        // Log the converted file details
        console.log('Audio converted to MP3:', {
          originalPath: audioFile.path,
          mp3Path: audioPathForTranscription
        });

      } else if (videoFile) {
        // Option 2: A video chunk was provided, extract audio.
        console.log('Processing video chunk, extracting audio.');
        const videoPath = videoFile.path;
        const extractedAudioPath = `${videoPath}.mp3`;
        tempFiles.push(videoPath);

        await new Promise((resolve, reject) => {
          const command = `ffmpeg -i ${videoPath} -vn -acodec libmp3lame -q:a 2 ${extractedAudioPath}`;
          exec(command, (error) => {
            if (error) {
              console.error(`FFmpeg error: ${error.message}`);
              return reject(new Error('Failed to process video.'));
            }
            tempFiles.push(extractedAudioPath);
            audioPathForTranscription = extractedAudioPath;
            resolve();
          });
        });
      }

      // Step 2: Transcribe audio with Whisper
      const transcript = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPathForTranscription),
        model: 'whisper-1',
      });

      console.log('Transcription:', transcript.text);

      // NEW: Step 2.5 Generate embedding for the preview transcript text
      console.log('Generating embedding for preview transcript...');
      const previewEmbeddingResp = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: transcript.text,
      });
      const previewEmbedding = previewEmbeddingResp.data[0].embedding;
      const previewEmbeddingLiteral = '[' + previewEmbedding.join(',') + ']';

      // NEW: Step 2.6 Retrieve captions from similar transcripts in DB (RAG)
      console.log('Retrieving similar captions from database...');
      let similarCaptions = [];
      let dbClient;
      try {
        dbClient = await pool.connect();
        
        // NEW: First fetch the user's last 5 captions to understand their style
        console.log('Fetching user\'s caption style...');
        let userCaptionsQuery;
        let userCaptionsParams;
        
        if (groupId) {
          // If group_id provided, get user's captions from that specific group
          userCaptionsQuery = `
            SELECT caption
            FROM public.waffles
            WHERE user_id = $1 AND group_id = $2 AND caption IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 5;
          `;
          userCaptionsParams = [req.user.sub, groupId];
          console.log('Fetching user captions from specific group:', groupId);
        } else {
          // If no group_id, get user's captions across all groups
          userCaptionsQuery = `
            SELECT caption
            FROM public.waffles
            WHERE user_id = $1 AND caption IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 5;
          `;
          userCaptionsParams = [req.user.sub];
          console.log('Fetching user captions across all groups');
        }
        
        const { rows: userCaptionRows } = await dbClient.query(userCaptionsQuery, userCaptionsParams);
        userStyleCaptions = userCaptionRows.map(r => r.caption).filter(Boolean);
        console.log('User\'s recent captions:', userStyleCaptions);
        
        // Then fetch similar captions based on embedding
        let similarQuery;
        let similarParams;
        
        if (groupId) {
          // If group_id provided, search for similar captions within that group
          similarQuery = `
            SELECT w.caption
            FROM public.transcripts t
            JOIN public.waffles w ON w.content_url = t.content_url
            WHERE w.group_id = $2 AND w.caption IS NOT NULL AND t.embedding IS NOT NULL
            ORDER BY t.embedding <=> $1::vector
            LIMIT 5;
          `;
          similarParams = [previewEmbeddingLiteral, groupId];
          console.log('Searching for similar captions within group:', groupId);
        } else {
          // If no group_id, only search within user's own waffles for privacy
          similarQuery = `
            SELECT w.caption
            FROM public.transcripts t
            JOIN public.waffles w ON w.content_url = t.content_url
            WHERE w.user_id = $2 AND w.caption IS NOT NULL AND t.embedding IS NOT NULL
            ORDER BY t.embedding <=> $1::vector
            LIMIT 5;
          `;
          similarParams = [previewEmbeddingLiteral, req.user.sub];
          console.log('Searching for similar captions within user\'s own waffles');
        }
        
        const { rows } = await dbClient.query(similarQuery, similarParams);
        similarCaptions = rows.map(r => r.caption).filter(Boolean);
        console.log('Found similar captions:', similarCaptions);
      } catch (dbErr) {
        console.error('DB error during caption lookup:', dbErr);
      } finally {
        if (dbClient) dbClient.release();
      }

      // Step 3: Generate captions with GPT-4o (now with retrieved context)
      const prompt = `
        You are Caption Genie. Using the provided live transcript and examples, reply with a JSON array containing exactly 3 creative video captions. Each caption must be 70 characters or fewer. Do not include any additional keys.

        Live transcript:\n"${transcript.text}"

        User's recent caption style:\n${userStyleCaptions.map(c => '"'+c+'"').join('\n')}

        Captions from similar past waffles:\n${similarCaptions.map(c => '"'+c+'"').join('\n')}
      `;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: prompt }],
        max_tokens: 120,
        temperature: 0.7,
        response_format: zodResponseFormat(Suggestions, 'suggestions'),
      });

      let ret = JSON.parse(response.choices[0].message.content);

      console.log("raw caption suggestions", ret);

    const suggestions = (ret.suggestions && ret.suggestions.length > 0) ? ret.suggestions : [];

      // console logs for suggestions
      console.log('Caption Suggestions:', suggestions);
      res.json({ suggestions });
    } catch (error) {
      console.error('Error in caption generation pipeline:', error);
      res.status(500).json({ error: 'An error occurred during caption generation.' });
    } finally {
      // Step 4: Cleanup all temporary files
      tempFiles.forEach((file) =>
        fs.unlink(file, (err) => {
          if (err) console.error(`Error deleting temp file ${file}:`, err);
        })
      );
    }
  }
);

/* =============================
   Helper: Extract video duration
   ============================= */

async function getVideoDuration(videoPath) {
  try {
    console.log('[Duration] Extracting duration for:', videoPath);
    
    // Use ffprobe to get video duration
    // -v error: Only show errors
    // -show_entries format=duration: Show only duration
    // -of default=noprint_wrappers=1:nokey=1: Output just the number
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
    
    const { stdout } = await execAsync(command);
    const duration = parseFloat(stdout.trim());
    
    if (isNaN(duration)) {
      throw new Error('Invalid duration extracted');
    }
    
    // Round to nearest second
    const durationSeconds = Math.round(duration);
    console.log('[Duration] Extracted duration:', durationSeconds, 'seconds');
    
    return durationSeconds;
  } catch (error) {
    console.error('[Duration] Extraction failed:', error);
    // Return a default duration if extraction fails
    return 180; // 3 minutes default
  }
}

/* =============================
   Helper: Generate video thumbnail
   ============================= */

async function generateVideoThumbnail(videoPath, outputPath) {
  try {
    console.log('[Thumbnail] Generating thumbnail for:', videoPath);
    
    // Use FFmpeg to extract a frame at 1 second (or 10% of video duration)
    // -ss 1: Seek to 1 second
    // -vframes 1: Extract 1 frame
    // -vf scale=640:-1: Scale to 640px width, maintain aspect ratio
    const command = `ffmpeg -i "${videoPath}" -ss 1 -vframes 1 -vf "scale=640:-1" -q:v 2 "${outputPath}"`;
    
    await execAsync(command);
    console.log('[Thumbnail] Generated successfully:', outputPath);
    
    return outputPath;
  } catch (error) {
    console.error('[Thumbnail] Generation failed:', error);
    
    // Fallback: Try to get the first frame
    try {
      const fallbackCommand = `ffmpeg -i "${videoPath}" -vframes 1 -vf "scale=640:-1" -q:v 2 "${outputPath}"`;
      await execAsync(fallbackCommand);
      console.log('[Thumbnail] Generated first frame as fallback');
      return outputPath;
    } catch (fallbackError) {
      console.error('[Thumbnail] Fallback also failed:', fallbackError);
      throw fallbackError;
    }
  }
}

// Endpoint for processing full video transcriptions, triggered by Supabase Storage webhook.
app.post('/process-full-video', async (req, res) => {
  console.log('[Webhook] Received video processing request');
  
  // Handle both old and new webhook payload structures
  const webhookData = req.body.record || req.body.object;
  
  if (!webhookData || !webhookData.name) {
    console.error('[Webhook] Invalid webhook data:', req.body);
    return res.status(400).json({ error: 'Invalid webhook data' });
  }

  const videoPath = webhookData.name;
  const bucketId = webhookData.bucket_id;
  console.log(`[Webhook] Processing video: ${videoPath} from bucket: ${bucketId}`);
  
  // Skip processing if this is a thumbnail or not a video file
  if (videoPath.includes('_thumb.jpg') || videoPath.includes('_thumb.png')) {
    console.log('[Webhook] Skipping thumbnail file:', videoPath);
    return res.status(200).json({ message: 'Skipped thumbnail processing' });
  }
  
  // Check if file has a video extension
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.quicktime'];
  const hasVideoExtension = videoExtensions.some(ext => videoPath.toLowerCase().endsWith(ext));
  
  if (!hasVideoExtension) {
    console.log('[Webhook] Skipping non-video file:', videoPath);
    return res.status(200).json({ message: 'Skipped non-video file' });
  }
  
  // Optional: Also check MIME type if available
  const mimeType = webhookData.metadata?.mimetype || webhookData.metadata?.contentType;
  if (mimeType && !mimeType.startsWith('video/')) {
    console.log('[Webhook] Skipping non-video MIME type:', mimeType);
    return res.status(200).json({ message: 'Skipped non-video file based on MIME type' });
  }

  let tempVideoPath = null;
  let tempAudioPath = null;
  let tempThumbnailPath = null;

  try {
    // Download video from Supabase Storage
    console.log('[Webhook] Downloading video from storage...');
    const { data: videoData, error: downloadError } = await supabase.storage
      .from(bucketId)
      .download(videoPath);
    
    if (downloadError) {
      throw new Error(`Failed to download video: ${downloadError.message}`);
    }

    // Save video to temp file
    tempVideoPath = tmp.tmpNameSync({ postfix: '.mp4' });
    const videoBuffer = Buffer.from(await videoData.arrayBuffer());
    await fsPromises.writeFile(tempVideoPath, videoBuffer);
    console.log('[Webhook] Video saved to:', tempVideoPath);

    // Extract video duration
    const videoDuration = await getVideoDuration(tempVideoPath);

    // Generate thumbnail
    tempThumbnailPath = tmp.tmpNameSync({ postfix: '.jpg' });
    await generateVideoThumbnail(tempVideoPath, tempThumbnailPath);
    
    // Upload thumbnail to Supabase Storage
    const thumbnailBuffer = await fsPromises.readFile(tempThumbnailPath);
    const thumbnailPath = videoPath.replace(/\.[^/.]+$/, '_thumb.jpg'); // Replace extension with _thumb.jpg
    
    console.log('[Webhook] Uploading thumbnail to:', thumbnailPath);
    const { error: uploadError } = await supabase.storage
      .from(bucketId)
      .upload(thumbnailPath, thumbnailBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    if (uploadError) {
      console.error('[Webhook] Failed to upload thumbnail:', uploadError);
      // Don't fail the whole process if thumbnail upload fails
    } else {
      console.log('[Webhook] Thumbnail uploaded successfully');
      
      // Get public URL for the thumbnail
      const { data: { publicUrl: thumbnailUrl } } = supabase.storage
        .from(bucketId)
        .getPublicUrl(thumbnailPath);
      
      // Update waffle record with thumbnail URL and duration
      const contentUrl = `https://${process.env.SUPABASE_URL.replace('https://', '')}/storage/v1/object/public/${bucketId}/${videoPath}`;
      
      // Try to update with both columns first
      const { error: updateError } = await supabase
        .from('waffles')
        .update({ 
          thumbnail_url: thumbnailUrl,
          duration_seconds: videoDuration
        })
        .eq('content_url', contentUrl);
      
      if (updateError) {
        console.error('[Webhook] Failed to update waffle with thumbnail and duration:', updateError);
        
        // If update fails, it might be because columns don't exist
        // Try updating without these columns so the webhook doesn't fail
        if (updateError.code === '42703') { // column does not exist
          console.warn('[Webhook] thumbnail_url or duration_seconds columns not found');
          console.warn('[Webhook] Please run the following migrations:');
          console.warn('[Webhook] - scripts/supabase/19-add-thumbnail-url.sql');
          console.warn('[Webhook] - scripts/supabase/20-add-duration-column.sql');
        }
      } else {
        console.log('[Webhook] Updated waffle with thumbnail URL and duration:', videoDuration, 'seconds');
      }
    }

    // Extract audio for transcription
    tempAudioPath = tmp.tmpNameSync({ postfix: '.mp3' });
    const audioCommand = `ffmpeg -i "${tempVideoPath}" -vn -ar 16000 -ac 1 -b:a 96k "${tempAudioPath}"`;
    
    console.log('[Webhook] Extracting audio...');
    await execAsync(audioCommand);
    console.log('[Webhook] Audio extracted to:', tempAudioPath);

    // 3. Transcribe with Whisper
    console.log('Transcribing audio with Whisper...');
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempAudioPath),
      model: 'whisper-1',
    });
    console.log(`Full transcript for ${videoPath} received.`);

    // 4. Generate embedding for the transcript text
    console.log('Generating embedding for transcript...');
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: transcript.text,
    });
    const embeddingArray = embeddingResponse.data[0].embedding;
    // Convert JS array to pgvector literal string e.g. '[0.1, 0.2, ...]'
    const embeddingVectorLiteral = '[' + embeddingArray.join(',') + ']';

    // 4.5. Generate AI recap for catch-up feature
    console.log('Generating AI recap for transcript...');
    let aiRecap = null;
    try {
      const recapResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'system',
          content: `You are a friendly assistant that creates concise summaries for friend groups. 

Create an 80-word summary of this waffle (short video update) that captures the key moments and mood. Write in a warm, conversational tone as if you're helping friends catch up on what they missed. Focus on the most interesting or meaningful parts.

Transcript: "${transcript.text}"`
        }],
        max_tokens: 120,
        temperature: 0.7,
      });
      
      aiRecap = recapResponse.choices[0]?.message?.content?.trim();
      console.log('Generated AI recap:', aiRecap);
    } catch (recapError) {
      console.error('Failed to generate AI recap:', recapError);
      // Continue without recap - it's not critical for the main flow
    }

    // 5. Upsert into transcripts table
    console.log('Upserting transcript & embedding into public.transcripts...');

    console.log('Connecting to database to save transcript...');
    console.log('Database connection details:', {
      host: pool.options.host,
      port: pool.options.port,
      database: pool.options.database,
      user: pool.options.user,
      ssl: !!pool.options.ssl,
      family: pool.options.family,
    });

    let dbClient;
    try {
      console.log('Attempting database connection...');
      dbClient = await pool.connect();
      console.log('Successfully connected to database');

      // Resolve the canonical content_url used in waffles table (full URL)
      const { rows: urlRows } = await dbClient.query(
        `SELECT content_url FROM public.waffles WHERE content_url LIKE '%' || $1 || '%' LIMIT 1`,
        [videoPath]
      );
      const canonicalContentUrl = urlRows?.[0]?.content_url || videoPath; // fall back to file name path

      const upsertQuery = `
      INSERT INTO public.transcripts (content_url, text, embedding, ai_recap)
      VALUES ($1, $2, $3::vector, $4)
      ON CONFLICT (content_url) DO UPDATE
        SET text = EXCLUDED.text,
            embedding = EXCLUDED.embedding,
            ai_recap = EXCLUDED.ai_recap,
            created_at = NOW();
      `;

      await dbClient.query(upsertQuery, [canonicalContentUrl, transcript.text, embeddingVectorLiteral, aiRecap]);

      console.log(`Successfully upserted transcript for content_url: ${canonicalContentUrl}`);
    } catch (dbError) {
      console.error('Database error details:', {
        code: dbError.code,
        errno: dbError.errno,
        syscall: dbError.syscall,
        address: dbError.address,
        port: dbError.port,
        message: dbError.message,
        stack: dbError.stack,
      });
      throw dbError;
    } finally {
      if (dbClient) {
        dbClient.release();
        console.log('Database connection released');
      }
    }

    // 6. Finish response
    console.log(`✅ Successfully finished processing for file: ${videoPath}`);
    res.status(200).json({ message: 'Transcript processed, embedded, and saved.' });

  } catch (error) {
    console.error(`❌ Error processing full video for ${videoPath}:`, error);
    res.status(500).json({ error: 'Failed to process full video.' });
  } finally {
    // 5. Cleanup all temporary files
    console.log(`Cleaning up temporary files: ${[tempVideoPath, tempAudioPath, tempThumbnailPath].join(', ')}`);
    [tempVideoPath, tempAudioPath, tempThumbnailPath].forEach(file => fs.unlink(file, err => {
      if (err) console.error(`Error deleting temp file ${file}:`, err);
    }));
    console.log('Cleanup complete.');
  }
});

/* =============================
   Prompt-Me-Please endpoint
   ============================= */

// In-memory throttle map: { `${userId}-${groupId}`: lastEpochMs }
const convoStarterThrottle = new Map();
const THROTTLE_WINDOW_MS = 30_000; // 30 seconds per user+group

app.post('/ai/convo-starter', authenticateToken, async (req, res) => {
  const { group_id: groupId, user_uid: userUid, limit_user = 3, limit_group = 5 } = req.body || {};

  console.log('\n[ConvoStarter] ⇢ Incoming request', { userUid, groupId, body: req.body });

  if (!groupId || !userUid) {
    console.warn('[ConvoStarter] ✖ Missing group_id or user_uid');
    return res.status(400).json({ error: 'Missing group_id or user_uid' });
  }

  // Simple rate-limit check
  // const throttleKey = `${userUid}-${groupId}`;
  // const now = Date.now();
  // if (convoStarterThrottle.has(throttleKey) && now - convoStarterThrottle.get(throttleKey) < THROTTLE_WINDOW_MS) {
  //   console.warn('[ConvoStarter] ✖ Rate limited for key', throttleKey);
  //   return res.status(429).json({ error: 'Too many requests – please wait a moment.' });
  // }
  // convoStarterThrottle.set(throttleKey, now);
  // console.log('[ConvoStarter] ✓ Passed throttle check');

  let dbClient;
  try {
    dbClient = await pool.connect();
    console.log('[ConvoStarter] ✓ DB connection acquired');

    // 1) Verify the caller is indeed a member of the group
    console.log('[ConvoStarter] → Verifying membership');
    const { rows: membershipRows } = await dbClient.query(
      `SELECT 1 FROM public.group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1`,
      [groupId, userUid]
    );
    if (membershipRows.length === 0) {
      console.warn('[ConvoStarter] ✖ User is NOT a member of group');
      return res.status(403).json({ error: 'User not a member of the group' });
    }
    console.log('[ConvoStarter] ✓ Membership verified');

    // 2) Fetch recent transcripts
    console.log('[ConvoStarter] → Fetching recent snippets');
    const fetchQuery = `
      WITH user_snippets AS (
        SELECT t.text
        FROM public.waffles w
        JOIN public.transcripts t ON t.content_url = w.content_url
        WHERE w.group_id = $1 AND w.user_id = $2 AND t.text IS NOT NULL
        ORDER BY w.created_at DESC
        LIMIT $3
      ),
      others_snippets AS (
        SELECT t.text
        FROM public.waffles w
        JOIN public.transcripts t ON t.content_url = w.content_url
        WHERE w.group_id = $1 AND w.user_id <> $2 AND t.text IS NOT NULL
        ORDER BY w.created_at DESC
        LIMIT $4
      )
      SELECT text FROM user_snippets
      UNION ALL
      SELECT text FROM others_snippets;`;

    const { rows } = await dbClient.query(fetchQuery, [groupId, userUid, limit_user, limit_group]);

    const userSnippetCount = Math.min(limit_user, rows.length);
    const totalSnippets = rows.length;
    console.log(`[ConvoStarter] ✓ Retrieved ${totalSnippets} snippets (${userSnippetCount} from user, ${totalSnippets - userSnippetCount} from others)`);
    rows.slice(0, 3).forEach((r, idx) => console.log(`[ConvoStarter]   • Snippet ${idx + 1}:`, r.text?.slice(0, 50)));

    if (rows.length === 0) {
      console.log('[ConvoStarter] ⚠ No snippets found, returning defaults');
      return res.status(200).json({ prompts: [
        "What's something exciting coming up for you this week?",
        'Share a quick highlight from today!'
      ]});
    }

    const snippets = rows.map(r => (r.text || '').slice(0, 120));

    const prompt = `You are Prompt-Me-Please, an assistant that writes playful conversation starters for a small friend group.\nA user is about to record a new short video but seems unsure what to say. Using the recent snippets below, craft exactly 3 fun, engaging prompts that would inspire the user to share an update.\nBe sure to: \n• Reference any ongoing activities or plans they mentioned earlier.\n• Keep each prompt ≤100 characters.\n• Return ONLY a JSON array of two strings.\n\nRecent snippets:\n${snippets.map(s => '"' + s.replace(/"/g, '') + '"').join('\n')}`;

    console.log('[ConvoStarter] → Sending prompt to GPT (first 300 chars):', prompt.slice(0, 300));

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.8,
      max_tokens: 80,
      response_format: zodResponseFormat(Suggestions, 'suggestions'),
    });


    let ret = JSON.parse(response.choices[0].message.content);
    console.log('[ConvoStarter] ✓ GPT raw raw response:', response.choices[0].message.content);
    console.log('[ConvoStarter] ✓ GPT raw response:', ret);

    const suggestions = (ret.suggestions && ret.suggestions.length > 0) ? ret.suggestions : [
      "Tell us something new you're excited about!",
      'Got any mid-week adventures to share?'
    ];

    console.log('[ConvoStarter] ✓ Returning prompts', suggestions);
    res.json({ suggestions });
  } catch (err) {
    console.error('[ConvoStarter] ✖ Pipeline error:', err);
    res.status(500).json({ error: 'Failed to generate prompts.' });
  } finally {
    if (dbClient) dbClient.release();
  }
});

/* =============================
   Search endpoint
   ============================= */

// Search configuration
const DEFAULT_SIMILARITY_THRESHOLD = 0.8; // Distance threshold (0 = identical, 2 = opposite for cosine)
const MIN_SIMILARITY_THRESHOLD = 0.3; // Don't allow searches that are too broad
const MAX_SIMILARITY_THRESHOLD = 1.5; // Don't allow searches that are too restrictive

// Simple in-memory cache for query embeddings
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clean up old cache entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      searchCache.delete(key);
    }
  }
}, 60 * 1000);

// Helper: Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Helper: Parse temporal queries
function parseTemporalQuery(query) {
  const patterns = {
    'last week': { days: 7 },
    'yesterday': { days: 1 },
    'this week': { days: 7 },
    'this month': { days: 30 },
    'last month': { days: 60, offset: 30 }
  };
  
  let cleanQuery = query;
  let dateFilter = null;
  
  for (const [pattern, range] of Object.entries(patterns)) {
    if (query.toLowerCase().includes(pattern)) {
      cleanQuery = query.replace(new RegExp(pattern, 'gi'), '').trim();
      
      const endDate = new Date();
      if (range.offset) {
        endDate.setDate(endDate.getDate() - range.offset);
      }
      
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - range.days);
      
      dateFilter = { start: startDate, end: endDate };
      break;
    }
  }
  
  return { cleanQuery, dateFilter };
}

// Helper: Find match positions in transcript
async function findMatchPositions(transcript, queryEmbedding, searchQuery) {
  try {
    // Simple approach: Look for keywords from the search query
    const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const transcriptLower = transcript.toLowerCase();
    
    const matches = [];
    
    // Find positions of query words in transcript
    for (const word of queryWords) {
      let position = transcriptLower.indexOf(word);
      while (position !== -1) {
        // Find sentence boundaries around this match
        let sentenceStart = position;
        let sentenceEnd = position + word.length;
        
        // Expand to sentence boundaries
        while (sentenceStart > 0 && !'.!?'.includes(transcript[sentenceStart - 1])) {
          sentenceStart--;
        }
        while (sentenceEnd < transcript.length && !'.!?'.includes(transcript[sentenceEnd])) {
          sentenceEnd++;
        }
        
        matches.push({
          position: sentenceStart,
          length: sentenceEnd - sentenceStart,
          timestamp: Math.floor((position / transcript.length) * 180) // Still rough estimate
        });
        
        // Look for next occurrence
        position = transcriptLower.indexOf(word, position + 1);
      }
    }
    
    // Remove duplicates and sort by position
    const uniqueMatches = matches
      .filter((match, index, self) => 
        index === self.findIndex(m => m.position === match.position)
      )
      .sort((a, b) => a.position - b.position)
      .slice(0, 3);
    
    // If no keyword matches found, return beginning of transcript
    if (uniqueMatches.length === 0) {
      return [{
        position: 0,
        length: Math.min(200, transcript.length),
        timestamp: 0
      }];
    }
    
    return uniqueMatches;
  } catch (error) {
    console.error('Error finding match positions:', error);
    // Return a default match at the beginning
    return [{
      position: 0,
      length: Math.min(100, transcript.length),
      timestamp: 0
    }];
  }
}

// Main search endpoint
app.post('/api/search/waffles', authenticateToken, async (req, res) => {
  console.log('[Search] ==================== NEW SEARCH REQUEST ====================');
  console.log('[Search] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[Search] User from token:', req.user);
  
  const { 
    query, 
    filters = {}, 
    limit = 10, 
    offset = 0,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD  // Default threshold, can be overridden by client
  } = req.body;
  
  console.log('[Search] Request body:', JSON.stringify({ query, filters, limit, offset, similarityThreshold }, null, 2));
  
  // Validate request
  if (!query || query.trim().length < 2) {
    console.log('[Search] Invalid query - too short:', query);
    return res.status(400).json({ 
      error: 'Query must be at least 2 characters' 
    });
  }
  
  // Validate and clamp similarity threshold
  const validThreshold = Math.max(
    MIN_SIMILARITY_THRESHOLD, 
    Math.min(MAX_SIMILARITY_THRESHOLD, similarityThreshold)
  );
  if (validThreshold !== similarityThreshold) {
    console.log(`[Search] Adjusted similarity threshold from ${similarityThreshold} to ${validThreshold}`);
  }
  
  const userId = req.user.sub;
  console.log('[Search] User ID from token:', userId);
  
  let dbClient;
  
  try {
    // Parse temporal queries
    const { cleanQuery, dateFilter } = parseTemporalQuery(query);
    console.log('[Search] Parsed query:', { cleanQuery, dateFilter });
    
    // Check cache for embedding
    const cacheKey = `embed:${cleanQuery}`;
    let queryEmbedding;
    
    if (searchCache.has(cacheKey)) {
      queryEmbedding = searchCache.get(cacheKey).embedding;
      console.log('[Search] Using cached embedding for query:', cleanQuery);
    } else {
      // Generate embedding for search query
      console.log('[Search] Generating new embedding for query:', cleanQuery);
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: cleanQuery,
        });
        
        queryEmbedding = embeddingResponse.data[0].embedding;
        console.log('[Search] Successfully generated embedding, length:', queryEmbedding.length);
        
        searchCache.set(cacheKey, {
          embedding: queryEmbedding,
          timestamp: Date.now()
        });
      } catch (openaiError) {
        console.error('[Search] OpenAI embedding error:', openaiError);
        throw new Error('Failed to generate search embedding');
      }
    }
    
    // Convert embedding to pgvector format
    const embeddingLiteral = '[' + queryEmbedding.join(',') + ']';
    console.log('[Search] Embedding literal length:', embeddingLiteral.length);
    
    // Connect to database
    console.log('[Search] Connecting to database...');
    dbClient = await pool.connect();
    console.log('[Search] Database connected');
    
    // // Diagnostic: Check what columns exist in waffles table
    // try {
    //   const { rows: columnCheck } = await dbClient.query(`
    //     SELECT column_name 
    //     FROM information_schema.columns 
    //     WHERE table_schema = 'public' 
    //     AND table_name = 'waffles' 
    //     AND column_name IN ('thumbnail_url', 'duration_seconds')
    //   `);
    //   console.log('[Search] Available columns in waffles table:', columnCheck.map(r => r.column_name));
      
    //   if (columnCheck.length === 0) {
    //     console.warn('[Search] WARNING: thumbnail_url and duration_seconds columns NOT FOUND in waffles table!');
    //     console.warn('[Search] This suggests the migration was not run on this database.');
    //   }
    // } catch (diagError) {
    //   console.error('[Search] Diagnostic query failed:', diagError);
    // }
    
    // Build filters
    const filterConditions = [];
    const params = [userId, embeddingLiteral, limit, offset, validThreshold];
    let paramIndex = 6;
    
    console.log('[Search] Building filters...');
    
    if (filters.groupIds?.length > 0) {
      filterConditions.push(`w.group_id = ANY($${paramIndex})`);
      params.push(filters.groupIds);
      console.log('[Search] Added group filter:', filters.groupIds);
      paramIndex++;
    }
    
    if (filters.userIds?.length > 0) {
      filterConditions.push(`w.user_id = ANY($${paramIndex})`);
      params.push(filters.userIds);
      console.log('[Search] Added user filter:', filters.userIds);
      paramIndex++;
    }
    
    if (dateFilter || filters.dateRange) {
      const range = dateFilter || filters.dateRange;
      if (range.start) {
        filterConditions.push(`w.created_at >= $${paramIndex}`);
        params.push(range.start);
        console.log('[Search] Added start date filter:', range.start);
        paramIndex++;
      }
      if (range.end) {
        filterConditions.push(`w.created_at <= $${paramIndex}`);
        params.push(range.end);
        console.log('[Search] Added end date filter:', range.end);
        paramIndex++;
      }
    }
    
    if (filters.mediaType && filters.mediaType !== 'all') {
      filterConditions.push(`w.content_type = $${paramIndex}`);
      params.push(filters.mediaType);
      console.log('[Search] Added media type filter:', filters.mediaType);
      paramIndex++;
    }
    
    const whereClause = filterConditions.length > 0 
      ? 'AND ' + filterConditions.join(' AND ')
      : '';
    
    // Search query with filters and permissions
    const searchQuery = `
      WITH filtered_waffles AS (
        SELECT DISTINCT w.id, w.content_url, w.user_id, w.group_id, 
               w.caption, w.created_at, w.content_type
        FROM public.waffles w
        JOIN public.group_members gm ON gm.group_id = w.group_id
        WHERE gm.user_id = $1
          ${whereClause}
      ),
      ranked_results AS (
        SELECT 
          t.content_url,
          t.text as transcript,
          t.embedding <=> $2::vector as distance,
          w.id,
          w.user_id,
          w.group_id,
          w.content_url,
          w.content_type,
          w.caption,
          w.created_at,
          NULL::text as thumbnail_url,
          NULL::integer as duration_seconds,
          p.name as user_name,
          p.avatar_url as user_avatar,
          g.name as group_name
        FROM public.transcripts t
        JOIN filtered_waffles w ON w.content_url = t.content_url
        JOIN public.profiles p ON p.id = w.user_id
        JOIN public.groups g ON g.id = w.group_id
        WHERE t.embedding IS NOT NULL
          AND t.text IS NOT NULL
          AND t.embedding <=> $2::vector < $5  -- Only return results with distance < threshold
        ORDER BY distance
        LIMIT $3 OFFSET $4
      )
      SELECT * FROM ranked_results;
    `;
    
    console.log('[Search] Executing search query with params:', params.map((p, i) => `$${i + 1}: ${typeof p === 'string' && p.length > 50 ? p.substring(0, 50) + '...' : p}`));
    
    let results;
    try {
      const queryResult = await dbClient.query(searchQuery, params);
      results = queryResult.rows;
      console.log(`[Search] Query executed successfully, found ${results.length} results`);
      console.log(`[Search] Using similarity threshold: ${validThreshold}`);
      
      if (results.length > 0) {
        console.log('[Search] First result sample:', {
          id: results[0].id,
          user_name: results[0].user_name,
          group_name: results[0].group_name,
          distance: results[0].distance,
        });
        
        // Log distance distribution
        const distances = results.map(r => r.distance);
        console.log('[Search] Distance distribution:', {
          min: Math.min(...distances),
          max: Math.max(...distances),
          avg: distances.reduce((a, b) => a + b, 0) / distances.length,
        });
      }
    } catch (queryError) {
      console.error('[Search] Database query error:', queryError);
      console.error('[Search] Query error details:', {
        message: queryError.message,
        code: queryError.code,
        detail: queryError.detail,
      });
      throw new Error('Database search failed');
    }
    
    // Get total count for pagination - rebuild filter conditions with new param indices
    const countFilterConditions = [];
    const countParams = [userId, embeddingLiteral, validThreshold];
    let countParamIndex = 4;
    
    if (filters.groupIds?.length > 0) {
      countFilterConditions.push(`w.group_id = ANY($${countParamIndex})`);
      countParams.push(filters.groupIds);
      countParamIndex++;
    }
    
    if (filters.userIds?.length > 0) {
      countFilterConditions.push(`w.user_id = ANY($${countParamIndex})`);
      countParams.push(filters.userIds);
      countParamIndex++;
    }
    
    if (dateFilter || filters.dateRange) {
      const range = dateFilter || filters.dateRange;
      if (range.start) {
        countFilterConditions.push(`w.created_at >= $${countParamIndex}`);
        countParams.push(range.start);
        countParamIndex++;
      }
      if (range.end) {
        countFilterConditions.push(`w.created_at <= $${countParamIndex}`);
        countParams.push(range.end);
        countParamIndex++;
      }
    }
    
    if (filters.mediaType && filters.mediaType !== 'all') {
      countFilterConditions.push(`w.content_type = $${countParamIndex}`);
      countParams.push(filters.mediaType);
      countParamIndex++;
    }
    
    const countWhereClause = countFilterConditions.length > 0 
      ? 'AND ' + countFilterConditions.join(' AND ')
      : '';
    
    const countQuery = `
      SELECT COUNT(DISTINCT w.id) as total
      FROM public.waffles w
      JOIN public.group_members gm ON gm.group_id = w.group_id
      JOIN public.transcripts t ON t.content_url = w.content_url
      WHERE gm.user_id = $1
        AND t.embedding IS NOT NULL
        AND t.embedding <=> $2::vector < $3  -- Match the threshold from main query
        ${countWhereClause}
    `;
    
    console.log('[Search] Executing count query with params:', countParams.map((p, i) => `$${i + 1}: ${typeof p === 'string' && p.length > 50 ? p.substring(0, 50) + '...' : p}`));
    
    let totalCount = 0;
    try {
      const { rows: countResult } = await dbClient.query(countQuery, countParams);
      totalCount = parseInt(countResult[0].total);
      console.log('[Search] Total count:', totalCount);
    } catch (countError) {
      console.error('[Search] Count query error:', countError);
      // Don't fail the whole search if count fails
      totalCount = results.length;
    }
    
    // Enhance results with match positions
    const enhancedResults = await Promise.all(
      results.map(async (result) => {
        // Use actual thumbnail URL from database, fall back to placeholder
        const thumbnailUrl = result.thumbnail_url ?? `https://picsum.photos/seed/${result.id}/400/240`;
        
        // Use actual duration from database, fall back to default
        const videoDuration = result.duration_seconds ?? 180; // Default 3 minutes if not set
        
        return {
          id: result.id,
          userId: result.user_id,
          userName: result.user_name,
          userAvatar: result.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(result.user_name)}`,
          groupName: result.group_name,
          groupId: result.group_id,
          videoUrl: result.content_url,
          thumbnailUrl,
          transcript: result.transcript,
          videoDuration,
          createdAt: result.created_at,
          // Simplified - no match positions
        };
      })
    );
    
    // Generate search suggestions (simple implementation)
    const suggestions = [];
    if (results.length > 0) {
      // Suggest searches based on groups in results
      const uniqueGroups = [...new Set(results.map(r => r.group_name))];
      suggestions.push(...uniqueGroups.map(g => `${cleanQuery} in ${g}`));
    }
    
    // Log search to history
    try {
      await dbClient.query(
        `INSERT INTO public.search_history (user_id, query, results_count, filters)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [userId, query, results.length, JSON.stringify(filters)]
      );
    } catch (err) {
      console.error('[Search] Failed to log search history:', err);
    }
    
    console.log('[Search] Sending immediate response with', enhancedResults.length, 'results');
    
    // Generate a unique search ID
    const searchId = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // If no results due to threshold, include that info
    const processingStatus = enhancedResults.length === 0 && totalCount === 0 
      ? 'no_relevant_results' 
      : 'complete';
    
    // Send immediate response with a pending AI answer
    res.json({
      results: enhancedResults,
      totalCount,
      suggestions: suggestions.slice(0, 3),
      processingStatus,
      searchId, // Include search ID for SSE connection
              aiAnswer: {
          status: 'pending',
          text: null
        },
        similarityThreshold: validThreshold // Include threshold in response for transparency
      });
    
    // Register AI answer task
    const taskKey = `${userId}:${searchId}`;
    aiAnswerTasks.set(taskKey, {
      status: 'pending',
      clients: [],
      query,
      results,
    });
    
    // Generate AI answer asynchronously
    if (results.length > 0) {
      generateAIAnswerSSE(query, results, userId, searchId)
        .catch(err => console.error('[Search] Failed to generate AI answer:', err));
    }
    
  } catch (error) {
    console.error('[Search] ==================== SEARCH ERROR ====================');
    console.error('[Search] Error:', error);
    console.error('[Search] Error stack:', error.stack);
    console.error('[Search] Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    
    res.status(500).json({ 
      error: 'Search failed. Please try again.',
      details: error.message 
    });
  } finally {
    if (dbClient) {
      dbClient.release();
      console.log('[Search] Database connection released');
    }
    console.log('[Search] ==================== END SEARCH REQUEST ====================');
  }
});

app.listen(port, () => {
  console.log(`Backend service listening on port ${port}`);
});

/* =============================
   Catch Up endpoint
   ============================= */

// Cache for catch-up summaries
const catchUpCache = new Map();
const CATCHUP_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours
const CATCHUP_RATE_LIMIT = 5 * 60 * 1000; // 5 minutes

// Clean up old cache entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of catchUpCache.entries()) {
    if (now - value.timestamp > CATCHUP_CACHE_TTL) {
      catchUpCache.delete(key);
    }
  }
}, 60 * 60 * 1000);

app.get('/api/catchup/:groupId', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  const { days = 10 } = req.query;
  const userId = req.user.sub;
  
  console.log(`[CatchUp] Request for group ${groupId}, user ${userId}, days: ${days}`);
  
  // Validate days parameter
  const validDays = Math.min(Math.max(parseInt(days) || 10, 1), 30); // Between 1 and 30 days
  
  let dbClient;
  
  try {
    // Check cache first
    const cacheKey = `catchup:${groupId}:${validDays}`;
    const cached = catchUpCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CATCHUP_CACHE_TTL) {
      console.log('[CatchUp] Returning cached summary');
      return res.json({ 
        summary: cached.summary,
        cached: true,
        waffleCount: cached.waffleCount,
        days: validDays
      });
    }
    
    // Connect to database
    dbClient = await pool.connect();
    
    // Verify user is member of the group
    const { rows: memberCheck } = await dbClient.query(
      'SELECT 1 FROM public.group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1',
      [groupId, userId]
    );
    
    if (memberCheck.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }
    
    // Fetch waffles from the last N days with transcripts
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - validDays);
    
    const wafflesQuery = `
      SELECT 
        w.id,
        w.caption,
        w.created_at,
        w.content_type,
        p.name as user_name,
        t.text as transcript_text,
        t.ai_recap
      FROM public.waffles w
      JOIN public.profiles p ON p.id = w.user_id
      LEFT JOIN public.transcripts t ON t.content_url = w.content_url
      WHERE w.group_id = $1 
        AND w.created_at >= $2
      ORDER BY w.created_at ASC
      LIMIT 50;
    `;
    
    const { rows: waffles } = await dbClient.query(wafflesQuery, [groupId, cutoffDate]);
    
    console.log(`[CatchUp] Found ${waffles.length} waffles in the last ${validDays} days`);
    
    if (waffles.length === 0) {
      const emptySummary = `No activity in the last ${validDays} days. Time to share something new!`;
      
      // Cache the empty result
      catchUpCache.set(cacheKey, {
        summary: emptySummary,
        timestamp: Date.now(),
        waffleCount: 0
      });
      
      return res.json({ 
        summary: emptySummary,
        cached: false,
        waffleCount: 0,
        days: validDays
      });
    }
    
    // Format waffles for LLM - choose shortest content
    const formattedEntries = waffles.map(waffle => {
      // Determine the shortest available content
      const contents = [
        { type: 'caption', text: waffle.caption, length: waffle.caption?.length || Infinity },
        { type: 'ai_recap', text: waffle.ai_recap, length: waffle.ai_recap?.length || Infinity },
        { type: 'transcript', text: waffle.transcript_text, length: waffle.transcript_text?.length || Infinity }
      ].filter(c => c.text); // Only consider non-null content
      
      // Sort by length and pick the shortest
      contents.sort((a, b) => a.length - b.length);
      const selectedContent = contents[0];
      
      if (!selectedContent) {
        return null; // Skip if no content available
      }
      
      // Format timestamp
      const timestamp = new Date(waffle.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      // Truncate content if too long
      const maxLength = 200;
      let content = selectedContent.text;
      if (content.length > maxLength) {
        content = content.substring(0, maxLength) + '...';
      }
      
      return `[${timestamp}] ${waffle.user_name} > ${content}`;
    }).filter(Boolean); // Remove any null entries
    
    console.log(`[CatchUp] Formatted ${formattedEntries.length} entries for LLM`);
    
    // Create prompt for GPT-4o
    const prompt = `You are a friendly assistant helping someone catch up on their friend group's activity. 
    
Based on the following video updates (waffles) from the last ${validDays} days, create a warm, conversational summary that helps them feel connected to what they've missed.

Write a summary that's about 4-6 sentences (or 1-2 short paragraphs). Include:
- Who's been most active and what they've been sharing
- Key moments, activities, or themes from the week
- Any particularly interesting or memorable updates
- The overall mood and energy of the group
- Specific details that make it feel personal (mention names, activities, etc.)

Make it conversational, like a friend filling them in on what they missed. Use names frequently and reference specific moments when possible.

Waffles:
${formattedEntries.join('\n')}

Write a friendly, detailed catch-up summary:`;

    console.log('[CatchUp] Sending to GPT-4o for summarization');
    
    // Generate summary with GPT-4o
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });
    
    const summary = completion.choices[0]?.message?.content?.trim() || 'Unable to generate summary';
    
    console.log('[CatchUp] Generated summary:', summary);
    
    // Cache the result
    catchUpCache.set(cacheKey, {
      summary,
      timestamp: Date.now(),
      waffleCount: waffles.length
    });
    
    // Return the summary
    res.json({ 
      summary,
      cached: false,
      waffleCount: waffles.length,
      days: validDays
    });
    
  } catch (error) {
    console.error('[CatchUp] Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate catch-up summary',
      details: error.message 
    });
  } finally {
    if (dbClient) {
      dbClient.release();
    }
  }
});

/* =============================
   SSE for AI Answers
   ============================= */

// Store active AI generation tasks
const aiAnswerTasks = new Map();

// SSE endpoint for streaming AI answers
app.get('/api/search/ai-stream/:searchId', authenticateToken, (req, res) => {
  const { searchId } = req.params;
  const userId = req.user.sub;
  
  console.log(`[SSE] Client connected for search ${searchId}`);
  
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ status: 'connected' })}\n\n`);
  
  // Check if we have a task for this search
  const taskKey = `${userId}:${searchId}`;
  const task = aiAnswerTasks.get(taskKey);
  
  if (task) {
    if (task.status === 'complete') {
      // Send the answer immediately if already generated
      res.write(`data: ${JSON.stringify({ 
        status: 'complete', 
        text: task.answer 
      })}\n\n`);
      res.end();
      aiAnswerTasks.delete(taskKey);
    } else {
      // Wait for the answer to be generated
      task.clients.push(res);
    }
  } else {
    // No task found - might be an error
    res.write(`data: ${JSON.stringify({ 
      status: 'error', 
      text: 'Search not found' 
    })}\n\n`);
    res.end();
  }
  
  // Clean up on client disconnect
  req.on('close', () => {
    console.log(`[SSE] Client disconnected for search ${searchId}`);
    if (task && task.clients) {
      task.clients = task.clients.filter(client => client !== res);
    }
  });
});

/* =============================
   AI Answer Generation with SSE
   ============================= */

async function generateAIAnswerSSE(query, searchResults, userId, searchId) {
  console.log('[AI Answer] Starting generation for query:', query);
  
  const taskKey = `${userId}:${searchId}`;
  const task = aiAnswerTasks.get(taskKey);
  
  if (!task) {
    console.error('[AI Answer] Task not found for:', taskKey);
    return;
  }
  
  try {
    // Prepare context from top results
    const topResults = searchResults.slice(0, 5);
    const context = topResults.map((result, idx) => 
      `Video ${idx + 1} (${result.user_name}, ${new Date(result.created_at).toLocaleDateString()}): "${result.transcript.slice(0, 500)}..."`
    ).join('\n\n');
    
    // Create prompt
    const prompt = `You are a helpful AI assistant analyzing video transcripts from a private friend group. Based on the following video transcripts, provide a concise, friendly answer to the user's search query.

Search Query: "${query}"

Video Transcripts:
${context}

Instructions:
- Synthesize information across all relevant videos
- Be conversational and friendly (this is for a friend group app)
- Keep the answer concise (2-3 sentences max)
- Reference specific people or videos when relevant
- If the videos don't contain relevant information, say so politely`;

    console.log('[AI Answer] Sending to GPT-4o with streaming...');
    
    // Use streaming for progressive updates
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.7,
      max_tokens: 150,
      stream: true,
    });
    
    let fullAnswer = '';
    
    // Process stream chunks
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullAnswer += content;
        
        // Send update to all connected clients
        task.clients.forEach(client => {
          try {
            client.write(`data: ${JSON.stringify({ 
              status: 'streaming', 
              text: fullAnswer 
            })}\n\n`);
          } catch (err) {
            console.error('[SSE] Failed to send to client:', err);
          }
        });
      }
    }
    
    console.log('[AI Answer] Generation complete:', fullAnswer);
    
    // Send final answer to all clients
    task.clients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify({ 
          status: 'complete', 
          text: fullAnswer 
        })}\n\n`);
        client.end();
      } catch (err) {
        console.error('[SSE] Failed to send final answer:', err);
      }
    });
    
    // Update task status
    task.status = 'complete';
    task.answer = fullAnswer;
    
    // Clean up after 5 minutes
    setTimeout(() => {
      aiAnswerTasks.delete(taskKey);
    }, 5 * 60 * 1000);
    
  } catch (error) {
    console.error('[AI Answer] Generation failed:', error);
    
    // Notify clients of error
    task.clients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify({ 
          status: 'error', 
          text: 'Failed to generate AI summary' 
        })}\n\n`);
        client.end();
      } catch (err) {
        console.error('[SSE] Failed to send error:', err);
      }
    });
    
    aiAnswerTasks.delete(taskKey);
  }
}