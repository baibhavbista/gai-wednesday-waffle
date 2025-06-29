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

const test = async () => {
  let dbClient;
  let fileName="https://jmkkhtqdauxfaicnmnlm.supabase.co/storage/v1/object/sign/waffles/36a1ff43-4d4e-4455-bbf2-f2a106a5addc/1751216874296-52w67zs26.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV81MjY2MTA5ZC0wMWEzLTRjM2YtYmY0ZS01ODk2N2MwYzZjYzgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ3YWZmbGVzLzM2YTFmZjQzLTRkNGUtNDQ1NS1iYmYyLWYyYTEwNmE1YWRkYy8xNzUxMjE2ODc0Mjk2LTUydzY3enMyNi5tcDQiLCJpYXQiOjE3NTEyMTY4NzgsImV4cCI6MTc1MTgyMTY3OH0.yVTbrZYGVgqNdB3W5LfAYvBYbL44BMDttqqz8d_Bqzc";
  let transcript={text: "1243"};
  try {
    console.log('Attempting database connection...');
    dbClient = await pool.connect();
    console.log('Successfully connected to database');

    const query = `
      UPDATE public.waffles 
      SET ai_transcript = $1 
      WHERE content_url LIKE '%' || $2 || '%' 
      AND content_type = 'video' 
      RETURNING id;
      `;
    console.log('Executing query:', {
      query,
      fileName,
      transcriptLength: transcript.text.length
    });
    
    const result = await dbClient.query(query, [transcript.text, fileName]);
    
    if (result.rowCount === 0) {
      console.warn(`No waffle found with fileName ${fileName}`);
    } else {
      console.log(`Successfully updated transcript for waffle ${fileName}`);
    }
  } catch (dbError) {
    console.error('Database error details:', {
      code: dbError.code,
      errno: dbError.errno,
      syscall: dbError.syscall,
      address: dbError.address,
      port: dbError.port,
      message: dbError.message,
      stack: dbError.stack
    });
    throw dbError;
  } finally {
    if (dbClient) {
      dbClient.release();
      console.log('Database connection released');
    }
  }
}

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

    // The client will send style examples as a JSON string array.
    const styleCaptions = JSON.parse(req.body.styleCaptions || '[]');
    let tempFiles = [];
    let audioPathForTranscription;

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

      // Step 3: Generate captions with GPT-4o
      const prompt = `
        Based on the following transcript, generate 3 short, engaging captions for a social media video.
        The user wants captions in the style of these examples: "${styleCaptions.join('", "')}".
        Each caption must be 70 characters or less.
        The output must be a JSON array of strings, like this: ["caption 1", "caption 2", "caption 3"].
        Transcript: "${transcript.text}"
      `;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: prompt }],
        max_tokens: 100,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const suggestions = JSON.parse(response.choices[0].message.content);

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

    // 4. Update the database with the transcript
    console.log('Connecting to database to update transcript...');
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

      const query = `
      UPDATE public.waffles 
      SET ai_transcript = $1 
      WHERE content_url LIKE '%' || $2 || '%' 
      AND content_type = 'video' 
      RETURNING id;
      `;
      console.log('Executing query:', {
        query,
        fileName,
        transcriptLength: transcript.text.length
      });
      
      const result = await dbClient.query(query, [transcript.text, fileName]);
      
      if (result.rowCount === 0) {
        console.warn(`No waffle found with fileName ${fileName}`);
      } else {
        console.log(`Successfully updated transcript for waffles with file path ${fileName}`);
      }
    } catch (dbError) {
      console.error('Database error details:', {
        code: dbError.code,
        errno: dbError.errno,
        syscall: dbError.syscall,
        address: dbError.address,
        port: dbError.port,
        message: dbError.message,
        stack: dbError.stack
      });
      throw dbError;
    } finally {
      if (dbClient) {
        dbClient.release();
        console.log('Database connection released');
      }
    }

    console.log(`✅ Successfully finished processing for file: ${fileName}`);
    res.status(200).json({ message: 'Transcript processed and saved.' });

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

app.listen(port, () => {
  console.log(`Backend service listening on port ${port}`);

  // test();
});