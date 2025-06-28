-- Waffles (Messages) - CORE TABLE
CREATE TABLE public.waffles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  content_url TEXT, -- Storage URL for video/photo
  content_type TEXT CHECK (content_type IN ('video', 'photo')),
  caption TEXT,
  retention_type TEXT DEFAULT '7_days' CHECK (retention_type IN ('view_once', '7_days', 'forever')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  ai_caption TEXT, -- AI-generated caption
  ai_transcript TEXT, -- AI-generated transcript for videos
  ai_summary TEXT -- AI catch-up summary context
);

-- Enable RLS
ALTER TABLE public.waffles ENABLE ROW LEVEL SECURITY;

-- Function to set expiration date based on retention type
CREATE OR REPLACE FUNCTION set_waffle_expiration()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.retention_type
    WHEN 'view_once' THEN
      NEW.expires_at := NEW.created_at + INTERVAL '24 hours'; -- Grace period for view_once
    WHEN '7_days' THEN
      NEW.expires_at := NEW.created_at + INTERVAL '7 days';
    WHEN 'forever' THEN
      NEW.expires_at := NULL; -- Never expires
  END CASE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_waffle_expiration
  BEFORE INSERT OR UPDATE ON public.waffles
  FOR EACH ROW EXECUTE FUNCTION set_waffle_expiration();

-- RLS Policies
CREATE POLICY "Users can read waffles in groups they belong to" ON public.waffles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = waffles.group_id AND user_id = auth.uid()
    )
    AND (expires_at IS NULL OR expires_at > NOW()) -- Only show non-expired waffles
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
CREATE INDEX idx_waffles_expires_at ON public.waffles(expires_at) WHERE expires_at IS NOT NULL; 