-- =====================================================================
-- Tontine Digital — P2.4 prélude : ajoute les valeurs d'enum
-- À exécuter AVANT db/28_turn_bids_auction.sql, dans une transaction séparée.
-- (Postgres exige que les nouvelles valeurs d'enum soient committées
--  avant d'être utilisées.)
-- Idempotent.
-- =====================================================================

do $$ begin
  alter type public.rotation_order add value if not exists 'auction';
end $$;

do $$ begin
  alter type public.notification_kind add value if not exists 'auction_outbid';
  alter type public.notification_kind add value if not exists 'auction_won';
  alter type public.notification_kind add value if not exists 'auction_lost';
  alter type public.notification_kind add value if not exists 'auction_closed';
end $$;
