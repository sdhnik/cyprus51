-- Result emails: verified, rejected, and one reminder the day after check-in.
-- Run once in SQL Editor AFTER the notify Edge Function is deployed and the secret is saved in Vault
-- (see README → Emails). Safe to run again.

create extension if not exists pg_net;
create extension if not exists pg_cron;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- One row per email sent: stops doubles when an admin clicks twice or the reminder job runs again.
create table if not exists public.email_log (
  id       text primary key,              -- '<submission id>:verified:<reviewed_at>' or '<submission id>:reminder'
  sent_to  text not null,
  sent_at  timestamptz not null default now()
);
alter table public.email_log enable row level security;   -- no policies: only the function (service role) reads it
revoke all on public.email_log from anon, authenticated;

-- Calls the function. The secret lives in Vault, never in this file.
create or replace function private.notify(payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'notify_secret';
  if k is null then
    raise warning 'notify: Vault secret notify_secret is missing, email not sent';
    return;
  end if;
  perform net.http_post(
    url     := 'https://gsfsyfeytrlmgbhdrunx.supabase.co/functions/v1/notify',
    body    := payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', k),
    timeout_milliseconds := 10000
  );
end;
$$;
revoke all on function private.notify(jsonb) from public, anon, authenticated;

-- Verified / rejected → email. Test accounts get emails too, so the whole flow can be tried.
create or replace function private.submissions_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('verified', 'rejected') and new.status is distinct from old.status then
    perform private.notify(jsonb_build_object('kind', 'review', 'submission_id', new.id));
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_email on public.submissions;
create trigger submissions_email
  after update of status on public.submissions
  for each row execute function private.submissions_email();

-- Reminders: every day at 09:07 UTC (11:07 or 12:07 in Cyprus). The function picks check-ins older than 18 h.
select cron.unschedule(jobid) from cron.job where jobname = 'c51-reminders';
select cron.schedule('c51-reminders', '7 9 * * *', $$select private.notify('{"kind":"reminders"}'::jsonb)$$);

-- Admin buttons (Review queue → Email check).
--   'samples'   – the three emails with sample data, to the admin's own address
--   'reminders' – runs the reminder job now; test accounts get theirs without the one-day wait
create or replace function public.admin_email_check(what text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if what = 'samples' then
    select email into me from auth.users where id = auth.uid();
    perform private.notify(jsonb_build_object('kind', 'test', 'to', me));
  elsif what = 'reminders' then
    perform private.notify('{"kind":"reminders","test_now":true}'::jsonb);
  else
    raise exception 'unknown check: %', what;
  end if;
end;
$$;
revoke all on function public.admin_email_check(text) from public, anon;
grant execute on function public.admin_email_check(text) to authenticated;
