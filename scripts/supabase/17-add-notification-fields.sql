-- Add notification fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_permission_requested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_waffle_week TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.notifications_enabled IS 'User preference for Wednesday nudge notifications';
COMMENT ON COLUMN public.profiles.notification_permission_requested IS 'Track if we have asked for notification permission';
COMMENT ON COLUMN public.profiles.last_waffle_week IS 'ISO week format (YYYY-W##) of last waffle post for notification logic'; 