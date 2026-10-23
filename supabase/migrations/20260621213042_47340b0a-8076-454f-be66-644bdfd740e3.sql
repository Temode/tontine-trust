
drop policy if exists "call_recordings_read_member" on storage.objects;
create policy "call_recordings_read_member" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'call-recordings'
    and exists (
      select 1 from public.group_members gm
      where gm.user_id = auth.uid()
        and gm.status = 'active'
        and gm.group_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

drop policy if exists "call_recordings_insert_member" on storage.objects;
create policy "call_recordings_insert_member" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'call-recordings'
    and exists (
      select 1 from public.group_members gm
      where gm.user_id = auth.uid()
        and gm.status = 'active'
        and gm.group_id::text = split_part(name, '/', 1)
    )
  );

drop policy if exists "call_recordings_delete_member" on storage.objects;
create policy "call_recordings_delete_member" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'call-recordings'
    and exists (
      select 1 from public.group_members gm
      where gm.user_id = auth.uid()
        and gm.status = 'active'
        and gm.group_id::text = split_part(storage.objects.name, '/', 1)
    )
  );
