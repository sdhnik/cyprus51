-- Cyprus 5+1 — database schema
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to read top to bottom: tables, rules (RLS), functions, storage.

-- ─────────────────────────────────────────────────────────────
-- 1. Profiles: one row per account, created automatically at sign-up
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text not null check (char_length(display_name) between 1 and 60),
  is_admin           boolean not null default false,
  adult_confirmed_at timestamptz not null,
  terms_version      text not null default '2026-12',
  created_at         timestamptz not null default now()
);

-- Sign-up sends: options.data = { display_name: 'Alex', adult_confirmed: true }
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'adult_confirmed', 'false') <> 'true' then
    raise exception 'Sign-up requires confirming you are 18 or older';
  end if;
  insert into public.profiles (id, display_name, adult_confirmed_at)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    now()
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Used inside rules below. security definer so it can read profiles past RLS.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Submissions: check-in → pending (link added) → verified / rejected
-- ─────────────────────────────────────────────────────────────
create type public.submission_status as enum ('checked_in', 'pending', 'verified', 'rejected');

create table public.submissions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  race_id         text not null check (race_id ~ '^[a-z0-9-]{3,60}$'),   -- id from races.json, e.g. 'nicosia-2027'
  status          public.submission_status not null default 'checked_in',

  watch_time_s    integer check (watch_time_s between 1800 and 14400),    -- step 1, from the runner's watch
  official_time_s integer check (official_time_s between 1800 and 14400), -- step 2, chip time
  result_url      text check (result_url ~ '^https://'),
  bib             text check (char_length(bib) <= 12),
  place           integer check (place > 0),
  place_of        integer check (place_of > 0),

  photo_path      text,   -- storage: photos/<user_id>/...
  gpx_path        text,   -- storage: gpx/<user_id>/... (race abroad)

  abroad_name     text check (char_length(abroad_name) <= 120),          -- race abroad only
  abroad_date     date,
  abroad_country  text check (char_length(abroad_country) <= 60),

  reject_reason   text check (char_length(reject_reason) <= 300),
  reviewed_by     uuid references public.profiles (id) on delete set null,
  reviewed_at     timestamptz,

  checked_in_at   timestamptz not null default now(),
  submitted_at    timestamptz,
  updated_at      timestamptz not null default now(),

  unique (user_id, race_id),
  check (place is null or place_of is null or place <= place_of),
  check (status = 'checked_in' or (result_url is not null and official_time_s is not null)),
  check (status <> 'rejected' or reject_reason is not null)
);

create index submissions_queue_idx on public.submissions (status, submitted_at) where status = 'pending';
create index submissions_race_idx  on public.submissions (race_id) where status = 'verified';

-- Guards what a runner may change. Admins pass through; their verdict gets stamped.
create function public.submissions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin boolean := public.is_admin();
begin
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.user_id := old.user_id;
    new.race_id := old.race_id;
    new.checked_in_at := old.checked_in_at;
  end if;

  if admin and new.user_id <> auth.uid() then
    -- reviewing someone else's result
    if tg_op = 'UPDATE' and new.status in ('verified', 'rejected') and new.status is distinct from old.status then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
    if new.status = 'verified' then new.reject_reason := null; end if;
    return new;
  end if;

  -- runner (also an admin editing their own result)
  if tg_op = 'UPDATE' and old.status = 'verified' then
    raise exception 'A verified result can no longer be changed';
  end if;
  if new.status not in ('checked_in', 'pending') then
    raise exception 'Only an admin can verify or reject a result';
  end if;
  if tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'checked_in' then
    raise exception 'A submitted result cannot go back to check-in';
  end if;

  new.reviewed_by := case when tg_op = 'UPDATE' then old.reviewed_by end;
  new.reviewed_at := case when tg_op = 'UPDATE' then old.reviewed_at end;
  new.reject_reason := null;  -- resubmitting clears the old reason

  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    new.submitted_at := now();
  elsif tg_op = 'UPDATE' then
    new.submitted_at := old.submitted_at;
  end if;

  return new;
end;
$$;

create trigger submissions_guard
  before insert or update on public.submissions
  for each row execute function public.submissions_guard();

-- ─────────────────────────────────────────────────────────────
-- 3. Row level security: who can see and change what
-- ─────────────────────────────────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.submissions enable row level security;

create policy "profiles: read own, admin reads all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Table access for the API (RLS above still decides which rows).
-- Runners may only change their display name, never is_admin.
revoke all on public.profiles, public.submissions from anon;
revoke update on public.profiles from authenticated;
grant  select on public.profiles to authenticated;
grant  update (display_name) on public.profiles to authenticated;
grant  select, insert, update, delete on public.submissions to authenticated;

create policy "submissions: read own, admin reads all"
  on public.submissions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "submissions: insert own"
  on public.submissions for insert to authenticated
  with check (user_id = auth.uid());

create policy "submissions: update own, admin updates all"
  on public.submissions for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "submissions: delete own unverified"
  on public.submissions for delete to authenticated
  using (user_id = auth.uid() and status <> 'verified');

-- ─────────────────────────────────────────────────────────────
-- 4. Functions the site calls
-- ─────────────────────────────────────────────────────────────

-- Anonymous finish-time distribution for one race, from verified Cyprus 5+1 results only.
-- Returns null below 5 results, so nobody can be singled out.
create function public.race_stats(p_race_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select official_time_s as t, user_id
    from public.submissions
    where race_id = p_race_id and status = 'verified'
  ),
  me as (select t from v where user_id = auth.uid())
  select case when (select count(*) from v) < 5 then null else jsonb_build_object(
    'count', (select count(*) from v),
    'bins', (
      select jsonb_agg(jsonb_build_object('from_s', b, 'n', n) order by b)
      from (select (t / 300) * 300 as b, count(*) as n from v group by 1) x
    ),
    'my_time_s', (select t from me),
    'slower_than_me_pct', (
      select round(100.0 * count(*) filter (where v.t > me.t) / nullif(count(*), 0))
      from v, me
    )
  ) end;
$$;

-- Deletes the caller's account and, through cascades, their profile and results.
-- The site removes the caller's files from storage first, then calls this.
create function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

-- Tiny query for the daily keep-alive job (GitHub Actions).
create function public.ping()
returns integer
language sql
stable
as $$ select 1; $$;

revoke execute on function public.race_stats(text)      from public, anon;
revoke execute on function public.delete_my_account()   from public, anon;
grant  execute on function public.race_stats(text)      to authenticated;
grant  execute on function public.delete_my_account()   to authenticated;
grant  execute on function public.ping()                to anon, authenticated;
revoke execute on function public.handle_new_user()     from public, anon, authenticated;
revoke execute on function public.submissions_guard()   from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. Storage: private buckets, each runner owns the folder named after their id
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', false, 1048576, array['image/jpeg', 'image/webp']),            -- ~300 KB after compression, 1 MB cap
  ('gpx',    'gpx',    false, 5242880, array['application/gpx+xml', 'application/xml', 'text/xml', 'application/octet-stream']);

-- Finish photos: only the runner, never admins.
create policy "photos: own folder"
  on storage.objects for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- GPX of a race abroad: the runner, plus admins to check it.
create policy "gpx: own folder"
  on storage.objects for all to authenticated
  using (bucket_id = 'gpx' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'gpx' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "gpx: admin reads"
  on storage.objects for select to authenticated
  using (bucket_id = 'gpx' and public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 6. After your own sign-up on the site, make yourself admin:
--    update public.profiles set is_admin = true where id = (select id from auth.users where email = 'YOUR@EMAIL');
-- ─────────────────────────────────────────────────────────────
-- Anonymous season numbers for the "The challenge" card:
-- how many runners, how many have 0…6 stamps, and where the caller is.
create or replace function public.community_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with per_runner as (
    select p.id, least(count(s.id) filter (where s.status = 'verified'), 6) as stamps
    from public.profiles p
    left join public.submissions s on s.user_id = p.id
    group by p.id
  )
  select jsonb_build_object(
    'runners', (select count(*) from per_runner),
    'dist', (select jsonb_agg(coalesce(c.n, 0) order by g.k)
             from generate_series(0, 6) g(k)
             left join (select stamps, count(*) n from per_runner group by stamps) c on c.stamps = g.k),
    'my_stamps', (select stamps from per_runner where id = auth.uid()),
    'fewer_than_me', (select count(*) from per_runner where stamps < (select stamps from per_runner where id = auth.uid()))
  );
$$;

revoke execute on function public.community_stats() from public, anon;
grant  execute on function public.community_stats() to authenticated;
