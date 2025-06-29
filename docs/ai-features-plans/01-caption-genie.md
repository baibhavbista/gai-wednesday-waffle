# 01-caption-genie.md

## 1\. Objective & Final Architecture

**Objective**: To implement the "Caption Genie" feature, providing fast, style-personalized caption suggestions on the video preview screen. This plan addresses all identified technical constraints, including iOS `.mov` file formats and the 25MB OpenAI API limit.

**Final Architecture: Monorepo with Hybrid Cloud**

  * **Repository**: A single monorepo. A new `render-backend` directory will be created inside the existing `wednesday-waffle-app` repository to house the backend service.
  * **Data Plane (Supabase)**: Supabase will continue to manage the database, user authentication, file storage, and Row Level Security.
  * **Compute Plane (Render.com)**: A new Node.js service, deployed on Render.com, will handle all intensive media processing (FFmpeg) and AI orchestration. This service will be deployed from the `render-backend` sub-directory.

-----

## Phase 1: Project Structure & Backend Initialization

This phase organizes your existing repository to support the new backend service.

1.  **Create the Backend Directory**:

      * Inside the root of your repository, create a new folder named `render-backend`.

2.  **Initialize a Separate Node.js Project**:

      * Navigate your terminal into the new `render-backend` directory.
      * Run `npm init -y` to create a new, independent `package.json` file. This file is **only for the backend** and must not interfere with the root `package.json`.
      * Install the necessary backend dependencies: `npm install express pg jsonwebtoken`.

3.  **Create the Server Entry Point**:

      * Inside the `render-backend` directory, create a main server file, e.g., `index.js`. This will contain your Express application logic.

4.  **Define the `start` Script**:

      * In `render-backend/package.json`, add the `start` script that Render will use to launch your server:
        ```json
        "scripts": {
          "start": "node index.js"
        }
        ```

-----

## Phase 2: Render.com Service Configuration (Infrastructure as Code)

This phase uses an "Infrastructure as Code" approach to define your Render service.

1.  **Create `render.yaml` in the Repository ROOT**:

      * In the **root directory** of your repository, create a new file named `render.yaml`.
      * **Purpose**: This single blueprint file instructs Render on how to find, build, and deploy all services within your monorepo.

2.  **Define the Service**:

      * Add the following content to the root `render.yaml` file.
      * **LLM Guidance**: Pay close attention to the `rootDir` property. This is the critical setting that tells Render to look inside the `render-backend` folder for this specific service.

    <!-- end list -->

    ```yaml
    services:
      # This is your web service for real-time caption generation
      - type: web
        name: waffle-app-caption-service
        plan: free # Uses the free tier with spin-down behavior
        runtime: native
        env: node

        # Specifies the sub-directory for this service
        # This is the most critical setting for the monorepo structure
        rootDir: render-backend

        # This section installs FFmpeg into the native Node.js environment
        packages:
          - name: ffmpeg

        # Specifies build and start commands relative to the Root Directory
        buildCommand: "npm install"
        startCommand: "npm start"

        # Define environment variables to be set as secrets in the Render dashboard
        envVars:
          - key: SUPABASE_JWT_SECRET
            fromSecret: true
          - key: OPENAI_API_KEY
            fromSecret: true
          - key: SUPABASE_DB_URL # Full database connection string
            fromSecret: true
    ```

-----

## Phase 3: Backend Service Implementation (in `./render-backend`)

This phase details the logic inside your new Node.js server.

1.  **Create the API Endpoint**:

      * In `render-backend/index.js`, create a POST endpoint, e.g., `/generate-captions-from-chunk`.

2.  **Implement Security First**:

      * The endpoint must first extract the JWT from the `Authorization: Bearer <token>` header.
      * It will use the `jsonwebtoken` library and your `SUPABASE_JWT_SECRET` to verify the token's validity. Reject any unauthorized requests immediately.

3.  **Implement the "Caption Genie" Logic**:

      * Receive the 1MB video chunk and the `styleCaptions` array from the request body.
      * Use Node.js's `fs` module to write the received chunk to a temporary file (e.g., `/tmp/chunk.mov`).
      * Use Node.js's `child_process.exec` to run an FFmpeg command on the temporary file to convert it and extract the audio.
      * Send the resulting audio file to the Whisper API for transcription.
      * Construct the style-aware prompt for the GPT model using the new transcript and the `styleCaptions` examples.
      * Call the GPT API to get the final suggestions.
      * **Crucial Cleanup**: Use a `try...finally` block to ensure the temporary video and audio files are deleted from the server's file system after every request, whether it succeeds or fails.
      * Return the suggestions to the client.

4.  **Implement the Full Transcription Logic (for RAG)**:

      * Create a second POST endpoint, e.g., `/process-full-video`. This endpoint will be called by the Supabase Storage webhook.
      * This function will download the full video from Supabase Storage.
      * It will use FFmpeg to chunk the audio into segments smaller than 25MB.
      * It will loop through the chunks, send each to Whisper, and concatenate the results.
      * Finally, it will use the `pg` library to connect to your Supabase database and update the `waffles` table with the full transcript.

-----

## Phase 4: Client-Side Integration (in `./`)

This phase updates your React Native app to communicate with the new Render backend.

1.  **Create Helper Services**:

      * Implement `lib/media-processing.ts` with the `getVideoChunk` function as planned.
      * Implement `lib/ai-service.ts` with the `getCaptionSuggestions` function. **Crucial Change**: This function must now use `fetch` to call your Render service's public URL, and it must attach the Supabase JWT to the `Authorization` header.

2.  **Refactor `app/(tabs)/camera.tsx`**:

      * Implement the "upload-while-previewing" logic exactly as outlined previously. The key is to initiate the background upload and the caption generation process in parallel as soon as the video preview screen appears.
      * The `sendVideo` function will now be much simpler, only responsible for awaiting the final upload URL and sending the message data.

-----

## Phase 5: Final Supabase Configuration

1.  **Implement and Deploy the RPC Function**:

      * Add the `get_user_caption_history` function to your database by creating and deploying a new migration file, e.g., `scripts/supabase/12-get-caption-history-function.sql`.

2.  **Activate the Storage Webhook**:

      * Once your `/process-full-video` endpoint on Render is live, configure the Supabase Storage webhook to call that URL whenever a new video is uploaded to the `waffles` bucket.

-----

## Verification Checklist

1.  ✅ **Monorepo Structure:** The `render-backend` directory exists with its own `package.json` and the `render.yaml` file is correctly placed in the **repository root**.
2.  ✅ **Render Deployment:** The Render service successfully deploys from the `render-backend` sub-directory and the logs show that FFmpeg is available.
3.  ✅ **Security:** The backend endpoint correctly rejects API calls that lack a valid Supabase JWT.
4.  ✅ **Caption Generation:** On the preview screen, caption suggestions appear within \~3-5 seconds on a typical connection.
5.  ✅ **End-to-End Flow:** A video recorded on an iOS device (`.mov`) can be sent, and its full transcript correctly appears in the database after background processing.