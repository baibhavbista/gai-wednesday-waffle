-- Drop the trigger first
DROP TRIGGER IF EXISTS trigger_set_waffle_expiration ON public.waffles;

-- Drop the trigger function
DROP FUNCTION IF EXISTS set_waffle_expiration();

-- Remove retention-related columns
ALTER TABLE public.waffles
  DROP COLUMN IF EXISTS retention_type,
  DROP COLUMN IF EXISTS expires_at;

-- Drop the index on expires_at
DROP INDEX IF EXISTS idx_waffles_expires_at;

-- Update RLS policy to remove expiration check
DROP POLICY IF EXISTS "Users can read waffles in groups they belong to" ON public.waffles;

CREATE POLICY "Users can read waffles in groups they belong to" ON public.waffles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = waffles.group_id AND user_id = auth.uid()
    )
  ); 