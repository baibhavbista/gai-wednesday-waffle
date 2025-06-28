-- Update Groups RLS Policies (run after group_members table is created)
-- Drop the temporary policy
DROP POLICY "Users can read groups they created" ON public.groups;

-- Create the proper policy that allows users to read groups they are members of
CREATE POLICY "Users can read groups they are members of" ON public.groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = id AND user_id = auth.uid()
    )
  ); 