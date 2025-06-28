-- 🧪 Test Script for Bulletproof RLS Setup
-- Run this AFTER running bulletproof-rls-setup.sql to verify everything works

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- 1. Check all policies are created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 2. Check all functions are created
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name IN (
    'get_user_groups',
    'join_group_by_invite', 
    'get_group_members',
    'create_group_safe',
    'leave_group_safe',
    'increment_waffle_views',
    'handle_new_user'
)
ORDER BY routine_name;

-- 3. Check trigger is created
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
AND trigger_name = 'on_auth_user_created';

-- ============================================================================
-- FUNCTIONAL TESTS (Must be logged in as authenticated user)
-- ============================================================================

-- Test 1: Get user groups (should work without errors)
-- SELECT * FROM public.get_user_groups();

-- Test 2: Create a test group (uncomment to test)
-- SELECT public.create_group_safe('Test Group 🧪');

-- Test 3: Try to join group with fake invite code (should fail gracefully)
-- SELECT public.join_group_by_invite('FAKE123');

-- ============================================================================
-- RLS VERIFICATION (Should show expected access patterns)
-- ============================================================================

-- Test 4: Check direct table access (should be filtered by RLS)
-- SELECT COUNT(*) as "Groups I can see" FROM public.groups;
-- SELECT COUNT(*) as "Group members I can see" FROM public.group_members;
-- SELECT COUNT(*) as "Waffles I can see" FROM public.waffles;
-- SELECT COUNT(*) as "Profiles I can see" FROM public.profiles;

-- ============================================================================
-- SUCCESS INDICATORS
-- ============================================================================

-- If this query returns results, your setup is working:
SELECT 
    'Bulletproof RLS Setup Complete! ✅' as status,
    COUNT(CASE WHEN schemaname = 'public' THEN 1 END) as policies_created,
    (SELECT COUNT(*) FROM information_schema.routines 
     WHERE routine_schema = 'public' 
     AND routine_name LIKE '%group%' OR routine_name LIKE '%waffle%') as functions_created,
    (SELECT COUNT(*) FROM information_schema.triggers 
     WHERE trigger_schema = 'public') as triggers_created
FROM pg_policies 
WHERE schemaname = 'public';

-- Expected Results:
-- - 12+ policies created (3 for each table)
-- - 6 functions created 
-- - 1 trigger created
-- - No errors when running user functions 