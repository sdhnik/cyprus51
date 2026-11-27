-- Review queue for admins: submissions with the runner's name, email and verified history.
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
      select s.*, p.display_name as runner_name, u.email as runner_email,
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

create or replace function public.admin_counts()
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
  return (select jsonb_object_agg(status, n) from (select status, count(*) n from public.submissions group by status) c);
end;
$$;

revoke execute on function public.admin_submissions(public.submission_status) from public, anon;
revoke execute on function public.admin_counts() from public, anon;
grant  execute on function public.admin_submissions(public.submission_status) to authenticated;
grant  execute on function public.admin_counts() to authenticated;

-- A race abroad the runner has entered: shows up in the passport's season calendar.
create table if not exists public.abroad_plans (
  user_id    uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  race_name  text not null check (char_length(race_name) between 2 and 120),
  race_date  date not null,
  country    text not null check (char_length(country) between 2 and 60),
  website    text check (website ~ '^https://'),
  updated_at timestamptz not null default now()
);

alter table public.abroad_plans enable row level security;

drop policy if exists "abroad: own, admin reads" on public.abroad_plans;
create policy "abroad: own, admin reads" on public.abroad_plans for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "abroad: insert own" on public.abroad_plans;
create policy "abroad: insert own" on public.abroad_plans for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "abroad: update own" on public.abroad_plans;
create policy "abroad: update own" on public.abroad_plans for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "abroad: delete own" on public.abroad_plans;
create policy "abroad: delete own" on public.abroad_plans for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.abroad_plans from anon;
grant select, insert, update, delete on public.abroad_plans to authenticated;
