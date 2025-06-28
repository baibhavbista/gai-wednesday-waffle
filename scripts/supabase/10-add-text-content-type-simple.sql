-- Migration: Add text content type support (Simple approach)
-- This modifies the existing content_type column to allow 'text' values

-- First, let's see what constraints exist and remove any check constraints on content_type
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find and drop any check constraints on content_type column
    FOR constraint_name IN 
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
        AND rel.relname = 'waffles'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) LIKE '%content_type%'
    LOOP
        EXECUTE 'ALTER TABLE waffles DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Add a new check constraint that includes 'text'
ALTER TABLE waffles 
ADD CONSTRAINT waffles_content_type_check 
CHECK (content_type IN ('photo', 'video', 'text'));

-- Add comments to document the change
COMMENT ON COLUMN waffles.content_type IS 'Type of waffle content: photo, video, or text';
COMMENT ON COLUMN waffles.content_url IS 'URL for media content (null for text-only waffles)';
COMMENT ON COLUMN waffles.caption IS 'Caption for media waffles or main text content for text waffles'; 