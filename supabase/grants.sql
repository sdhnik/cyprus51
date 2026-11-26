-- Table access for signed-in runners. Row level security still decides WHICH rows.
-- Needed on Supabase projects where new tables are not exposed to the API automatically.
grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.submissions to authenticated;
grant usage on type public.submission_status to authenticated;
