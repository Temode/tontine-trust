
-- Storage policies pour le bucket chat-attachments
-- Path: {group_id}/{user_id}/<uuid>.<ext>

drop policy if exists "chat_attach_read_members" on storage.objects;
create policy "chat_attach_read_members" on storage.objects
  for select to authenticated using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = ((storage.foldername(name))[1])::uuid
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
  );

drop policy if exists "chat_attach_upload_members" on storage.objects;
create policy "chat_attach_upload_members" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = ((storage.foldername(name))[1])::uuid
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
  );

drop policy if exists "chat_attach_delete_own" on storage.objects;
create policy "chat_attach_delete_own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
