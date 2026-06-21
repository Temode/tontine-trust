# Plan — Transparence et gestion des défauts

Objectif : renforcer la traçabilité côté admin et côté membre autour des défaillances, en complétant le système existant (`member_default_reports`, `audit_log`, `notifications`, `user_reliability_scores`).

## 1. Journal d'audit consultable sur `/admin/defaillants`

- **Backend** : ajouter une fonction RPC `get_default_report_audit(p_report_id uuid)` qui retourne l'historique trié à partir de `audit_log` (entrées `entity_type = 'member_default_report'` + entrées liées `contribution_id`), enrichies avec les profils `actor_user_id` (nom, rôle).
- **UI** : sur la page admin existante (`src/pages/admin/Defaulters.tsx`), ajouter un panneau latéral (Sheet) « Historique du dossier » ouvrable depuis chaque ligne. Colonnes : date, acteur (avatar + nom + rôle), action (`reported`, `status_changed`, `note_added`, `kyc_updated`), ancien → nouveau statut, note interne.
- **Notes internes** : ajouter un champ texte + bouton « Ajouter une note » qui appelle `update_defaulter_report` (déjà existant) avec un nouveau paramètre `p_note_only = true` pour journaliser sans changer le statut.

## 2. Contestation membre sur `/cotisations`

- **Nouvelle table** : `contribution_disputes` (contribution_id, raised_by, reason, evidence_url, status `open|under_review|accepted|rejected|resolved`, organizer_response, resolved_at, resolved_by).
- **RPC** : `raise_contribution_dispute(p_contribution_id, p_reason, p_evidence_url)` + `resolve_contribution_dispute(p_dispute_id, p_status, p_response)` réservée aux organisateurs du groupe (`has_admin_permission`).
- **UI membre** : sur chaque carte de contribution `defaulted` ou `late` dans `MyContributions.tsx`, bouton « Contester / demander une revue » → modale avec motif (textarea) + lien optionnel vers une preuve. Affichage du statut courant et de la réponse de l'organisateur (badge + timeline).
- **UI organisateur** : nouvelle section « Contestations en attente » dans `GroupDetail.tsx` (à côté de `GroupDefaultersSection`) avec actions Accepter / Rejeter / Marquer résolu.

## 3. Notifications in-app + récap admin

- Étendre `mark_defaulted_contributions()` (migration) pour :
  - Insérer dans `notifications` (`type = 'contribution_defaulted'`) avec `data.group_id`, `data.contribution_id`, `data.deep_link = '/groupes/:id'`.
  - Créer une entrée agrégée dans `tontine_alerts` (`severity = 'high'`, `category = 'defaulter_digest'`) avec un récapitulatif quotidien : nombre de nouveaux défauts, top groupes, lien `/admin/defaillants`.
- Côté UI : le `NotificationCenter` existant gère déjà le `deep_link` ; vérifier qu'un défaut redirige bien vers la page du groupe. Sur `AdminDashboard` (ou `AdminSidebar` si dashboard absent), afficher un badge compteur sur « Défaillants ».

## 4. Détail pénalité sur la carte « en défaut »

Dans `MyContributions.tsx`, lorsque `status = 'defaulted'` (ou `late`), afficher un encart dépliable :
- Pourcentage de pénalité (depuis `groups.late_penalty_percent`, déjà copié sur `contributions.penalty_rate_applied`).
- Jours de retard retenus (`default_days` ou calcul `now - turn.due_date`).
- Montant estimé : `amount * penalty_rate / 100 * jours` (selon règle existante).
- Bloc « Comment est calculé votre score de fiabilité » : ratio paiements à temps, impact d'un défaut (-15 pts), seuils de tier (`good ≥ 80`, `warning ≥ 60`, `blocked < 60` ou ≥ 2 défauts). Texte statique sourcé du code de `recompute_reliability`.

## 5. Section « Historique des défauts » sur `/cotisations`

Nouvel onglet (ou accordéon en bas) listant, pour l'utilisateur connecté, chaque contribution ayant déjà été en défaut au moins une fois :
- Échéance (date, tontine, montant).
- Date de bascule (`defaulted_at`).
- Notifications envoyées : extraites de `notifications` (filter `data.contribution_id`) + `manual_reminders_log`.
- État de résolution : payé le X / contestation en cours / signalé à Tontine.

Implémenté via une RPC `get_user_default_history(p_user_id)` qui agrège `contributions` + `notifications` + `member_default_reports` + `contribution_disputes`.

## Détails techniques

- Migrations SQL :
  1. `contribution_disputes` + GRANT + RLS (`raised_by = auth.uid()` pour lecture/insertion ; organisateurs via `has_admin_permission` pour update).
  2. RPC `raise_contribution_dispute`, `resolve_contribution_dispute`, `get_default_report_audit`, `get_user_default_history`.
  3. Mise à jour de `mark_defaulted_contributions` (notif + alerte agrégée) et de `update_defaulter_report` (mode note-only).
- Fichiers front modifiés/créés :
  - `src/lib/api/disputes.ts` (nouveau).
  - `src/components/contribution/DisputeDialog.tsx` (nouveau).
  - `src/components/contribution/PenaltyBreakdown.tsx` (nouveau).
  - `src/components/contribution/DefaultHistorySection.tsx` (nouveau).
  - `src/components/admin/DefaultReportAuditSheet.tsx` (nouveau).
  - `src/components/group/GroupDisputesSection.tsx` (nouveau).
  - Modifs : `MyContributions.tsx`, `GroupDetail.tsx`, `admin/Defaulters.tsx`, `AdminSidebar.tsx`, `lib/api/defaulters.ts`.

## Hors périmètre

- Upload de preuves vers un bucket privé (on stocke uniquement une URL collée par le membre pour l'instant).
- Envoi e-mail / SMS sur défaut (on reste in-app, le digest SMS existant continue de tourner).
- Tableau de bord temps réel ; on rafraîchit via React Query au focus.
