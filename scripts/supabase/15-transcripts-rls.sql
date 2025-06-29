-- Migration 15: RLS policies for `public.transcripts`
-- Ensures users can only read transcripts for videos present in groups they belong to

-- 1) Enable Row Level Security
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- 2) Select policy: user must belong to any group that has a waffle referencing this video
CREATE POLICY "transcripts_select_group_member" ON public.transcripts
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.waffles w
        JOIN public.group_members gm ON gm.group_id = w.group_id
        WHERE w.content_url = transcripts.content_url
          AND gm.user_id = auth.uid()
      )
    );

-- Note: INSERT/UPDATE/DELETE will be performed by the backend service role, which bypasses RLS.
-- ✅ End of Migration 15 