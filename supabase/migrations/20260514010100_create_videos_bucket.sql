-- METRIC.fyi · Storage bucket for uploaded videos
-- Created Day 3 (2026-05-14)
--
-- One bucket: `videos`. Public-read (so the report page can use a plain
-- <video src> without signed URLs), anon-write (so the no-signup demo
-- path works), 100 MiB cap, mime-type restricted.
--
-- Same security model as the reports table: relies on unguessable UUIDs
-- for the storage path (we use the report's UUID as the filename),
-- so URLs aren't enumerable.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  true,                                              -- public-read by URL
  104857600,                                         -- 100 MiB
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS policies (separate from table RLS)
-- Allow anyone (anon, authenticated) to upload to the videos bucket.
-- The actual size/mime checks are enforced by the bucket config above.
drop policy if exists "anon upload to videos" on storage.objects;
create policy "anon upload to videos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'videos');

-- Public read access (matches `public = true` above, but the policy is
-- still required for PostgREST queries against storage.objects).
drop policy if exists "public read videos" on storage.objects;
create policy "public read videos"
  on storage.objects for select
  to public
  using (bucket_id = 'videos');
