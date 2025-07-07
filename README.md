# 🧇 Wednesday Waffle

> A tiny, private video-sharing app for friend groups who no longer share the same city.

**Wednesday Waffle** recreates the feeling of "hanging out in the kitchen" through a simple weekly ritual: every Wednesday, friends drop quick video updates. No performative posting, no algorithms, no disappearing content—just authentic moments shared and kept forever with your closest people.

## 🎯 The Problem We're Solving

- **Public socials feel too performative** → endless audience pressure
- **Group chats are text-heavy** → lack visual connection
- **Friends drift apart across cities** → need low-pressure ritual to stay close

**Wednesday Waffle splits the difference**: a lightweight, semi-synchronous space to swap real-life snippets without performing for the internet.

## ✨ Core Features

### 📱 **Capture & Share**
- Record ≤5min videos with built-in camera
- Auto-downscaled to 720p for optimal performance
- Automatic thumbnail generation & duration extraction
- Full transcription with AI-generated summaries

### 👥 **Private Groups**
- Create or join groups via magic invite codes
- Perfect for 3-10 friends living in different cities
- Real-time updates via Supabase Realtime

### 🔔 **Wednesday Nudger**
- Smart push notifications (9AM & 8PM local time)
- Gentle reminders if you haven't posted your waffle
- Fully customizable in settings

### 🤖 **AI-Powered Features**
- **Prompt-Me-Please**: Smart conversation starters when camera is idle >10s
- **Caption Genie**: Three AI-generated captions (≤70 chars) in <3s
- **Catch-Up Summary**: AI-powered catch-up of the last 10 days of group activity
- **Search & Find**: Semantic search across all video transcripts with AI answers

## 🛠 Tech Stack

- **Frontend**: React Native + Expo Router, StyleSheet API, Zustand
- **Backend**: Hybrid model
    - **Data Plane**: Supabase (Auth, Postgres, Storage, Realtime)
    - **Compute Plane**: Render.com (Node.js + FFmpeg) for AI/media processing
- **AI**: Render Service → FFmpeg → Whisper TTS → GPT-4o
- **Performance**: All AI calls return in <3s (SnapConnect success metric)

## 🚀 Current Implementation Status

### ✅ **Completed**
- [x] React Native + Expo foundation with tab navigation
- [x] Camera functionality with video recording (5min max)
- [x] Group management (create/join with invite codes)
- [x] Zustand state management with proper TypeScript interfaces
- [x] Polished UI with Inter/Poppins fonts and consistent design
- [x] Message components with likes and real-time updates
- [x] **Supabase backend integration** (Auth, Database, Storage)
- [x] **Real-time messaging and group updates**
- [x] **Video/photo upload to Supabase Storage**
- [x] **Complete database schema with RLS policies**
- [x] **Google OAuth authentication**
- [x] **User profile management**
- [x] **Multi-group video sharing**
- [x] **Wednesday Nudge System** (Local notifications with smart cancellation)
- [x] **Notification permissions** (Requested during profile setup)
- [x] **Notification settings** (Toggle in profile with permission handling)
- [x] **Caption Genie** (AI-generated captions with group context awareness)
- [x] **Prompt-Me-Please** (Contextual conversation starters)
- [x] **Catch-Up Summary** (AI recap of last 10 days of group activity)
- [x] **Search & Find** (Semantic search with real-time AI answers)
- [x] **Video Processing Pipeline** (Transcription, embeddings, thumbnails, duration)

### 🚀 **Ready for Production**
All core features including AI capabilities are now implemented and functional!

### 🎯 **User Stories (MVP)**
1. **US-1**: Capture & post waffle ✅ *(Complete with full backend integration)*
2. **US-2**: Wednesday nudger push notifications ✅ *(Local notifications implemented)*
3. **US-3**: Prompt-me-please AI suggestions ✅ *(Complete with contextual prompts)*
4. **US-4**: Caption Genie AI captions ✅ *(Complete with group-aware suggestions)*
5. **US-5**: Catch-up summary AI ✅ *(Complete with 10-day group activity recap)*
6. **US-6**: Share across multiple groups ✅ *(Complete)*
7. **Bonus**: Semantic search across transcripts ✅ *(Complete with AI answers)* 

## 📁 Project Structure

```
wednesday-waffle/
├── app/                          # Expo Router pages
│   ├── (tabs)/                  # Tab navigation screens
│   │   ├── index.tsx            # Chat/Groups list
│   │   ├── camera.tsx           # Video/photo capture
│   │   └── profile.tsx          # User settings
│   ├── auth/callback.tsx        # OAuth callback handler
│   ├── chat/[groupId].tsx       # Individual group chat
│   ├── group-details/[groupId].tsx # Group settings
│   ├── group-selection.tsx      # Multi-group sharing
│   └── _layout.tsx              # Root navigation
├── components/                  # Reusable UI components
│   ├── Auth.tsx                 # Authentication UI
│   ├── GroupCard.tsx            # Group preview cards
│   ├── ProfileSetup.tsx         # User onboarding
│   ├── WaffleMessage.tsx        # Message display component
│   ├── WednesdayNudge.tsx       # Notification modal
│   ├── AISuggestionPills.tsx    # AI feature buttons in chat
│   ├── WaffleSearchView.tsx     # Search interface
│   ├── SearchResultCard.tsx     # Individual search results
│   ├── SearchFilters.tsx        # Search filter UI
│   ├── AIAnswerCard.tsx         # AI-generated search answers
│   └── VideoModal.tsx           # Fullscreen video player
├── hooks/                       # Custom React hooks
│   ├── useAuth.ts               # Authentication logic
│   ├── useMedia.ts              # Camera & upload utilities
│   └── useRealtime.ts           # Real-time subscriptions
├── lib/                         # Backend services
│   ├── supabase.ts              # Supabase client setup
│   ├── database-service.ts      # CRUD operations
│   ├── storage-service.ts       # File upload/download
│   ├── profile-service.ts       # User management
│   ├── settings-service.ts      # App preferences
│   ├── notification-service.ts  # Wednesday nudge system
│   ├── ai-service.ts            # AI feature integration
│   ├── search-service.ts        # Search functionality
│   ├── media-processing.ts      # Video/audio processing
│   └── thumbnail-utils.ts       # Thumbnail generation
├── render-backend/              # Node.js backend for AI processing
│   └── ...
├── store/                       # Zustand state management
│   └── useWaffleStore.ts        # Main app state
├── render.yaml                  # Infrastructure-as-Code for Render.com
└── scripts/supabase/            # Database migrations
    ├── 01-profiles-table.sql    # User profiles
    ├── 02-groups-table.sql      # Groups & invite codes
    ├── 03-group-members-table.sql # Memberships
    ├── 04-waffles-table.sql     # Messages/waffles
    ├── 14-create-transcripts-table.sql # Transcripts with embeddings
    ├── 17-add-notification-fields.sql # Notification system
    ├── 19-add-thumbnail-url.sql # Video thumbnails
    ├── 20-add-duration-column.sql # Video duration
    └── ...                      # 20+ migration files
```

## 🏗 Installation & Setup

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator / Android Emulator or physical device

### Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd wednesday-waffle

# Install dependencies
npm install

# Start development server
npm run dev

# Run on iOS/Android
# Follow Expo CLI prompts or scan QR code with Expo Go app
```

### Environment Setup (Required)

**Frontend (.env.local):**
```bash
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
EXPO_PUBLIC_CAPTION_SERVICE_URL=https://your-render-service.onrender.com
```

**Backend (render-backend/.env.local):**
(Of course, for prod, you actually need to set these in the Render.com service, and you want to set the root folder to be `render-backend`)
```bash
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

## 🎨 Design Philosophy

- **Authentic over performative**: Real moments, not highlight reels
- **Simple over complex**: One action per Wednesday, no endless scrolling
- **Private over public**: Your closest friends, not the whole internet
- **Keep over delete**: Every moment is worth remembering, nothing disappears
- **Smart over manual**: AI helps you stay connected without the work



## 🗂 Database Schema (Implemented)

```sql
-- Profiles table (extends auth.users)
profiles (
  id, name, avatar_url, created_at, updated_at,
  notifications_enabled, notification_permission_requested, last_waffle_week
)

-- Groups table  
groups (id, name, invite_code, created_at)

-- Group memberships
group_members (group_id, user_id, joined_at)

-- Waffles (messages)
waffles (id, user_id, group_id, content_url, caption, content_type, created_at, thumbnail_url, duration_seconds)

-- Transcripts for RAG
transcripts (content_url, text, embedding, created_at, ai_recap)

-- Search history
search_history (id, user_id, query, results_count, filters, created_at)

-- Saved searches
saved_searches (id, user_id, query, filters, created_at)
```

## 🤖 AI Features Architecture

### **AI Features Overview**
1. **Caption Genie**: Group-aware caption suggestions using user's style + similar content
2. **Prompt-Me-Please**: Contextual conversation starters based on recent group activity
3. **Catch-Up Summary**: AI-generated recap of last 10 days of group waffles
4. **Search & Find**: Semantic search with streaming AI answers via SSE

### **Processing Pipeline**
```mermaid
graph TD
    subgraph "Client App"
        A[User records video]
        B[User searches]
    end

    subgraph "Compute (Render.com Service)"
        C[Node.js + FFmpeg + OpenAI]
        D[Vector Embeddings]
        E[GPT-4o Processing]
    end

    subgraph "Data (Supabase)"
        F[Storage]
        G[PostgreSQL + pgvector]
    end

    A -- "1. Audio chunk → captions" --> C
    C -- "2. 3 captions in <3s" --> A
    A -- "3. Full video upload" --> F
    F -- "4. Webhook" --> C
    C -- "5. Transcript + embed + AI recap" --> G
    B -- "6. Search query" --> C
    C -- "7. Semantic search" --> G
    G -- "8. Results" --> C
    C -- "9. Stream AI answer" --> B
```

## 📝 Development Notes

- **Built from scratch using Bolt.new** - rapid prototyping to full implementation
- **Performance achieved**: All AI endpoints respond in <3 seconds
- **Production backend**: Supabase with complete database schema and RLS policies
- **Real-time ready**: Live messaging and group updates via Supabase Realtime
- **AI-powered**: Full RAG pipeline with vector embeddings for intelligent features
- **Mobile-first**: Optimized for iOS/Android with web support
- **Notification system**: Local notifications with smart week-based tracking
- **Search capabilities**: Semantic search with real-time AI-generated answers
- **Production-ready**: 100% feature complete and ready for deployment

## 🎯 Success Metrics

- **Feature completeness**: ✅ All core features + AI capabilities implemented (100% complete)
- **Performance**: ✅ AI endpoints P95 latency <3s achieved
- **Demo**: ✅ Fully functional app ready for walkthrough
- **Bonus**: ✅ Multi-group sharing + semantic search delivered
- **Notifications**: ✅ Wednesday nudge system fully functional
- **AI Features**: ✅ All 3 AI features (Caption Genie, Prompt-Me-Please, Catch-Up) implemented

## 🚀 Next Steps

1. **Production Deployment**: Configure production environment
2. **Performance Monitoring**: Set up analytics and monitoring
3. **User Testing**: Gather feedback from initial friend groups
4. **Polish & Optimization**: Refine UI/UX based on real usage
5. **Scale Infrastructure**: Optimize for larger user base

## 🤝 Contributing

This is currently a solo project built for a specific use case, but open to feedback and suggestions!

## 📄 License

Private project - All rights reserved.

## 🔔 Wednesday Nudge System ✅

### **Implementation Approach: Local Notifications**
We chose local notifications over push notifications for simplicity and reliability:
- No backend infrastructure required
- Works offline
- Respects user's timezone automatically
- Perfect for predictable, calendar-based reminders

### **Notification Schedule**
- **When**: Every Wednesday at 9AM and 8PM local time
- **Who**: Users who haven't posted a waffle that calendar week
- **Messages**:
  - 9AM: "Time to share your Wednesday waffle! 🧇"
  - 8PM: "Don't let Wednesday slip away! Share your waffle 🧇"

### **Smart Behavior**
- Automatically cancelled when user posts a waffle
- Calendar week based (Sunday-Saturday)
- One post to any group counts for the week
- Simple on/off toggle in settings
- Opt-in during profile setup (with graceful permission handling)
- Test notifications available in dev mode (30s/60s delays)

### **Technical Details**
- Uses `expo-notifications` for local scheduling
- Schedules up to 4 weeks in advance (iOS limit: 64 notifications)
- Reschedules on every app launch to maintain coverage
- Permission requested during profile setup

---

**Wednesday Waffle** - Because staying connected shouldn't feel like work. 🧇✨
