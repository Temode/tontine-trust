-- =====================================================================
-- Phase G.3 — FK explicites vers public.profiles pour PostgREST embeds
--
-- Constat (test E2E) : les requêtes
--   group_members?select=...,profile:profiles(...)
--   turns?select=...,beneficiary:profiles!turns_beneficiary_user_id_fkey(...)
--   contributions?select=...,profile:profiles!contributions_payer_user_id_fkey(...)
-- échouent en 400 PGRST200 :
--   "Could not find a relationship between 'X' and 'profiles'".
--
-- Cause : les colonnes *_user_id référencent `auth.users(id)`, pas
-- `public.profiles(id)`. PostgREST ne peut pas inférer la jointure
-- vers profiles. Conséquence visible : "0 membres actifs" sur la fiche
-- groupe alors que la liste agrégée en compte 1+.
--
-- Correctif : ajouter une FK additionnelle vers public.profiles(id),
-- avec le NOM attendu par le code client. profiles.id = auth.users.id
-- (1:1 via le trigger handle_new_user), donc l'intégrité est préservée.
-- Idempotent.
-- =====================================================================

do $$ begin
  alter table public.group_members
    add constraint group_members_user_id_profile_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.turns
    add constraint turns_beneficiary_user_id_fkey
    foreign key (beneficiary_user_id) references public.profiles(id) on delete restrict;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.contributions
    add constraint contributions_payer_user_id_fkey
    foreign key (payer_user_id) references public.profiles(id) on delete restrict;
exception when duplicate_object then null; end $$;

-- Recharge le cache de schéma de PostgREST pour prise en compte immédiate
notify pgrst, 'reload schema';

-- =====================================================================
-- Fin Phase G.3
-- =====================================================================