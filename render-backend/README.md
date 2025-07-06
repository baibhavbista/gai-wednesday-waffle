# 🧇 Wednesday Waffle - Render Backend

AI-powered compute service for Wednesday Waffle, handling media processing and AI features that require FFmpeg and other binaries not available in Supabase Edge Functions.

## 🎯 Purpose

This Node.js service runs on Render.com and provides:
- **Caption Genie**: AI-generated captions for videos (≤70 chars, <3s response)
- **Prompt-Me-Please**: Contextual conversation starters based on group history
- **Full Video Processing**: Transcription, embeddings, and AI recaps for RAG

## 🔌 API Endpoints

### `POST /generate-captions` (Protected)
Generates 3 AI captions for a video/audio chunk
- **Auth**: Bearer token (Supabase JWT)
- **Input**: 
  - `videoChunk` or `audioChunk` (multipart/form-data)
  - `group_id` (optional) - The group context for caption generation
- **Output**: `{ suggestions: string[] }`
- **Behavior**:
  - **With group_id**: 
    - User style: Last 5 captions by user in that specific group
    - Similar content: All waffles from that group (any member)
  - **Without group_id**: 
    - User style: Last 5 captions by user across all groups
    - Similar content: Only user's own waffles (privacy)
- **Features**: 
  - Automatically learns from user's last 5 captions
  - Uses RAG to find similar past waffles
  - Combines user style with contextual relevance

**Example Usage:**
```javascript
// From group chat - includes group context
const formData = new FormData();
formData.append('audioChunk', audioBlob);
formData.append('group_id', 'uuid-of-current-group');

// From camera tab - no group context
const formData = new FormData();
formData.append('videoChunk', videoBlob);
// No group_id - will use user's own content only
```

### `POST /process-full-video` (Webhook)
Processes full videos after upload to Supabase Storage
- **Trigger**: Supabase Storage webhook
- **Actions**: Transcribe → Generate embeddings → Create AI recap → Store in DB

### `POST /ai/convo-starter` (Protected)
Generates conversation prompts based on recent group activity
- **Auth**: Bearer token (Supabase JWT)
- **Input**: `{ group_id, user_uid }`
- **Output**: `{ suggestions: string[] }`

### `POST /api/search/waffles` (Protected)
Semantic search across waffle transcripts
- **Auth**: Bearer token (Supabase JWT)
- **Input**: 
  ```json
  {
    "query": "Josh's new job",
    "filters": {
      "groupIds": ["uuid1", "uuid2"],
      "userIds": ["uuid3"],
      "dateRange": { "start": "2024-01-01", "end": "2024-02-01" },
      "mediaType": "video" | "photo" | "all"
    },
    "limit": 10,
    "offset": 0
  }
  ```
- **Output**: 
  ```json
  {
    "results": [{
      "id": "waffle-id",
      "userName": "Josh M.",
      "groupName": "Work Friends",
      "transcript": "Full transcript text...",
      "matchStart": 42,
      "matchEnd": 67,
      "timestamp": 135,
      "videoDuration": 270,
      "createdAt": "2024-01-15T10:30:00Z",
      "matchPositions": [135, 203]
    }],
    "totalCount": 25,
    "suggestions": ["Josh's new job in Work Friends"],
    "processingStatus": "complete"
  }
  ```
- **Features**:
  - Embedding-based semantic search using pgvector
  - Temporal query understanding ("last week", "yesterday")
  - Permission-aware (only searches groups user is member of)
  - Sentence-level match highlighting
  - Result caching for performance

## 🚀 Setup

```bash
# Install dependencies
npm install

# Create .env.local with required variables (see below)

# Run locally
npm start

# Deploy to Render
# Use render.yaml in project root
```

## 🔐 Environment Variables

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_DB_URL=postgresql://postgres.xxx:password@aws-0-xxx.pooler.supabase.com:6543/postgres

# Server
PORT=3000
```

## 📦 Key Dependencies

- **express**: Web server framework
- **openai**: GPT-4o, Whisper, Embeddings
- **@supabase/supabase-js**: Storage & auth integration
- **pg**: Direct PostgreSQL access for vector operations
- **ffmpeg**: Audio/video processing (installed via render.yaml)
- **multer**: File upload handling

## 🏗 Architecture

```
User App → Supabase Auth → Render Backend → OpenAI APIs
                ↓                  ↓
          Supabase Storage    PostgreSQL (vectors)
```

## 🔄 Processing Flow

1. **Caption Generation**: Audio chunk → FFmpeg → Whisper → Embeddings → Fetch user's last 5 captions (group-filtered) → RAG lookup (group-aware) → GPT-4o → 3 captions
2. **Full Processing**: Video upload → Webhook → Download → Transcribe → Embed → Store with AI recap
3. **Conversation Starters**: Fetch recent transcripts → GPT-4o → 2 contextual prompts
4. **Search**: Query → Parse temporal → Generate embedding → Vector similarity search → Find match positions → Return highlighted results

## 📝 Notes

- All AI responses must complete in <3 seconds
- Uses pgvector for semantic search capabilities
- Temporary files are automatically cleaned up
- Rate limiting implemented for conversation starters (30s window) 