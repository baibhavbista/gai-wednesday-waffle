-- Add duration_seconds column to waffles table for storing video duration
ALTER TABLE public.waffles 
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Add comment to document the column
COMMENT ON COLUMN public.waffles.duration_seconds IS 'Duration of the video in seconds, extracted during processing';

-- Create index for performance when querying/filtering by duration
CREATE INDEX IF NOT EXISTS idx_waffles_duration ON public.waffles(duration_seconds) WHERE duration_seconds IS NOT NULL;

-- Update existing video waffles to have a default duration (will be updated when videos are reprocessed)
-- Using 180 seconds (3 minutes) as a reasonable default for existing content
UPDATE public.waffles 
SET duration_seconds = 180 
WHERE content_type = 'video' 
  AND duration_seconds IS NULL; 