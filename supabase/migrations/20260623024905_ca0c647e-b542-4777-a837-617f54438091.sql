-- Lecture directe : admins uniquement (les organisateurs passent par signed URL générée serveur)
DROP POLICY IF EXISTS "Dispute exports readable by admins" ON storage.objects;
CREATE POLICY "Dispute exports readable by admins"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'dispute-exports' AND public.has_role(auth.uid(), 'admin')
);