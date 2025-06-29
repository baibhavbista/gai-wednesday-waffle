-- scripts/supabase/12-get-caption-history-function.sql

-- This function retrieves the 3 most recent, non-default captions for the currently authenticated user.
-- It's designed to be called via RPC from the client-side application to personalize AI caption suggestions.

create or replace function get_user_caption_history()
returns table (caption text)
language sql
security definer
set search_path = public
as $$
  select
    w.caption
  from
    public.waffles as w
  where
    w.user_id = auth.uid()
    and w.caption is not null
    and w.caption <> 'Check out my waffle! 🧇' -- Exclude the default caption
  order by
    w.created_at desc
  limit 3;
$$;

-- Grant execution rights to the 'authenticated' role so that logged-in users can call this function.
grant execute on function public.get_user_caption_history() to authenticated;

-- Example of how to call this function from the client (for documentation purposes):
-- const { data, error } = await supabase.rpc('get_user_caption_history'); 