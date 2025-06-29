-- Migration 14: Create transcripts table and drop redundant ai_caption column
-- Run in Supabase SQL editor or via migration tooling

-- 1) Remove redundant `ai_caption` column if it still exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns 
        WHERE table_name = 'waffles' 
          AND table_schema = 'public'
          AND column_name = 'ai_caption'
    ) THEN
        ALTER TABLE public.waffles DROP COLUMN ai_caption;
    END IF;
END$$;

-- 2) Ensure the pgvector extension is available (one-time per DB)
CREATE EXTENSION IF NOT EXISTS "vector";

-- 3) Create the `transcripts` table (one row per unique video)
CREATE TABLE public.transcripts (
    content_url TEXT PRIMARY KEY,                 -- identical to waffles.content_url
    text        TEXT        NOT NULL,             -- full transcript (or first chunk)
    embedding   VECTOR(1536),                     -- OpenAI embedding dimension
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4) Approximate-nearest-neighbour index for semantic search
CREATE INDEX transcripts_embedding_idx
    ON public.transcripts
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ✅ End of Migration 14 