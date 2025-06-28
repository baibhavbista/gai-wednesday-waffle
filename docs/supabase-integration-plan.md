# 🎯 Supabase Integration Master Plan for Wednesday Waffle

## 🚨 **CRITICAL SUCCESS CRITERIA**
- **Performance Target**: All AI endpoints MUST respond <3s P95 latency (job-critical)
- **Demo Target**: 5-minute walkthrough without crashes
- **User Stories**: 5-6 user stories must pass manual QA
- **Architecture**: Must support real-time, offline-first, and AI-powered features

---

## 📋 **Phase 1: Foundation Setup & Environment** (Day 1-2)

### **Critical Architecture Decisions**
- **Supabase Project**: Create dedicated project with optimal region selection
- **Client Configuration**: Single client instance with proper TypeScript integration
- **Environment Strategy**: Separate dev/prod environments from day 1

### **Essential Dependencies**
Using https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native as an example of how to start with supabase in expo & react native

```bash
@supabase/realtime-js @supabase/storage-js
expo-auth-session expo-crypto expo-web-browser  # For OAuth flows
```

### **Checkpoint**: ✅ Supabase client connects and can query basic tables

---

## 📋 **Phase 2: Authentication System** (Day 2-3)

### **Auth Strategy**
- **Primary**: Supabase Auth with Google OAuth (seamless onboarding)
- **Fallback**: Email/password for users who prefer it
- **Session Management**: Persistent sessions with auto-refresh
- **Profile System**: Extended user profiles beyond auth.users

### **OAuth Implementation Requirements**
- **Google Cloud Console**: OAuth client setup (iOS/Android/Web)
- **Supabase Dashboard**: Enable Google OAuth provider
- **Deep Linking**: Configure expo scheme for OAuth callbacks
- **UI**: Google sign-in button with proper branding guidelines
- **Error Handling**: OAuth flow failures and edge cases

### **Critical Implementation Points**
- Auth provider must wrap entire app in `_layout.tsx`
- Protected routes require auth guards
- Zustand store integration for auth state
- **OAuth callback handling**: Proper deep link configuration
- **Profile auto-creation**: Extract name/avatar from OAuth providers

### **Checkpoint**: ✅ Complete OAuth → profile creation → protected navigation flow

---

## 📋 **Phase 3: Core Database Schema & Tables** (Day 3-4)

### **🔥 CRITICAL SCHEMA (GET THIS RIGHT FIRST TIME)**

```sql
-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups
CREATE TABLE public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Memberships
CREATE TABLE public.group_members (
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- Waffles (Messages) - CORE TABLE
CREATE TABLE public.waffles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  content_url TEXT, -- Storage URL
  content_type TEXT CHECK (content_type IN ('video', 'photo', 'text')),
  caption TEXT,
  retention_type TEXT DEFAULT '7_days' CHECK (retention_type IN ('view_once', '7_days', 'forever')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0
);
```

### **Essential RLS Policies**
- **Profiles**: Read all, update own only
- **Groups**: Members read, creators manage
- **Waffles**: Group members only access
- **Group_members**: Self-manage membership

### **Checkpoint**: ✅ All tables created, RLS working, basic CRUD operations functional

---

## 📋 **Phase 4: File Storage System** (Day 4-5)

### **Storage Architecture**
- **Buckets**: `waffles` (private), `avatars` (public)
- **Security**: RLS-based access, file type validation
- **Performance**: 720p compression, CDN delivery

### **Critical Constraints**
- Video files: 50MB max, 5min duration limit
- Auto-compression to 720p before upload
- Signed URLs for private content access

### **Checkpoint**: ✅ Upload video → compress → store → retrieve via signed URL

---

## 📋 **Phase 5: Real-time Messaging & Groups** (Day 5-6)

### **Real-time Strategy**
- **Channels**: Group-specific subscriptions
- **Events**: INSERT/UPDATE/DELETE on waffles table
- **State Sync**: Zustand + Supabase real-time integration

### **Group Management Core Features**
- Create group → generate unique invite code
- Join via invite code validation
- Real-time member updates
- Message delivery with optimistic updates

### **Checkpoint**: ✅ Multi-user real-time messaging working across groups

---

## 📋 **Phase 6: AI Features - Edge Functions** (Day 6-8)

### **🚨 PERFORMANCE-CRITICAL PHASE**

### **Edge Functions Architecture**
```
/functions/v1/whisper-transcribe    → <3s response time
/functions/v1/generate-captions     → <3s response time  
/functions/v1/conversation-starters → <3s response time
/functions/v1/catch-up-recap        → <3s response time
```

### **Critical Performance Strategies**
- **Parallel Processing**: Multiple AI calls where possible
- **Caching**: Aggressive caching for repeated requests
- **Circuit Breakers**: Fail-fast for slow AI services
- **Monitoring**: Real-time latency tracking

### **AI Feature Requirements**
- **Caption Genie**: 3 captions ≤70 chars from video/photo
- **Prompt-Me-Please**: Context-aware conversation starters
- **Whisper STT**: Video → transcript pipeline
- **Error Handling**: Graceful degradation when AI fails

### **Checkpoint**: ✅ All AI endpoints responding <3s with realistic content

---

## 📋 **Phase 7: Vector Embeddings & RAG** (Day 8-9)

### **Vector Database Setup**
```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Transcripts for RAG
CREATE TABLE public.transcripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  waffle_id UUID REFERENCES public.waffles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  embedding vector(1536), -- OpenAI dimensions
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Critical: Vector similarity index
CREATE INDEX ON transcripts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### **RAG Implementation Strategy**
- **Pipeline**: Video → Transcript → Embeddings → Vector Search
- **Context Enhancement**: Use conversation history for better AI responses
- **Catch-up Recap**: 80-word summaries from recent group activity

### **Checkpoint**: ✅ Vector search working, contextual AI responses improved

---

## 📋 **Phase 8: Push Notifications** (Day 9-10)

### **Notification Strategy**
- **Wednesday Nudges**: 9AM & 8PM local time scheduling
- **Real-time**: New waffle notifications
- **Deep Linking**: Direct navigation to groups/conversations

### **Critical Implementation**
- Time zone handling for global users
- User preferences and opt-out functionality
- Notification batching to avoid spam

### **Checkpoint**: ✅ Wednesday reminders and real-time notifications working

---

## 📋 **Phase 9: Testing & Performance Optimization** (Day 10-11)

### **Performance Testing Priorities**
1. **AI Latency**: Ensure <3s P95 across all endpoints
2. **File Upload**: Test 5min video uploads under various conditions
3. **Real-time**: Message delivery latency testing
4. **Database**: Query optimization and indexing validation

### **Integration Testing**
- Complete user journey testing (signup → group → waffle → AI features)
- Cross-platform compatibility (iOS/Android)
- Offline behavior and sync validation
- Error handling and graceful degradation

### **Checkpoint**: ✅ All performance targets met, integration tests passing

---

## 📋 **Phase 10: Production Deployment** (Day 11-12)

### **Production Readiness**
- Separate production Supabase project
- Environment variable security audit
- Monitoring and alerting setup
- Database backup and scaling configuration

### **Demo Preparation**
- Realistic test data for walkthrough
- Performance monitoring dashboard
- 5-minute demo script preparation

### **Checkpoint**: ✅ Production deployment ready, demo walkthrough successful

---

## 🎯 **CRITICAL MILESTONES & SUCCESS METRICS**

### **Daily Success Checkpoints**
- **Day 3**: ✅ Auth + CRUD operations + database schema complete
- **Day 6**: ✅ Real-time messaging + file uploads functional  
- **Day 9**: ✅ All AI features responding <3s reliably
- **Day 12**: ✅ Production-ready with successful demo walkthrough

### **Non-Negotiable Performance Targets**
- **AI Endpoints**: <3s P95 latency (CRITICAL FOR SUCCESS)
- **File Uploads**: <10s for 5min videos
- **Real-time Messages**: <500ms delivery
- **App Launch**: <2s cold start

### **User Story Validation**
- [ ] **US-1**: Capture & post waffle (complete flow)
- [ ] **US-2**: Wednesday nudger notifications
- [ ] **US-3**: Prompt-me-please AI suggestions  
- [ ] **US-4**: Caption Genie AI captions
- [ ] **US-5**: Catch-up recap AI summaries
- [ ] **US-6**: Multi-group sharing (stretch goal)

---

## 🚨 **RISK MITIGATION & CONTINGENCIES**

### **High-Risk Areas Requiring Extra Attention**
1. **OAuth Configuration**: Google Cloud Console + Supabase setup must be perfect
2. **AI Performance Bottlenecks**: Implement aggressive caching and circuit breakers
3. **File Upload Reliability**: Robust retry logic and progress tracking
4. **Real-time Scalability**: Connection pooling and rate limiting
5. **Vector Search Performance**: Proper indexing strategy

### **Fallback Strategies**
- **OAuth Failures**: Always provide email/password as backup auth method
- **AI Service Outage**: Cached responses and graceful degradation
- **Storage Issues**: Local caching with background sync
- **Database Overload**: Read replicas and connection pooling
- **Network Issues**: Offline-first with sync queue

### **Critical Decision Points**
- **Day 4**: If database performance issues, optimize before proceeding
- **Day 7**: If AI latency >3s, implement caching before continuing
- **Day 10**: If integration tests fail, address before deployment

---

## 📝 **ORCHESTRATION NOTES**

### **For Future Implementation Sessions**
- Each phase builds on previous phases - maintain dependency order
- **OAuth setup requires external service configuration** - Google Cloud Console setup cannot be automated
- Performance monitoring should be implemented alongside features, not after
- Database schema changes become expensive after Phase 4 - get it right early
- AI feature implementation requires iterative testing for <3s target
- Real-time features require careful state management between Zustand and Supabase

### **Success Indicators**
- **Technical**: All checkpoints pass, performance targets met
- **User Experience**: Smooth 5-minute demo without crashes
- **Business**: All core user stories demonstrable
- **Stretch**: Multi-group functionality working

---

**This plan prioritizes architectural decisions and performance-critical elements while allowing implementation details to be generated with full context during execution.** 