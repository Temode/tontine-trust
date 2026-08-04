-- =====================================================================
-- Tontine Digital — P2.3 prélude : ajoute les valeurs d'enum
-- À exécuter AVANT db/27_turn_swaps.sql, dans une transaction séparée.
-- (Postgres exige que les nouvelles valeurs d'enum soient committées
--  avant d'être utilisées.)
-- Idempotent.
-- =====================================================================

do $$ begin
  alter type public.notification_kind add value if not exists 'swap_requested';
  alter type public.notification_kind add value if not exists 'swap_responded';
  alter type public.notification_kind add value if not exists 'swap_executed';
end $$;