create extension if not exists pgcrypto;

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  topic text not null check (topic in ('competing', 'sponsorship', 'tickets', 'press', 'other')),
  message text not null check (char_length(message) between 1 and 5000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  assigned_to text check (assigned_to is null or char_length(assigned_to) <= 100),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contact_submissions is
  'Messages sent through the public Tamasha SD contact form.';

alter table public.contact_submissions enable row level security;
revoke all on table public.contact_submissions from anon, authenticated;
grant select, insert, update, delete on table public.contact_submissions to service_role;

create schema if not exists private;

create table if not exists private.contact_rate_limits (
  fingerprint text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (fingerprint, window_start)
);

alter table private.contact_rate_limits enable row level security;
revoke all on table private.contact_rate_limits from public, anon, authenticated;

create or replace function public.set_contact_submission_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_contact_submission_updated_at on public.contact_submissions;
create trigger set_contact_submission_updated_at
before update on public.contact_submissions
for each row execute function public.set_contact_submission_updated_at();

create or replace function public.check_contact_rate_limit(
  p_fingerprint text,
  p_window_start timestamptz,
  p_max_requests integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  if p_max_requests < 1 or p_max_requests > 100 then
    raise exception 'Invalid rate limit';
  end if;

  insert into private.contact_rate_limits (fingerprint, window_start, request_count)
  values (p_fingerprint, p_window_start, 1)
  on conflict (fingerprint, window_start)
  do update set request_count = private.contact_rate_limits.request_count + 1
  returning request_count into current_count;

  delete from private.contact_rate_limits
  where window_start < now() - interval '1 day';

  return current_count <= p_max_requests;
end;
$$;

revoke all on function public.check_contact_rate_limit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.check_contact_rate_limit(text, timestamptz, integer) to service_role;
