drop policy if exists "avatars_read_public" on storage.objects;
drop policy if exists "avatars_upload_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

create policy "avatars_read_authenticated" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');
create policy "avatars_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "proofs_read_own_or_organizer" on storage.objects;
drop policy if exists "proofs_upload_member" on storage.objects;
drop policy if exists "proofs_update_own" on storage.objects;
drop policy if exists "proofs_delete_own" on storage.objects;

create policy "proofs_read_own_or_organizer" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (
        select 1 from public.groups g
        where g.id::text = (storage.foldername(name))[1]
          and g.created_by = auth.uid()
      )
    )
  );

create policy "proofs_upload_member" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.group_members gm
      where gm.group_id::text = (storage.foldername(name))[1]
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
  );

create policy "proofs_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'payment-proofs' and (storage.foldername(name))[2] = auth.uid()::text);

create policy "proofs_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-proofs' and (storage.foldername(name))[2] = auth.uid()::text);