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

const Suggestions = z.object({
  suggestions: z.array(z.string()),
});


const app = express();
const port = process.env.PORT || 3000;
app.use(express.json()); // Middleware to parse JSON bodies, needed for webhooks

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

// Endpoint for processing full video transcriptions, triggered by Supabase Storage webhook.
app.post('/process-full-video', async (req, res) => {
  console.log('Received webhook for full video processing.', req.body.record);
  // The webhook payload from Supabase Storage for a new object.
  const { name: fileName } = req.body.record;
  
  // Normalize the file path
  const normalizedPath = fileName.replace(/^\/+/, '').replace(/\/{2,}/g, '/');
  console.log('Path analysis:', {
    originalPath: fileName,
    normalizedPath,
    segments: normalizedPath.split('/'),
    extension: path.extname(fileName),
  });

  const smallFileName = path.parse(normalizedPath).name;

  if (!normalizedPath || !fileName) {
    console.error('Invalid webhook payload:', req.body);
    return res.status(400).json({ error: 'Invalid webhook payload.' });
  }

  console.log(`Starting processing for fileName: ${fileName}`);
  console.log('Full webhook payload:', JSON.stringify(req.body, null, 2));
  let tempFiles = [];

  try {
    // Verify bucket exists and is accessible
    console.log('Verifying storage bucket access...');
    const { data: bucketData, error: bucketError } = await serviceRoleClient.storage
      .getBucket('waffles');
    
    if (bucketError) {
      console.error('Bucket verification failed:', bucketError);
      throw new Error('Failed to verify storage bucket access');
    }
    console.log('Bucket verification successful:', bucketData);

    // 1. Download video from Supabase Storage (using service role client)
    console.log(`Attempting to download from Supabase Storage...`);
    console.log(`Bucket: waffles`);
    console.log(`File path: ${normalizedPath}`);
    console.log(`Using Supabase URL: ${process.env.SUPABASE_URL}`);
    console.log(`Service role key present: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
    
    const { data, error: downloadError } = await serviceRoleClient.storage
      .from('waffles')
      .download(normalizedPath);
    
    if (downloadError) {
      console.error('Supabase download error details:', {
        message: downloadError.message,
        status: downloadError?.originalError?.status,
        statusText: downloadError?.originalError?.statusText,
        responseBody: await downloadError?.originalError?.text?.(),
      });
      throw downloadError;
    }

    console.log('Download successful, data type:', typeof data);
    console.log('Data size:', data ? Buffer.from(await data.arrayBuffer()).length : 0, 'bytes');

    const videoBuffer = Buffer.from(await data.arrayBuffer());
    const tempVideoPath = tmp.tmpNameSync({ postfix: path.extname(fileName) });
    fs.writeFileSync(tempVideoPath, videoBuffer);
    tempFiles.push(tempVideoPath);
    console.log(`Successfully downloaded video to ${tempVideoPath}`);

    // 2. Extract audio with FFmpeg
    const audioPath = `${tempVideoPath}.mp3`;
    console.log(`Extracting audio to ${audioPath} using FFmpeg...`);
    await new Promise((resolve, reject) => {
      const command = `ffmpeg -i ${tempVideoPath} -vn -acodec libmp3lame -q:a 2 ${audioPath}`;
      exec(command, (error) => {
        if (error) return reject(new Error('Failed to process video with FFmpeg.'));
        tempFiles.push(audioPath);
        resolve();
      });
    });
    console.log('Successfully extracted audio.');

    // 3. Transcribe with Whisper
    console.log('Transcribing audio with Whisper...');
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
    });
    console.log(`Full transcript for ${fileName} received.`);

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
        [fileName]
      );
      const canonicalContentUrl = urlRows?.[0]?.content_url || fileName; // fall back to file name path

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
    console.log(`✅ Successfully finished processing for file: ${fileName}`);
    res.status(200).json({ message: 'Transcript processed, embedded, and saved.' });

  } catch (error) {
    console.error(`❌ Error processing full video for ${fileName}:`, error);
    res.status(500).json({ error: 'Failed to process full video.' });
  } finally {
    // 5. Cleanup all temporary files
    console.log(`Cleaning up temporary files: ${tempFiles.join(', ')}`);
    tempFiles.forEach(file => fs.unlink(file, err => {
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

    const prompt = `You are Prompt-Me-Please, an assistant that writes playful conversation starters for a small friend group.\nA user is about to record a new short video but seems unsure what to say. Using the recent snippets below, craft exactly 2 fun, engaging prompts that would inspire the user to share an update.\nBe sure to: \n• Reference any ongoing activities or plans they mentioned earlier.\n• Keep each prompt ≤100 characters.\n• Return ONLY a JSON array of two strings.\n\nRecent snippets:\n${snippets.map(s => '"' + s.replace(/"/g, '') + '"').join('\n')}`;

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

app.listen(port, () => {
  console.log(`Backend service listening on port ${port}`);
});