-- =====================================================================
-- Phase D — Prelude enums RGPD (COMMIT séparé pour éviter 22P02)
-- À exécuter AVANT db/40_rgpd_delete_account.sql.
-- Idempotent.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'notification_kind' and e.enumlabel = 'account_deleted'
  ) then
    alter type public.notification_kind add value 'account_deleted';
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'notification_kind' and e.enumlabel = 'phone_visibility_changed'
  ) then
    alter type public.notification_kind add value 'phone_visibility_changed';
  end if;
end$$;