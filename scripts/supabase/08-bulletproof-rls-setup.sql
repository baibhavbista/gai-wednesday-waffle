-- 🚀 BULLETPROOF RLS SETUP - Wednesday Waffle
-- This script implements a two-tier security system that eliminates circular dependencies
-- Run this in your Supabase SQL Editor after cleaning up all existing policies

-- ============================================================================
-- STEP 1: PROFILES TABLE - Simple and Safe
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (needed for displaying names/avatars in groups)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can insert their own profile (for registration)
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ============================================================================
-- STEP 2: GROUPS TABLE - Creator-Focused
-- ============================================================================
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Users can read groups they created OR are members of
-- NOTE: This uses a direct EXISTS check to avoid circular dependency
CREATE POLICY "groups_select_member_or_creator" ON public.groups
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid() 
    OR 
    EXISTS (
      SELECT 1 FROM public.group_members gm 
      WHERE gm.group_id = id AND gm.user_id = auth.uid()
    )
  );

-- Users can create groups (they become the creator)
CREATE POLICY "groups_insert_own" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Only creators can update their groups
CREATE POLICY "groups_update_creator" ON public.groups
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Only creators can delete their groups
CREATE POLICY "groups_delete_creator" ON public.groups
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ============================================================================
-- STEP 3: GROUP_MEMBERS TABLE - The Key to Breaking Circular Dependencies
-- ============================================================================
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- 🔑 CRITICAL: Permissive read policy - this breaks the circular dependency!
-- Users can read ALL group memberships, but app logic controls what they see
CREATE POLICY "group_members_select_authenticated" ON public.group_members
  FOR SELECT TO authenticated
  USING (true);

-- Users can only insert their own memberships (join groups)
CREATE POLICY "group_members_insert_own" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can only delete their own memberships (leave groups)
CREATE POLICY "group_members_delete_own" ON public.group_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Group creators can delete any membership in their groups (kick members)
CREATE POLICY "group_members_delete_creator" ON public.group_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

-- ============================================================================
-- STEP 4: WAFFLES TABLE - Group-Based Access
-- ============================================================================
ALTER TABLE public.waffles ENABLE ROW LEVEL SECURITY;

-- Users can read waffles in groups they're members of
CREATE POLICY "waffles_select_group_member" ON public.waffles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm 
      WHERE gm.group_id = waffles.group_id AND gm.user_id = auth.uid()
    )
  );

-- Users can create waffles in groups they're members of
CREATE POLICY "waffles_insert_group_member" ON public.waffles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND 
    EXISTS (
      SELECT 1 FROM public.group_members gm 
      WHERE gm.group_id = waffles.group_id AND gm.user_id = auth.uid()
    )
  );

-- Users can update their own waffles
CREATE POLICY "waffles_update_own" ON public.waffles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own waffles
CREATE POLICY "waffles_delete_own" ON public.waffles
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- STEP 5: HELPER FUNCTIONS (Application-Level Security)
-- ============================================================================

-- Function to safely get user's groups with member counts
CREATE OR REPLACE FUNCTION public.get_user_groups()
RETURNS TABLE (
  id uuid,
  name text,
  invite_code text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  member_count bigint,
  is_creator boolean
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    g.id,
    g.name,
    g.invite_code,
    g.created_by,
    g.created_at,
    g.updated_at,
    COUNT(gm.user_id) as member_count,
    (g.created_by = auth.uid()) as is_creator
  FROM groups g
  INNER JOIN group_members gm ON g.id = gm.group_id
  WHERE gm.user_id = auth.uid()
  GROUP BY g.id, g.name, g.invite_code, g.created_by, g.created_at, g.updated_at
  ORDER BY g.created_at DESC;
$$;

-- Function to safely join group by invite code
CREATE OR REPLACE FUNCTION public.join_group_by_invite(invite_code_param text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_group_id uuid;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Find group by invite code
  SELECT id INTO target_group_id
  FROM groups
  WHERE invite_code = UPPER(invite_code_param);
  
  IF target_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  
  -- Insert membership (ignore if already exists)
  INSERT INTO group_members (group_id, user_id)
  VALUES (target_group_id, current_user_id)
  ON CONFLICT (group_id, user_id) DO NOTHING;
  
  RETURN target_group_id;
END;
$$;

-- Function to safely get group members (only if user is a member)
CREATE OR REPLACE FUNCTION public.get_group_members(group_uuid uuid)
RETURNS TABLE (
  user_id uuid,
  user_name text,
  user_avatar text,
  joined_at timestamptz,
  is_creator boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- First verify the requesting user is a member of this group
  SELECT 
    gm.user_id,
    COALESCE(p.name, 'Unknown User') as user_name,
    p.avatar_url as user_avatar,
    gm.joined_at,
    (g.created_by = gm.user_id) as is_creator
  FROM group_members gm
  LEFT JOIN profiles p ON gm.user_id = p.id
  LEFT JOIN groups g ON gm.group_id = g.id
  WHERE gm.group_id = group_uuid
  AND EXISTS (
    SELECT 1 FROM group_members check_member 
    WHERE check_member.group_id = group_uuid 
    AND check_member.user_id = auth.uid()
  )
  ORDER BY is_creator DESC, gm.joined_at ASC;
$$;

-- Function to safely create a group (with auto-membership)
CREATE OR REPLACE FUNCTION public.create_group_safe(group_name text)
RETURNS TABLE (
  id uuid,
  name text,
  invite_code text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_group_id uuid;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Create the group
  INSERT INTO groups (name, created_by)
  VALUES (group_name, current_user_id)
  RETURNING groups.id INTO new_group_id;
  
  -- Add creator as member
  INSERT INTO group_members (group_id, user_id)
  VALUES (new_group_id, current_user_id);
  
  -- Return the complete group data
  RETURN QUERY
  SELECT 
    g.id,
    g.name,
    g.invite_code,
    g.created_by,
    g.created_at,
    g.updated_at
  FROM groups g
  WHERE g.id = new_group_id;
END;
$$;

-- Function to safely leave a group
CREATE OR REPLACE FUNCTION public.leave_group_safe(group_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  is_creator boolean;
  member_count integer;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Check if user is the creator
  SELECT (created_by = current_user_id) INTO is_creator
  FROM groups
  WHERE id = group_uuid;
  
  -- If creator, check if they're the only member
  IF is_creator THEN
    SELECT COUNT(*) INTO member_count
    FROM group_members
    WHERE group_id = group_uuid;
    
    -- If creator is the only member, delete the entire group
    IF member_count = 1 THEN
      DELETE FROM groups WHERE id = group_uuid;
      RETURN true;
    ELSE
      RAISE EXCEPTION 'Cannot leave group as creator while other members exist';
    END IF;
  END IF;
  
  -- Remove user from group
  DELETE FROM group_members
  WHERE group_id = group_uuid AND user_id = current_user_id;
  
  RETURN true;
END;
$$;

-- ============================================================================
-- STEP 6: GRANT PERMISSIONS
-- ============================================================================

-- Function to safely increment waffle views
CREATE OR REPLACE FUNCTION public.increment_waffle_views(waffle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only increment if user is authenticated and can access the waffle
  UPDATE waffles 
  SET view_count = view_count + 1 
  WHERE id = waffle_id
  AND EXISTS (
    SELECT 1 FROM group_members gm 
    WHERE gm.group_id = waffles.group_id 
    AND gm.user_id = auth.uid()
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_groups() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_group_by_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_safe(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_group_safe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_waffle_views(uuid) TO authenticated;

-- ============================================================================
-- STEP 7: CREATE TRIGGER FOR AUTOMATIC PROFILE CREATION
-- ============================================================================

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- VERIFICATION QUERIES (for testing)
-- ============================================================================

-- Test query to verify policies are working
-- SELECT 'Bulletproof RLS Setup Complete!' as status;

-- Uncomment these to test after setup:
-- SELECT * FROM public.get_user_groups();
-- SELECT public.join_group_by_invite('TEST123');
-- SELECT * FROM public.get_group_members('your-group-id-here'); 