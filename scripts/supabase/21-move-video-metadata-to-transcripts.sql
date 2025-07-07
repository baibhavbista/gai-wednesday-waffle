-- Move video metadata to transcripts table and clean up redundant columns
-- This normalizes the data since transcripts has 1:1 relationship with videos

-- Step 1: Add columns to transcripts table
ALTER TABLE public.transcripts 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN public.transcripts.thumbnail_url IS 'URL of the generated thumbnail image for the video';
COMMENT ON COLUMN public.transcripts.duration_seconds IS 'Duration of the video in seconds';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transcripts_thumbnail_url ON public.transcripts(thumbnail_url) WHERE thumbnail_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transcripts_duration ON public.transcripts(duration_seconds) WHERE duration_seconds IS NOT NULL;

-- Step 2: Drop redundant columns from waffles table
-- These columns are now managed in the transcripts table
ALTER TABLE public.waffles 
DROP COLUMN IF EXISTS thumbnail_url,
DROP COLUMN IF EXISTS duration_seconds,
DROP COLUMN IF EXISTS ai_transcript,
DROP COLUMN IF EXISTS ai_summary,
DROP COLUMN IF EXISTS ai_caption;

-- Note: The user's custom caption stays in waffles because it's specific to each waffle post,
-- not to the video itself (users can have different captions for the same video) 