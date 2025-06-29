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
// 'videoChunk' should match the field name used in the client-side form data.
app.post('/generate-captions', authenticateToken, upload.single('videoChunk'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video chunk uploaded.' });
  }

  const videoPath = req.file.path;
  const audioPath = `${videoPath}.mp3`;
  // The client will send style examples as a JSON string array.
  const styleCaptions = JSON.parse(req.body.styleCaptions || '[]');

  let tempFiles = [videoPath];

  try {
    // Step 1: Extract audio with FFmpeg
    await new Promise((resolve, reject) => {
      const command = `ffmpeg -i ${videoPath} -vn -acodec libmp3lame -q:a 2 ${audioPath}`;
      exec(command, (error) => {
        if (error) {
          console.error(`FFmpeg error: ${error.message}`);
          return reject(new Error('Failed to process video.'));
        }
        tempFiles.push(audioPath);
        resolve();
      });
    });

    // Step 2: Transcribe audio with Whisper
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
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
      response_format: { type: "json_object" },
    });

    const suggestions = JSON.parse(response.choices[0].message.content);
    res.json({ suggestions });

  } catch (error) {
    console.error('Error in caption generation pipeline:', error);
    res.status(500).json({ error: 'An error occurred during caption generation.' });
  } finally {
    // Step 4: Cleanup all temporary files
    tempFiles.forEach(file => fs.unlink(file, err => {
      if (err) console.error(`Error deleting temp file ${file}:`, err);
    }));
  }
});

// Endpoint for processing full video transcriptions, triggered by Supabase Storage webhook.
app.post('/process-full-video', async (req, res) => {
  // The webhook payload from Supabase Storage for a new object.
  const { name: fileName } = req.body.record;
  const waffleId = path.parse(fileName).name;

  if (!fileName || !waffleId) {
    return res.status(400).json({ error: 'Invalid webhook payload.' });
  }

  let tempFiles = [];

  try {
    // 1. Download video from Supabase Storage
    const { data, error: downloadError } = await supabase.storage
      .from('waffles')
      .download(fileName);
    
    if (downloadError) throw downloadError;

    const videoBuffer = Buffer.from(await data.arrayBuffer());
    const tempVideoPath = tmp.tmpNameSync({ postfix: path.extname(fileName) });
    fs.writeFileSync(tempVideoPath, videoBuffer);
    tempFiles.push(tempVideoPath);

    // 2. Extract audio with FFmpeg
    const audioPath = `${tempVideoPath}.mp3`;
    await new Promise((resolve, reject) => {
      const command = `ffmpeg -i ${tempVideoPath} -vn -acodec libmp3lame -q:a 2 ${audioPath}`;
      exec(command, (error) => {
        if (error) return reject(new Error('Failed to process video with FFmpeg.'));
        tempFiles.push(audioPath);
        resolve();
      });
    });

    // 3. Transcribe with Whisper
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
    });
    console.log(`Full transcript for ${waffleId}:`, transcript.text);

    // 4. Update the database with the transcript
    const dbClient = await pool.connect();
    try {
      const query = 'UPDATE public.waffles SET ai_transcript = $1 WHERE id = $2';
      await dbClient.query(query, [transcript.text, waffleId]);
      console.log(`Successfully updated transcript for waffle ${waffleId}.`);
    } finally {
      dbClient.release();
    }

    res.status(200).json({ message: 'Transcript processed and saved.' });

  } catch (error) {
    console.error(`Error processing full video for ${waffleId}:`, error);
    res.status(500).json({ error: 'Failed to process full video.' });
  } finally {
    // 5. Cleanup all temporary files
    tempFiles.forEach(file => fs.unlink(file, err => {
      if (err) console.error(`Error deleting temp file ${file}:`, err);
    }));
  }
});

app.listen(port, () => {
  console.log(`Backend service listening on port ${port}`);
});