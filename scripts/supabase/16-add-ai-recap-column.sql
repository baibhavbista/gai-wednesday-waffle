-- Add ai_recap column to transcripts table
-- This will store AI-generated 80-word summaries of waffle content

ALTER TABLE public.transcripts 
ADD COLUMN ai_recap TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN public.transcripts.ai_recap IS 'AI-generated 80-word summary of the waffle content for catch-up recaps';

-- Update RLS policies to include the new column (if needed)
-- The existing policies should automatically cover this new column 