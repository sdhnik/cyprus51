-- Race page: a runner may add, replace or remove the finish photo of a verified result.
-- Safe to run more than once.
create or replace function public.submissions_guard()
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
    -- the finish photo is the runner's own, everything else is locked
    if (to_jsonb(new) - 'photo_path' - 'updated_at') is distinct from (to_jsonb(old) - 'photo_path' - 'updated_at') then
      raise exception 'A verified result can no longer be changed';
    end if;
    return new;
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
