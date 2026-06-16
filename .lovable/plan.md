## Rejeu complet des migrations sur le nouveau backend Cloud

### Objectif
Recréer tout le schéma Tontine Digital (enums, tables, RLS, RPC, triggers, fonctions Djomy) sur le backend Cloud fraîchement provisionné en rejouant les fichiers `db/02_*.sql` → `db/46_*.sql` dans l'ordre.

### Ordre d'exécution
Chaque migration sera créée via l'outil `supabase--migration` (approbation utilisateur) **séquentiellement**, car beaucoup dépendent l'une de l'autre (enums → tables → RPC → policies). Les préludes d'enum (`*a_*_prelude.sql`) doivent impérativement être exécutés et committés **avant** la migration principale correspondante.

Séquence détaillée :

```text
init_auth_roles.sql            (profiles, user_roles, has_role, trigger handle_new_user)
02_tontine_schema              (groups, group_members, cycles, turns, contributions, payments, notifications…)
03_phase_b_rotation
04_phase_c_ledger
05_phase_d_payout
06_phase_e_reliability
07_phase_f_notifications
08_backfill_organizer_membership
09_fix_membership_and_invitations
10_pending_members_visibility
11_postgrest_profile_fks
12_visibility_and_co_organizers
13_phase_i_finalisation
14_preview_group_by_code
15_fix_start_cycle_enum_cast
16_update_group_settings
17_late_penalties
18_payout_fee
18b_fix_my_receipts_view
19_group_chat
20_group_announcements
21_payment_reminders
22_avatars_bucket
24_audit_log
25_audit_instrumentation
26_notification_preferences
27a_swap_enum_prelude  →  27_turn_swaps
28a_auction_enum_prelude → 28_turn_bids_auction
29a_review_enum_prelude → 29_member_reviews
30_reliability_score_v2
31_security_hardening
32a_admin_enum_prelude → 32_member_admin_actions
33_admin_permissions
34_member_permissions
35a_external_payments_enum_prelude → 35_external_payments
36_penalty_management
37_cycle_pause
38_archive_group
39_manual_reminders_and_history
40a_rgpd_enum_prelude → 40_rgpd_delete_account
41_audit_ttl
42_consent_log
43_phone_privacy
44_fk_turns_profiles
45_reload_postgrest
46_djomy_payments
```

### Points d'attention
- **Préludes enum séparés** : chaque `*a_prelude` est soumis comme migration distincte avant sa migration principale (sinon Postgres lève `22P02 unsafe use of new value of enum type`).
- **GRANTs** : tous les fichiers historiques contiennent déjà les `GRANT` requis ; aucun ajout nécessaire.
- **`supabase/config.toml`** : le `project_id` actuel (`oljyzmannzejtsbfpzxp`) correspond au nouveau backend Cloud — pas de modification.
- **Edge functions Djomy** : déjà présentes dans `supabase/functions/`, redéployées automatiquement par Cloud ; aucune action manuelle.
- **Secrets Djomy** : `DJOMY_CLIENT_ID`, `DJOMY_CLIENT_SECRET`, `DJOMY_ENV`, `DJOMY_WEBHOOK_SECRET` sont déjà présents côté Cloud (visibles dans la config). RAS.
- **Webhook URL Djomy** : à la fin, je te donnerai la nouvelle URL `https://<project>.functions.supabase.co/djomy-webhook` à coller dans le dashboard Djomy (l'URL change car le nouveau backend a un autre ref que `f51a5fe7…`, qui n'était que l'app preview).

### Après le rejeu
1. Lancer `supabase--linter` pour repérer toute policy/grant manquant.
2. Vérifier via `supabase--read_query` que tous les enums (`payment_provider` contient `djomy`, etc.) et toutes les tables clés (`groups`, `payments`, `payment_links`, `djomy_webhook_events`…) existent.
3. Recréer 2 comptes de test (Bob organisateur, Alice membre) via la modale auth.
4. Relancer le test E2E paiement Djomy bout-en-bout et confirmer la mise à jour du dashboard.

### Risque & rollback
Chaque migration est idempotente (`if not exists`, `do $$ … exception …`), donc une ré-exécution partielle est sûre. Si une migration échoue, je m'arrête, on diagnostique, on corrige avant de poursuivre — pas de cascade aveugle.

### Durée estimée
~45 migrations à approuver. Tu peux cliquer "Approve" en rafale ; je n'enchaîne la suivante qu'après confirmation que la précédente a passé.
