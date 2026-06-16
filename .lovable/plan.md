## Objectifs

1. **Audit complet** de l'app en se connectant comme Alice (organisatrice) puis Bob (membre), avec captures et observations.
2. **Audit UX** page par page.
3. **Audit sécurité** (lint Supabase + scan).
4. **Nouvelle feature** : workflow de suppression de groupe avec consentement unanime (silence = oui) + back-office super_admin pour décision finale.

---

## Partie 1 — Audit fonctionnel E2E (Alice + Bob)

Script Playwright sous `/tmp/browser/audit/` qui exécute, captures à chaque étape :

**Alice (organisatrice)**
1. Login `alice@yopmail.com` → Dashboard (capture)
2. Création groupe « Audit Test » (5 membres, 10 000 XOF, hebdo) → capture wizard étapes 1→5
3. Page Invite Members → générer code, copier QR
4. Vérifier notification, audit log, paramètres groupe

**Bob (membre)**
5. Login `bob@yopmail.com` → Join Group avec code
6. Accepter CGU → soumettre candidature
7. Retour Alice → approuver Bob (capture validations)
8. Bob : voir groupe dans Mes Groupes → ouvrir → onglets Membres / Rotation / Chat / Annonces
9. Test paiement Djomy sandbox (Orange Money) → capture modal + retour `/payment-return`
10. Vérifier reçu, historique, score fiabilité

**Pour chaque étape** : screenshot, logs console, requêtes réseau en erreur, temps de chargement.

Livrable : tableau Markdown `findings-functional.md` avec sévérité (P0/P1/P2/P3).

---

## Partie 2 — Audit UX

Revue page par page (Dashboard, MyGroups, GroupDetail, CreateGroup wizard, JoinGroup, InviteMembers, Profile, Notifications, PrivacySettings, DeleteAccount, MyContributions, Receipts) :

- Cohérence Bleu sarcelle #0D7377 / Or #E8AA14
- Hiérarchie typographique, espacements, contrastes WCAG AA
- États vides, loading skeletons, erreurs
- Mobile (375px) vs desktop (1280px) — bascule via `set_preview_device_viewport`
- Affordances (CTA visibles, feedback toasts)
- Navigation (BottomNav, breadcrumbs, retours)
- Microcopie française (ton, clarté, accord)

Livrable : `findings-ux.md` avec captures annotées.

---

## Partie 3 — Audit sécurité & perfs

- `supabase--linter` : RLS manquantes, fonctions sans `search_path`, policies trop permissives
- `security--run_security_scan`
- Vérif clés exposées côté client
- `supabase--slow_queries` + `supabase--db_health`
- Revue policies sur `payment_links`, `djomy_webhook_events`, `manual_reminders_log`, `group_consent_log`
- Audit edge functions Djomy (validation HMAC webhook, rate-limit)

Livrable : `findings-security.md`.

---

## Partie 4 — Feature : Demande de suppression de groupe

### Règles métier

- **Pré-conditions** vérifiées côté serveur :
  - `groups.status` ∈ (`draft`, `cancelled`) OU aucun `turns` avec `status='collecting'`
  - Aucune `contributions.status='pending'` ou ledger non-soldé
  - Aucun `payment_links.status='pending'`
- **Vote** : tous les membres `active` doivent être notifiés. Délai 14 jours. **Non-réponse = OUI** (accord tacite).
- **Un seul NON explicite** annule la demande immédiatement.
- **Décision finale** : super_admin Tontine approuve/refuse via back-office avec motif.
- **Effet** : soft-delete → `deleted_at`, `deletion_status='approved'`. Groupe invisible partout (queries filtrées). Données conservées 6 ans pour audit financier/RGPD. Job mensuel purge au-delà.

### Schéma DB (migration unique)

```sql
-- enum
create type deletion_request_status as enum
  ('pending_members','pending_admin','approved','rejected','cancelled');
create type deletion_vote as enum ('yes','no');

-- table principale
create table group_deletion_requests (
  id uuid pk, group_id uuid fk → groups, requested_by uuid,
  reason text, status deletion_request_status default 'pending_members',
  members_deadline timestamptz,   -- now() + 14 days
  admin_decision_by uuid, admin_decision_at timestamptz,
  admin_decision_reason text,
  created_at, updated_at
);

-- votes individuels (un seul NON explicite suffit à refuser)
create table group_deletion_votes (
  request_id uuid fk, user_id uuid, vote deletion_vote,
  voted_at timestamptz, primary key(request_id, user_id)
);

-- soft-delete sur groups
alter table groups add column deleted_at timestamptz,
  add column deletion_request_id uuid;
```

+ GRANT + RLS (membres lisent leur demande/vote ; super_admin lit tout).

### RPCs

- `request_group_deletion(_group_id, _reason)` → vérifie pré-conditions, crée la demande, notifie tous les membres actifs.
- `vote_group_deletion(_request_id, _vote)` → enregistre vote ; si NON → bascule `rejected` immédiatement ; sinon attend deadline.
- `finalize_deletion_votes()` (cron quotidien) → après deadline, si aucun NON → bascule `pending_admin` + notifie super_admins.
- `admin_decide_deletion(_request_id, _approve, _reason)` → super_admin only, applique soft-delete.

### Rôle super_admin

- Ajouter `'super_admin'` à l'enum `app_role`.
- Helper `is_super_admin(uid)` SECURITY DEFINER.
- Page `/admin/deletion-requests` réservée via `RoleGuard`.

### UI

**Côté organisateur** (GroupSettings, remplacer / compléter le bouton Archiver actuel) :
- Bouton « Demander la suppression » (visible seulement si pré-conditions OK).
- Modal avec motif obligatoire + récap pré-conditions vérifiées.
- Bannière « Demande en cours — X/Y votes, deadline le … ».

**Côté membre** (GroupDetail) :
- Carte vote « L'organisateur demande la suppression de ce groupe » → boutons Approuver / Refuser + motif.
- Notification dédiée `group_deletion_requested`.

**Back-office super_admin** (`/admin/deletion-requests`) :
- Liste des demandes `pending_admin` avec : nom groupe, organisateur, votes, motifs.
- Actions Approuver / Refuser avec motif.
- Notif retour à l'organisateur + journal audit.

### Notifications & audit

Nouvelles `notification_kind` :
- `group_deletion_requested`
- `group_deletion_vote_recorded`
- `group_deletion_rejected_by_member`
- `group_deletion_pending_admin`
- `group_deletion_approved`
- `group_deletion_refused`

Actions audit : `deletion_requested`, `deletion_voted`, `deletion_finalized`, `deletion_admin_decision`.

---

## Livrables finaux

1. 3 rapports Markdown sous `/mnt/documents/audit-2026-06-16/` (fonctionnel, UX, sécurité) + screenshots.
2. Migration `group_deletion_workflow.sql` (enums, tables, RLS, RPCs, soft-delete, super_admin).
3. Page `/admin/deletion-requests` + composants `DeletionRequestPanel` (organisateur) et `DeletionVoteCard` (membre).
4. API client `src/lib/api/deletion.ts`.
5. Re-test E2E du workflow de suppression sur le groupe « Audit Test » après implémentation.

## Hors-périmètre (à confirmer plus tard)

- Possibilité pour les membres d'**initier** une demande de suppression (actuellement réservé organisateur).
- Email externe aux membres (uniquement in-app pour cette itération).
