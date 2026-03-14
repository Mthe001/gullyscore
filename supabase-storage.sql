-- GullyScore Pro - Profile avatar storage setup
-- Run this in the Supabase SQL Editor after your base schema

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar images are public" on storage.objects;
create policy "Avatar images are public"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-logos',
  'team-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Team logos are public" on storage.objects;
create policy "Team logos are public"
on storage.objects
for select
to public
using (bucket_id = 'team-logos');

drop policy if exists "Authenticated users can upload team logos" on storage.objects;
create policy "Authenticated users can upload team logos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'team-logos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Authenticated users can update team logos" on storage.objects;
create policy "Authenticated users can update team logos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'team-logos'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'team-logos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Authenticated users can delete team logos" on storage.objects;
create policy "Authenticated users can delete team logos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'team-logos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
