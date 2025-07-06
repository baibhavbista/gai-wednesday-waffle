-- Add thumbnail_url column to waffles table for storing video thumbnails
ALTER TABLE public.waffles 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add comment to document the column
COMMENT ON COLUMN public.waffles.thumbnail_url IS 'URL of the generated thumbnail image for videos';

-- Create index for performance when querying waffles with thumbnails
CREATE INDEX IF NOT EXISTS idx_waffles_thumbnail_url ON public.waffles(thumbnail_url) WHERE thumbnail_url IS NOT NULL; 