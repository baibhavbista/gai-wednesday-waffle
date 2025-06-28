-- 🧪 Test Group Creation Function
-- Run this to verify the create_group_safe function returns complete group data

-- Test the updated function (must be logged in as authenticated user)
SELECT * FROM public.create_group_safe('Test Group Creation 🧪');

-- This should return a single row with:
-- - id: generated UUID
-- - name: 'Test Group Creation 🧪'  
-- - invite_code: auto-generated 6-char code
-- - created_by: your user ID
-- - created_at: current timestamp
-- - updated_at: current timestamp

-- Clean up the test group (optional)
-- DELETE FROM groups WHERE name = 'Test Group Creation 🧪'; 