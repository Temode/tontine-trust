CREATE POLICY reads_select_group_members ON public.group_message_reads
FOR SELECT TO authenticated
USING (public.is_group_member(group_id, auth.uid()));

ALTER TABLE public.group_message_reads REPLICA IDENTITY FULL;