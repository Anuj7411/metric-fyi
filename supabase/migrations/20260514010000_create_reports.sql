-- METRIC.fyi · reports table
-- Created Day 3 (2026-05-14)
--
-- A `report` is one analysis run: one uploaded video → one virality score
-- and one breakdown. Anonymous users can create reports (no auth required —
-- the contest's "no-signup demo path" is non-negotiable). Authenticated
-- users (Day 8) can claim/save reports to their history by setting user_id.
--
-- Security model:
--   - Anon role can INSERT only with status='pending' and user_id IS NULL.
--   - Anon role CANNOT directly SELECT — all reads go through the
--     fetch_report() SECURITY DEFINER function, which enforces "id is a UUID
--     and you must know it." Standard public-by-unguessable-link pattern.
--   - Service role (Vercel deploy) is not used; everything runs under anon
--     + RLS, which is the more secure pattern.

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),

  -- Pipeline state. Day 4 transitions pending → analyzing → ready (or failed).
  status text not null default 'pending'
    check (status in ('pending', 'analyzing', 'ready', 'failed')),

  -- Where the file lives in Storage (videos bucket). Set on insert.
  storage_path text not null,
  file_name text not null,
  file_size bigint not null
    check (file_size > 0 and file_size <= 104857600), -- 100 MiB hard cap
  mime_type text not null
    check (mime_type in ('video/mp4', 'video/quicktime', 'video/webm')),

  -- Filled by analysis pipeline (Day 4).
  duration_seconds numeric,
  analysis jsonb,
  error_message text,

  -- Ownership. Null = anonymous demo report. Day 8 lets signed-in users claim.
  user_id uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at auto-bump trigger
create or replace function public.tg_reports_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tg_reports_updated_at on public.reports;
create trigger tg_reports_updated_at
  before update on public.reports
  for each row execute function public.tg_reports_set_updated_at();

-- Enable RLS — every table gets it from day one.
alter table public.reports enable row level security;

-- Anon can INSERT a pending report, but cannot claim a user_id or seed
-- analysis data. The pipeline writes the rest later via the same RLS-bypassing
-- pattern (Day 4 will need a SECURITY DEFINER function for status updates).
drop policy if exists "anon insert pending" on public.reports;
create policy "anon insert pending" on public.reports
  for insert to anon
  with check (
    user_id is null
    and status = 'pending'
    and analysis is null
    and error_message is null
  );

-- Authenticated users can also create reports (own them by setting user_id).
drop policy if exists "authenticated insert own" on public.reports;
create policy "authenticated insert own" on public.reports
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and analysis is null
    and error_message is null
  );

-- Authenticated users can SELECT their own reports (Day 8 — /history).
drop policy if exists "authenticated select own" on public.reports;
create policy "authenticated select own" on public.reports
  for select to authenticated
  using (user_id = auth.uid());

-- Note: NO direct SELECT policy for anon. They must use fetch_report().

-- Fetch a report by id. The only way anon clients read reports.
-- security definer = runs as table owner, bypassing RLS within the function.
-- The function itself filters by id, so callers can only get reports they
-- know the (unguessable v4) UUID for.
create or replace function public.fetch_report(p_id uuid)
returns public.reports
language sql stable
security definer
set search_path = public
as $$
  select * from public.reports where id = p_id limit 1;
$$;

revoke all on function public.fetch_report(uuid) from public;
grant execute on function public.fetch_report(uuid) to anon, authenticated;

-- Indexes
create index if not exists idx_reports_user_id on public.reports(user_id) where user_id is not null;
create index if not exists idx_reports_created_at on public.reports(created_at desc);

comment on table public.reports is
  'Virality analysis runs. Anon-creatable, anon-readable by id only (via fetch_report). Day 8 layers auth/history on top.';
