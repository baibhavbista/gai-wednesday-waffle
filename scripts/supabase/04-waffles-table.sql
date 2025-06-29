-- Waffles (Messages) - CORE TABLE
CREATE TABLE public.waffles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  content_url TEXT, -- Storage URL for video/photo
  content_type TEXT CHECK (content_type IN ('video', 'photo', 'text')),
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  view_count INTEGER DEFAULT 0,
  ai_caption TEXT, -- AI-generated caption
  ai_transcript TEXT, -- AI-generated transcript for videos
  ai_summary TEXT -- AI catch-up summary context
);

-- Enable RLS
ALTER TABLE public.waffles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read waffles in groups they belong to" ON public.waffles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = waffles.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create waffles in groups they belong to" ON public.waffles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = waffles.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own waffles" ON public.waffles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own waffles" ON public.waffles
  FOR DELETE USING (auth.uid() = user_id);

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_waffle_views(waffle_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.waffles 
  SET view_count = view_count + 1 
  WHERE id = waffle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Index for performance
CREATE INDEX idx_waffles_group_created ON public.waffles(group_id, created_at DESC); 