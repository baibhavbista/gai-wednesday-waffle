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
- **Actions**: 
  - Extract video duration using FFprobe
  - Generate thumbnail image
  - Transcribe audio → Generate embeddings → Create AI recap
  - Store all metadata in DB

### `POST /ai/convo-starter` (Protected)
Generates conversation prompts based on recent group activity
- **Auth**: Bearer token (Supabase JWT)
- **Input**: `{ group_id, user_uid }`
- **Output**: `{ suggestions: string[] }`

### `GET /api/catchup/:groupId` (Protected)
Generates AI-powered catch-up summary of recent group activity
- **Auth**: Bearer token (Supabase JWT)
- **Path Params**: `groupId` - The group to summarize
- **Query Params**: `days` (optional, default: 10, max: 30)
- **Output**: 
  ```json
  {
    "summary": "Josh and Sarah have been sharing their weekend adventures...",
    "waffleCount": 15,
    "days": 10,
    "cached": false
  }
  ```
- **Features**:
  - Fetches waffles from the specified time period
  - Chooses shortest content: caption → ai_recap → transcript
  - Generates detailed 4-6 sentence summary (1-2 paragraphs) with GPT-4o
  - Includes specific names, activities, and memorable moments
  - 2-hour cache to reduce API calls
  - Handles empty periods gracefully

### `POST /api/search/waffles` (Protected)
Semantic search across waffle transcripts with AI-powered answers
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
      "videoDuration": 270,
      "createdAt": "2024-01-15T10:30:00Z"
    }],
    "totalCount": 25,
    "suggestions": ["Josh's new job in Work Friends"],
    "processingStatus": "complete",
    "searchId": "search-1751808123-abc123",
    "aiAnswer": {
      "status": "pending",
      "text": null
    }
  }
  ```
- **Features**:
  - Embedding-based semantic search using pgvector
  - Temporal query understanding ("last week", "yesterday")
  - Permission-aware (only searches groups user is member of)
  - Immediate results with async AI answer generation
  - Result caching for performance

### `GET /api/search/ai-stream/:searchId` (Protected) - SSE
Streams AI-generated answers for search results
- **Auth**: Bearer token (Supabase JWT)
- **Protocol**: Server-Sent Events (SSE)
- **Flow**:
  1. Client connects after receiving `searchId` from search endpoint
  2. Server streams GPT-4o response token-by-token
  3. Connection closes automatically when complete
- **Messages**:
  ```javascript
  // Initial connection
  data: {"status":"connected"}\n\n
  
  // Progressive updates
  data: {"status":"streaming","text":"Josh mentioned..."}\n\n
  data: {"status":"streaming","text":"Josh mentioned accepting..."}\n\n
  
  // Final message
  data: {"status":"complete","text":"Josh mentioned accepting a new position at Tesla..."}\n\n
  ```
- **Features**:
  - Real-time streaming as GPT generates response
  - Supports multiple concurrent clients
  - Automatic cleanup after completion
  - Graceful error handling

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
                                   ↓
                              SSE Stream → Client
```

## 🔄 Processing Flow

1. **Caption Generation**: Audio chunk → FFmpeg → Whisper → Embeddings → Fetch user's last 5 captions (group-filtered) → RAG lookup (group-aware) → GPT-4o → 3 captions
2. **Full Video Processing**: 
   - Video upload → Storage webhook → Download video
   - **Extract metadata**: FFprobe → video duration (seconds)
   - **Generate thumbnail**: FFmpeg → frame at 1s → scale to 640px → upload
   - **Process audio**: FFmpeg → extract audio → Whisper → transcript
   - **AI enrichment**: Generate embeddings → Create AI recap
   - **Store everything**: Duration, thumbnail URL, transcript, embeddings, recap → DB
3. **Conversation Starters**: Fetch recent transcripts → GPT-4o → 2 contextual prompts
4. **Catch-Up Summary**: 
   - Fetch last N days of waffles → Select shortest content per waffle
   - Format chronologically with timestamps → Send to GPT-4o
   - Generate detailed 4-6 sentence summary with names & specific moments → Cache for 2 hours
5. **Search with AI**: 
   - **Immediate**: Query → Parse temporal → Generate embedding → Vector search → Return results + searchId
   - **Async**: Generate AI answer → Stream via SSE → Progressive display in UI

## 📡 SSE Implementation Details

The search functionality uses Server-Sent Events (SSE) for streaming AI answers:

1. **Why SSE over WebSockets**:
   - One-way server→client communication
   - Built-in reconnection
   - Works better through proxies/firewalls
   - Lower overhead for mobile devices

2. **Task Management**:
   - Each search creates a unique task ID: `userId:searchId`
   - Tasks store client connections and AI generation state
   - Automatic cleanup 5 minutes after completion

3. **Client Usage**:
   ```javascript
   // 1. Search request
   const searchResponse = await fetch('/api/search/waffles', {...});
   const { searchId, results } = await searchResponse.json();
   
   // 2. Connect to SSE stream
   const eventSource = new EventSource(`/api/search/ai-stream/${searchId}`);
   eventSource.onmessage = (event) => {
     const data = JSON.parse(event.data);
     // Update UI with streaming text
   };
   ```

## 📝 Notes

- All AI responses must complete in <3 seconds
- Uses pgvector for semantic search capabilities
- Temporary files are automatically cleaned up
- Rate limiting implemented for conversation starters (30s window) 