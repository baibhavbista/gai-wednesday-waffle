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

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json()); // Middleware to parse JSON bodies, needed for webhooks

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Initialize Postgres pool
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
});

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
        console.log('Processing direct audio chunk.');
        audioPathForTranscription = audioFile.path;
        tempFiles.push(audioPathForTranscription);
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
  console.log('Received webhook for full video processing.');
  // The webhook payload from Supabase Storage for a new object.
  const { name: fileName } = req.body.record;
  const waffleId = path.parse(fileName).name;

  if (!fileName || !waffleId) {
    console.error('Invalid webhook payload:', req.body);
    return res.status(400).json({ error: 'Invalid webhook payload.' });
  }

  console.log(`Starting processing for waffle ID: ${waffleId}`);
  let tempFiles = [];

  try {
    // 1. Download video from Supabase Storage
    console.log(`Downloading ${fileName} from Supabase Storage...`);
    const { data, error: downloadError } = await supabase.storage
      .from('waffles')
      .download(fileName);
    
    if (downloadError) throw downloadError;

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
    const dbClient = await pool.connect();
    try {
      const query = 'UPDATE public.waffles SET ai_transcript = $1 WHERE id = $2';
      await dbClient.query(query, [transcript.text, waffleId]);
      console.log(`Successfully updated transcript for waffle ${waffleId}.`);
    } finally {
      dbClient.release();
      console.log('Database connection released.');
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