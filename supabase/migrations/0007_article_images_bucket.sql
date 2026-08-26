-- Bucket público para imágenes destacadas / bloques del blog admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'article-images',
  'article-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read article images" on storage.objects;
create policy "Public read article images"
  on storage.objects
  for select
  using (bucket_id = 'article-images');

drop policy if exists "Service role upload article images" on storage.objects;
create policy "Service role upload article images"
  on storage.objects
  for insert
  with check (bucket_id = 'article-images');

drop policy if exists "Service role update article images" on storage.objects;
create policy "Service role update article images"
  on storage.objects
  for update
  using (bucket_id = 'article-images');
