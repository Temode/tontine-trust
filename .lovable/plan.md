# P1 — Tontine Digital : Engagement & Confiance

Périmètre confirmé d'après l'audit (post-P0). Objectif : transformer l'app fonctionnelle en plateforme vivante et fiable, à la hauteur de Tontine Digital.

## 1. Chat de groupe
- Migration `db/19_group_chat.sql` :
  - Table `group_messages` (id, group_id, author_user_id, body, created_at, edited_at, deleted_at).
  - RLS : SELECT/INSERT réservés aux membres `approved` du groupe ; UPDATE/DELETE soft réservés à l'auteur.
  - GRANTs explicites `authenticated` + `service_role`, séquence sur `created_at` indexée.
  - Realtime activé via `alter publication supabase_realtime add table group_messages`.
- `src/lib/api/chat.ts` : `listGroupMessages`, `sendGroupMessage`, `subscribeGroupMessages`.
- Nouvel onglet "Discussion" dans `GroupDetail` → composant `src/components/group/GroupChat.tsx` (liste virtualisée, avatar + nom, horodatage, scroll auto, indicateur "nouveau message").

## 2. Annonces organisateur
- Migration `db/20_group_announcements.sql` :
  - Table `group_announcements` (id, group_id, author_user_id, title, body, pinned, created_at).
  - RLS : INSERT/UPDATE/DELETE réservés aux organisateurs/co-organisateurs ; SELECT pour tous les membres.
  - Trigger : à l'insertion, crée une `notification` `kind='announcement'` pour chaque membre approuvé.
- `src/lib/api/announcements.ts`.
- Section "Annonces" en haut de `GroupDetail` (épinglées en surbrillance avec accent) + dialog "Nouvelle annonce" pour organisateur.

## 3. Rappels automatiques (CRON)
- Migration `db/21_payment_reminders.sql` :
  - Fonction `enqueue_payment_reminders()` (SECURITY DEFINER) : pour chaque contribution `pending` dont `due_date ∈ [J+2, J+1, J0, J-1, J-3 retard]`, insère une notification `kind='payment_reminder'` si pas déjà envoyée le jour même (table `reminder_log` pour idempotence).
  - pg_cron : job quotidien à 08:00 UTC qui appelle la fonction.
- Aucun changement front (les notifs apparaissent dans `Notifications.tsx` et `NotificationBell`).

## 4. Photos de profil
- Création bucket Storage `avatars` (public, max 2 Mo, MIME image/*) via migration `db/22_avatars_bucket.sql` + policies (upload/update/delete par owner, read public).
- `src/lib/api/profile.ts` : `uploadAvatar(file)` (compression côté client via canvas, redim 512px) → met à jour `profiles.avatar_url`.
- `Profile.tsx` : zone d'upload avec preview + recadrage simple.
- Affichage : `Avatar` shadcn avec `avatar_url` dans header, chat, listes de membres, timeline des tours.

## 5. Badges de fiabilité enrichis
- Le composant `ReliabilityBadge` existe déjà. Étendre :
  - Migration `db/23_reliability_view.sql` : vue `member_reliability` (user_id, group_id, total_due, paid_on_time, paid_late, missed, score, tier ∈ {bronze, argent, or, platine}).
  - Affichage des badges (avec tier coloré : muted, accent, primary, gradient or) dans :
    - Listes de membres (`GroupDetail` onglet Membres).
    - Cartes bénéficiaires de `TurnsTimeline`.
    - En-tête `Profile`.
  - Tooltip détaillant le calcul.

## 6. Journal d'audit
- Migration `db/24_audit_log.sql` :
  - Table `audit_log` (id, actor_user_id, group_id, action text, entity_type, entity_id, metadata jsonb, created_at).
  - RLS : SELECT réservé aux organisateurs du groupe ; INSERT via SECURITY DEFINER uniquement.
  - Helper `log_audit(_group_id, _action, _entity_type, _entity_id, _metadata)`.
  - Instrumentation des RPC existantes : `start_cycle`, `release_payout`, `update_group_settings`, `approve_member`, `record_mock_payment` (succès/échec).
- Nouvel onglet "Audit" dans `GroupDetail` visible pour organisateur uniquement → composant `src/components/group/AuditLog.tsx` (liste filtrable par action et acteur, badges colorés par sévérité).

## Notes
- Toutes les migrations dans `db/` à exécuter manuellement dans le SQL editor (ordre 19 → 24).
- Realtime Supabase doit être activé sur le projet (à vérifier au moment du chat).
- Respect strict des tokens design system (aucune couleur hardcodée), composants accessibles (aria-labels, focus visible).
- Pas de régression sur P0 : on additionne uniquement.

Confirme ce périmètre (ou indique les chantiers à retirer/réordonner) et je passe en build.
