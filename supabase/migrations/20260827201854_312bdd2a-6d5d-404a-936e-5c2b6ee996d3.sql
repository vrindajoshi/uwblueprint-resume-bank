create policy "resumes_read_own_or_admin" on storage.objects
for select to authenticated
using (
  bucket_id = 'resumes'
  and (public.is_admin() or (storage.foldername(name))[1] = public.jwt_email())
);

create policy "resumes_write_own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = public.jwt_email()
  and lower(right(name, 4)) = '.pdf'
);

create policy "resumes_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'resumes' and (storage.foldername(name))[1] = public.jwt_email())
with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = public.jwt_email());

create policy "resumes_delete_own_or_admin" on storage.objects
for delete to authenticated
using (
  bucket_id = 'resumes'
  and (public.is_admin() or (storage.foldername(name))[1] = public.jwt_email())
);