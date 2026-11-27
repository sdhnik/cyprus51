-- Test accounts: live on a fixed day (profiles.test_today) so race-day check-in can be tried
-- any time, and never count in the community numbers. Safe to run more than once.
-- Creating the test user itself is in the block at the end; put your own password there.

alter table public.profiles add column if not exists is_test    boolean not null default false;
alter table public.profiles add column if not exists test_today date;

-- Season numbers without test accounts
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
    where not p.is_test or p.id = auth.uid()
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

-- Finish-time spread for one race, without test accounts (the caller's own time still shows)
create or replace function public.race_stats(p_race_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select s.official_time_s as t, s.user_id
    from public.submissions s
    join public.profiles p on p.id = s.user_id
    where s.race_id = p_race_id and s.status = 'verified' and (not p.is_test or p.id = auth.uid())
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

-- Review queue: tell test accounts apart (adds runner_is_test)
create or replace function public.admin_submissions(p_status public.submission_status)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.submitted_at nulls last, x.updated_at)
    from (
      select s.*, p.display_name as runner_name, u.email as runner_email, p.is_test as runner_is_test,
        (select coalesce(jsonb_agg(jsonb_build_object('race_id', v.race_id, 'time', v.official_time_s) order by v.submitted_at), '[]'::jsonb)
           from public.submissions v
          where v.user_id = s.user_id and v.status = 'verified' and v.id <> s.id) as history
      from public.submissions s
      join public.profiles p on p.id = s.user_id
      join auth.users u on u.id = s.user_id
      where s.status = p_status
      order by s.submitted_at nulls last
      limit 200
    ) x
  ), '[]'::jsonb);
end;
$$;
