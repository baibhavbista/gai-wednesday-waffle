-- 🔄 REALTIME SETUP - Wednesday Waffle
-- This script enables realtime functionality for all necessary tables
-- Run this AFTER setting up RLS policies

-- ============================================================================
-- STEP 1: ENABLE REALTIME ON TABLES
-- ============================================================================

-- Enable realtime on all tables that need it
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waffles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- ============================================================================
-- STEP 2: VERIFY REALTIME IS ENABLED
-- ============================================================================

-- Check which tables have realtime enabled
SELECT 
  schemaname,
  tablename,
  'realtime enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- STEP 3: IMPORTANT NOTES
-- ============================================================================

/*
🔑 REALTIME + RLS COMPATIBILITY:

For realtime to work with RLS, the user must have:
1. SELECT permissions on the table (via RLS policies)
2. The data must pass the RLS policy checks

Our current RLS setup should work with realtime because:

✅ GROUPS: Users can see groups they're members of
✅ GROUP_MEMBERS: Permissive read policy (users can see all memberships)
✅ WAFFLES: Users can see waffles in groups they're members of
✅ PROFILES: Users can see all profiles

📡 REALTIME FILTERING:

Realtime respects RLS policies, so users will only receive:
- Group updates for groups they're members of
- Member updates for groups they're in
- Waffle updates for groups they belong to
- All profile updates (as intended)

🚀 CLIENT SETUP:

Make sure your Supabase client is configured with:
- Correct project URL
- Correct anon/public key
- Realtime enabled in your Supabase dashboard

💡 TROUBLESHOOTING:

If realtime isn't working:
1. Check Supabase Dashboard > Settings > API > Realtime is enabled
2. Verify RLS policies allow SELECT on the tables
3. Check browser network tab for realtime connection
4. Test with simple SELECT queries first
*/

-- ============================================================================
-- STEP 4: TEST REALTIME (Optional)
-- ============================================================================

-- You can test realtime is working by running these in separate sessions:

-- Session 1: Listen for changes
-- SELECT * FROM waffles WHERE group_id = 'your-test-group-id';

-- Session 2: Make a change
-- INSERT INTO waffles (user_id, group_id, content_type, caption) 
-- VALUES (auth.uid(), 'your-test-group-id', 'text', 'Test message');

-- If realtime is working, Session 1 should see the change immediately

SELECT 'Realtime setup complete! 🔄' as status; 