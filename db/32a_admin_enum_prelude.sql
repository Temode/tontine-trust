-- =====================================================================
-- Phase B — Prélude enum (à exécuter SEUL, dans une transaction séparée)
-- Ajoute :
--   * member_status : 'suspended'
--   * notification_kind : member_suspended, member_reactivated,
--                         member_kicked, permissions_changed,
--                         ownership_transferred
-- Postgres exige que ces nouvelles valeurs soient COMMITTED avant
-- d'être utilisables dans db/32_*.sql / db/33_*.sql / db/34_*.sql.
-- =====================================================================
alter type public.member_status      add value if not exists 'suspended';
alter type public.notification_kind  add value if not exists 'member_suspended';
alter type public.notification_kind  add value if not exists 'member_reactivated';
alter type public.notification_kind  add value if not exists 'member_kicked';
alter type public.notification_kind  add value if not exists 'permissions_changed';
alter type public.notification_kind  add value if not exists 'ownership_transferred';