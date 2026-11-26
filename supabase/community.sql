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
