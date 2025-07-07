# Database Schema Documentation

This document provides a comprehensive overview of the Wednesday Waffle database schema, including all tables, relationships, and design decisions.

## Overview

Wednesday Waffle is a social video-sharing application where users can share short video updates ("waffles") within private friend groups. The database is built on Supabase (PostgreSQL) and includes features for user profiles, groups, video content, transcriptions, and search functionality.

## Complete Schema

```sql
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.group_members (
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT group_members_pkey PRIMARY KEY (group_id, user_id),
  CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text NOT NULL DEFAULT upper(SUBSTRING((gen_random_uuid())::text FROM 1 FOR 6)) UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text NOT NULL,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  notifications_enabled boolean DEFAULT true,
  notification_permission_requested boolean DEFAULT false,
  last_waffle_week text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.saved_searches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  query text NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb,
  name text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT saved_searches_pkey PRIMARY KEY (id),
  CONSTRAINT saved_searches_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.search_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  query text NOT NULL,
  results_count integer DEFAULT 0,
  filters jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT search_history_pkey PRIMARY KEY (id),
  CONSTRAINT search_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.transcripts (
  content_url text NOT NULL,
  text text NOT NULL,
  embedding USER-DEFINED,  -- pgvector embedding type
  created_at timestamp with time zone DEFAULT now(),
  ai_recap text,
  thumbnail_url text,
  duration_seconds integer,
  CONSTRAINT transcripts_pkey PRIMARY KEY (content_url)
);

CREATE TABLE public.waffles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid,
  content_url text,
  caption text,
  created_at timestamp with time zone DEFAULT now(),
  view_count integer DEFAULT 0,
  content_type USER-DEFINED NOT NULL,  -- enum: 'video', 'photo', 'text'
  CONSTRAINT waffles_pkey PRIMARY KEY (id),
  CONSTRAINT waffles_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT waffles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
```

## Table Descriptions

### 1. `profiles`
**Purpose**: Stores user profile information, extending Supabase's auth.users table.

**Key Fields**:
- `id` (uuid): Primary key, references auth.users(id)
- `name` (text): User's display name
- `avatar_url` (text): URL to user's profile picture
- `notifications_enabled` (boolean): Whether user has enabled push notifications
- `notification_permission_requested` (boolean): Tracks if app has requested notification permissions
- `last_waffle_week` (text): Tracks the last week user posted a waffle (for Wednesday nudge feature)

**Relationships**:
- One-to-one with auth.users (Supabase authentication)
- One-to-many with waffles (user can create many waffles)
- Many-to-many with groups (through group_members)

### 2. `groups`
**Purpose**: Represents friend groups where users share their waffles.

**Key Fields**:
- `id` (uuid): Primary key
- `name` (text): Group display name
- `invite_code` (text): Unique 6-character code for joining the group
- `created_by` (uuid): User who created the group
- `created_at` / `updated_at`: Timestamps

**Relationships**:
- Many-to-many with profiles (through group_members)
- One-to-many with waffles

### 3. `group_members`
**Purpose**: Junction table managing group membership.

**Key Fields**:
- `group_id` (uuid): References groups(id)
- `user_id` (uuid): References profiles(id)
- `joined_at` (timestamp): When user joined the group

**Note**: Composite primary key ensures a user can only be in a group once.

### 4. `waffles`
**Purpose**: Core content table storing user posts (videos, photos, or text).

**Key Fields**:
- `id` (uuid): Primary key
- `user_id` (uuid): User who created the waffle
- `group_id` (uuid): Group where waffle was shared
- `content_url` (text): Storage URL for video/photo content
- `content_type` (enum): Type of content ('video', 'photo', 'text')
- `caption` (text): User-provided caption
- `view_count` (integer): Number of views
- `created_at` (timestamp): When waffle was created

**Important Design Note**: 
- The `content_url` field stores the full signed URL from Supabase Storage, including authentication tokens
- This URL is used to link to the transcripts table (see design considerations below)

### 5. `transcripts`
**Purpose**: Stores video metadata including transcriptions, AI-generated summaries, and technical details.

**Key Fields**:
- `content_url` (text): Primary key, matches waffle's content_url
- `text` (text): Full transcription of the video
- `embedding` (vector): pgvector embedding for semantic search
- `ai_recap` (text): AI-generated summary for catch-up feature
- `thumbnail_url` (text): Signed URL for video thumbnail
- `duration_seconds` (integer): Video duration
- `created_at` (timestamp): When transcript was created

**Important Design Notes**:
1. **Naming**: This table should have been named `video_metadata` or `videos` as it stores more than just transcripts
2. **Relationship Design**: Currently linked to waffles via `content_url` matching, which is brittle (see design considerations)

### 6. `search_history`
**Purpose**: Tracks user search queries for analytics and improving search experience.

**Key Fields**:
- `id` (uuid): Primary key
- `user_id` (uuid): User who performed the search
- `query` (text): Search query text
- `results_count` (integer): Number of results returned
- `filters` (jsonb): Applied search filters
- `created_at` (timestamp): When search was performed

### 7. `saved_searches`
**Purpose**: Allows users to save frequently used searches.

**Key Fields**:
- `id` (uuid): Primary key
- `user_id` (uuid): User who saved the search
- `query` (text): Search query text
- `filters` (jsonb): Saved search filters
- `name` (text): User-friendly name for the saved search
- `created_at` (timestamp): When search was saved

## Design Considerations and Technical Debt

### 1. Transcripts Table Naming
The `transcripts` table is poorly named as it contains much more than just transcriptions:
- Video thumbnails
- Duration information
- AI-generated recaps
- Embeddings for search

**Recommendation**: In a future migration, rename to `video_metadata` or `videos`.

### 2. Waffle-Transcript Relationship
Currently, `waffles` and `transcripts` are linked via the `content_url` field, which creates several issues:
- No referential integrity via foreign key
- Brittle coupling based on URL string matching
- URLs contain authentication tokens that could change

**Better Design**: 
```sql
-- Add to waffles table
video_id uuid REFERENCES video_metadata(id)

-- Restructure transcripts/video_metadata table
CREATE TABLE video_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL,  -- Just the path, not full URL
  -- ... other fields
);
```

### 3. Normalized Video Metadata
The current design correctly normalizes video metadata into a separate table because:
- A single video can be shared in multiple groups (multiple waffle records)
- Video processing is expensive; we want to do it once per video
- Metadata like transcripts, thumbnails, and embeddings are properties of the video, not the post

### 4. Storage URLs
Currently storing full signed URLs in the database, which includes authentication tokens. Consider storing just the path and generating signed URLs on-demand.

## Row-Level Security (RLS)

All tables have RLS enabled with policies ensuring:
- Users can only see groups they're members of
- Users can only see waffles in their groups
- Users can only see profiles of people in their groups
- Search history is private to each user

## Indexes

Key indexes for performance:
- `waffles.group_id` - For fetching waffles by group
- `waffles.user_id` - For fetching user's waffles
- `waffles.created_at` - For chronological ordering
- `transcripts.embedding` - For vector similarity search
- `group_members` composite index on (group_id, user_id)

## Real-time Features

The following tables have real-time enabled:
- `waffles` - For instant message delivery
- `group_members` - For membership changes
- `groups` - For group updates

## Usage Examples

### Fetching waffles for a group with video metadata
```sql
SELECT 
  w.*,
  p.name as user_name,
  p.avatar_url,
  t.thumbnail_url,
  t.duration_seconds
FROM waffles w
JOIN profiles p ON w.user_id = p.id
LEFT JOIN transcripts t ON w.content_url = t.content_url
WHERE w.group_id = $1
ORDER BY w.created_at DESC;
```

### Semantic search across videos
```sql
SELECT 
  w.*,
  t.text as transcript,
  t.embedding <=> $1::vector as similarity
FROM waffles w
JOIN transcripts t ON w.content_url = t.content_url
WHERE t.embedding <=> $1::vector < 0.8
ORDER BY similarity;
``` 