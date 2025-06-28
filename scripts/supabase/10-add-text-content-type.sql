-- Migration: Add text content type support
-- This adds 'text' as a new content type option for waffles

-- Check if content_type is an enum type, if not create it
DO $$
BEGIN
    -- Check if the enum type exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_type') THEN
        -- Create the enum type
        CREATE TYPE content_type AS ENUM ('photo', 'video', 'text');
        
        -- If the column exists and is not an enum, we need to alter it
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'waffles' AND column_name = 'content_type') THEN
            -- First add the new column with enum type
            ALTER TABLE waffles ADD COLUMN content_type_new content_type;
            
            -- Copy existing data, converting string values to enum
            UPDATE waffles SET content_type_new = content_type::content_type;
            
            -- Drop the old column and rename the new one
            ALTER TABLE waffles DROP COLUMN content_type;
            ALTER TABLE waffles RENAME COLUMN content_type_new TO content_type;
            
            -- Add NOT NULL constraint
            ALTER TABLE waffles ALTER COLUMN content_type SET NOT NULL;
        END IF;
    ELSE
        -- Enum exists, just add the new value if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'text' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'content_type')) THEN
            ALTER TYPE content_type ADD VALUE 'text';
        END IF;
    END IF;
END $$;

-- Add comments to document the change
COMMENT ON COLUMN waffles.content_type IS 'Type of waffle content: photo, video, or text';
COMMENT ON COLUMN waffles.content_url IS 'URL for media content (null for text-only waffles)';
COMMENT ON COLUMN waffles.caption IS 'Caption for media waffles or main text content for text waffles'; 