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

// // Parse and validate connection string
// const validateDbUrl = (url) => {
//   try {
//     if (!url) {
//       return { isValid: false, error: 'Database URL is missing' };
//     }

//     // Basic structure check
//     if (!url.startsWith('postgresql://')) {
//       return { isValid: false, error: 'URL must start with postgresql://' };
//     }

//     // Parse URL (mask password in logs)
//     const maskedUrl = url.replace(/:([^:@]+)@/, ':****@');
//     console.log('Database URL format:', maskedUrl);

//     // Extract components
//     const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
//     if (!match) {
//       return { isValid: false, error: 'Invalid URL format' };
//     }

//     const [, user, password, host, port, database] = match;
//     const components = {
//       user,
//       host,
//       port,
//       database,
//       hasPassword: !!password
//     };

//     console.log('Connection components:', components);
//     return { isValid: true, components };
//   } catch (error) {
//     return { isValid: false, error: error.message };
//   }
// };

// const dbUrlValidation = validateDbUrl(process.env.SUPABASE_DB_URL);
// if (!dbUrlValidation.isValid) {
//   console.error('❌ Invalid database URL:', dbUrlValidation.error);
//   console.log('Expected format: postgresql://postgres:[PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres');
// } else {
//   console.log('✅ Database URL format is valid');
// }

// // Extract host from connection string
// const dbHost = dbUrlValidation.isValid ? dbUrlValidation.components.host : null;
// if (!dbHost) {
//   console.error('❌ Could not extract database host from connection string');
// }

// Create pool with explicit parameters
// const pool = new Pool({
//   // Don't use connectionString to avoid IPv6
//   host: dbHost,
//   port: dbUrlValidation.isValid ? parseInt(dbUrlValidation.components.port) : 5432,
//   database: dbUrlValidation.isValid ? dbUrlValidation.components.database : 'postgres',
//   user: dbUrlValidation.isValid ? dbUrlValidation.components.user : 'postgres',
//   password: process.env.SUPABASE_DB_PASSWORD,
//   ssl: { rejectUnauthorized: false },
//   // Force IPv4
//   family: 4,
//   // Add timeouts
//   connectionTimeoutMillis: 5000,
//   idleTimeoutMillis: 30000,
//   max: 20,
// });

// // Add error handler for pool
// pool.on('error', (err) => {
//   console.error('Unexpected error on idle client', err);
// });

let pool;
try {
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL environment variable is not set.');
  }

  // Use the URL class for robust parsing
  const dbUrl = new URL(process.env.SUPABASE_DB_URL);

  console.log('✅ Successfully parsed database URL. Connecting with these details:');
  console.log({
    host: dbUrl.hostname,
    port: dbUrl.port,
    database: dbUrl.pathname.slice(1), // removes the leading '/'
    user: dbUrl.username,
    ssl: true,
    family: 4
  });

  pool = new Pool({
    host: dbUrl.hostname,
    port: dbUrl.port,
    database: dbUrl.pathname.slice(1),
    user: dbUrl.username,
    password: dbUrl.password, // The URL parser correctly extracts the password
    ssl: { rejectUnauthorized: false }, // Keep this for Supabase
    family: 4, // Your correct requirement to force IPv4
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 20,
  });

  // Add error handler for the pool
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

} catch (error) {
    console.error('❌ Failed to initialize database pool:', error.message);
    // Exit if the database can't be configured, as the app is non-functional
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

  const waffleId = path.parse(normalizedPath).name;

  if (!normalizedPath || !waffleId) {
    console.error('Invalid webhook payload:', req.body);
    return res.status(400).json({ error: 'Invalid webhook payload.' });
  }

  console.log(`Starting processing for waffle ID: ${waffleId}`);
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
    console.log(`Full transcript for ${waffleId} received.`);

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

      const query = 'UPDATE public.waffles SET ai_transcript = $1 WHERE id = $2 RETURNING id';
      console.log('Executing query:', {
        query,
        waffleId,
        transcriptLength: transcript.text.length
      });
      
      const result = await dbClient.query(query, [transcript.text, waffleId]);
      
      if (result.rowCount === 0) {
        console.warn(`No waffle found with ID ${waffleId}`);
      } else {
        console.log(`Successfully updated transcript for waffle ${waffleId}`);
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

    console.log(`✅ Successfully finished processing for waffle ID: ${waffleId}`);
    res.status(200).json({ message: 'Transcript processed and saved.' });

  } catch (error) {
    console.error(`❌ Error processing full video for ${waffleId}:`, error);
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
});