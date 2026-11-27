-- Server-side date rules, so the API can't be used around the app.
--   * Cyprus races: check in / submit only from race day (Cyprus time); TBC races stay closed.
--   * Race abroad: needs a date inside the season, and not in the future.
--   * Race plans abroad: date inside the season.
--   * Test accounts (profiles.is_test) skip the date checks: they live on profiles.test_today.
-- Safe to run more than once. When a TBC date is announced, update public.race_calendar
-- (and data/races.json) — see the insert at the end.

create table if not exists public.race_calendar (
  race_id   text primary key,
  race_date date            -- null = date not announced yet
);
alter table public.race_calendar enable row level security;
drop policy if exists "calendar: read" on public.race_calendar;
create policy "calendar: read" on public.race_calendar for select to authenticated using (true);
revoke all on public.race_calendar from anon;
grant select on public.race_calendar to authenticated;

create or replace function public.season_year()
returns int language sql immutable as $$ select 2027 $$;

create or replace function public.check_race_dates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Nicosia')::date;
  d date;
  known boolean;
begin
  if public.is_admin() and new.user_id <> auth.uid() then return new; end if;   -- reviewing
  if coalesce((select p.is_test from public.profiles p where p.id = new.user_id), false) then return new; end if;
  if tg_op = 'UPDATE' and new.status = 'verified' then return new; end if;    -- photo change on a verified result

  if new.race_id like 'abroad-%' then
    if new.abroad_date is null then
      raise exception 'Add the date of your race abroad';
    end if;
    if extract(year from new.abroad_date) <> public.season_year() then
      raise exception 'The race abroad has to be in the % season', public.season_year();
    end if;
    if new.abroad_date > today then
      raise exception 'This race is still ahead. Check in on race day.';
    end if;
    return new;
  end if;

  select true, c.race_date into known, d from public.race_calendar c where c.race_id = new.race_id;
  if not coalesce(known, false) then
    raise exception 'This race is not on the % calendar', public.season_year();
  end if;
  if d is null or d > today then
    raise exception 'This race is still ahead. Check in on race day.';
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_dates on public.submissions;
create trigger submissions_dates
  before insert or update on public.submissions
  for each row execute function public.check_race_dates();

create or replace function public.check_plan_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if extract(year from new.race_date) <> public.season_year()
     and not coalesce((select p.is_test from public.profiles p where p.id = new.user_id), false) then
    raise exception 'The race abroad has to be in the % season', public.season_year();
  end if;
  return new;
end;
$$;

drop trigger if exists abroad_plans_date on public.abroad_plans;
create trigger abroad_plans_date
  before insert or update on public.abroad_plans
  for each row execute function public.check_plan_date();

-- Season 2027 calendar (same as data/races.json). Larnaka and Ayia Napa: date TBC.
insert into public.race_calendar (race_id, race_date) values
  ('nicosia-2027',   '2027-01-24'),
  ('paphos-2027',    '2027-02-28'),
  ('limassol-2027',  '2027-04-04'),
  ('larnaka-2027',   null),
  ('ayia-napa-2027', null)
on conflict (race_id) do update set race_date = excluded.race_date;
