-- =====================================================================
-- Tontine Digital — Prélude P2.5 : enum notification_kind (review)
-- À exécuter SEUL, AVANT db/29_member_reviews.sql
-- (Postgres exige un commit avant d'utiliser une nouvelle valeur d'enum)
-- Idempotent.
-- =====================================================================

alter type public.notification_kind add value if not exists 'review_received';