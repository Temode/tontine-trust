
# Gestion des cotisations défaillantes — workflow professionnel

Aujourd'hui, si un membre ne paie pas à l'échéance : la cotisation reste `pending`, le tour est gelé indéfiniment (`release_payout` refuse), et seul son prochain paiement (s'il a lieu) appliquera une pénalité. Aucune alerte automatique, aucune transparence pour le groupe, aucun canal d'escalade vers l'équipe Tontine. À corriger.

## Politique retenue

- **Délai de grâce : J+1.** Dès le lendemain de l'échéance, la cotisation passe automatiquement en `defaulted`.
- **Transparence groupe :** tous les membres voient qui n'a pas payé (pas de retard "privé").
- **Escalade Tontine :** l'organisateur peut signaler officiellement le compte → équipe Tontine prend le relais (appel direct, mise en demeure, voie judiciaire), justifié par le KYC obligatoire (pièce d'identité, certificat de résidence).
- **Pas de vote d'exclusion automatique** : la responsabilité est portée par la plateforme, pas par le groupe.
- **Impact fiabilité automatique :** le score baisse dès J+1, sans attendre un paiement.

## Ce qui sera construit

### 1. Statut `defaulted` automatique (cron quotidien)

Nouveau cron `mark_defaulted_contributions` exécuté chaque jour à 06:00 UTC, juste avant le cron de rappels :
- Toute `contribution` en `pending` dont `turn.due_date < current_date` passe à `status = 'defaulted'`.
- Champs ajoutés : `defaulted_at`, `default_days` (recalculé à chaque passage).
- Notification automatique au payeur (« Cotisation en défaut ») et **à tous les organisateurs** du groupe (`group_admin_permissions`).
- Entrée `audit_log` + `tontine_alerts` (sévérité `high`) pour la supervision plateforme.
- Recalcule `user_reliability_scores` du défaillant immédiatement.

### 2. Transparence groupe

- Vue `group_defaulters` (security_invoker, accessible aux membres du groupe) : liste des défaillants en cours avec nom, tour, montant dû, jours de retard. **N'expose pas** d'infos personnelles au-delà du nom déjà visible dans le groupe.
- Sur la page de détail du groupe (`/groupes/:id`), nouvelle section **« Cotisations en retard »** avec badge rouge sur chaque membre concerné.
- Notification dans le fil du groupe : « X n'a pas réglé sa cotisation du tour #N (échéance dépassée de 3 jours) ».

### 3. Signalement officiel à l'équipe Tontine

Nouvelle table `member_default_reports` :
- `id`, `group_id`, `reported_user_id`, `reported_by` (organisateur), `contribution_id`, `reason`, `status` (`open` / `in_review` / `resolved` / `legal_action`), `tontine_handler_id`, `internal_notes`, `created_at`, `resolved_at`.
- RPC `report_defaulter(_contribution_id, _reason)` : réservé aux admins du groupe avec permission `can_report_defaulter` (nouveau flag). Crée le signalement, notifie tous les super-admins plateforme via `tontine_alerts` (sévérité `critical`).
- Bouton **« Signaler à Tontine »** sur la fiche du défaillant (visible organisateurs uniquement).

### 4. Back-office super-admin

Nouvelle page `/admin/defaulters` :
- Liste tous les `member_default_reports` ouverts, triés par criticité (montant × jours de retard).
- Détail défaillant : profil + KYC + historique de cotisations + score fiabilité + groupes affectés.
- Actions super-admin : changer `status`, ajouter `internal_notes`, déclencher un appel (lien `tel:`), envoyer SMS personnalisé via Nimba (sender `ImmoConnect`), marquer `legal_action`.
- Lien direct vers les pièces KYC du défaillant (préparé pour la phase KYC à venir — voir §6).

### 5. Impact score fiabilité automatique

- Le cron `mark_defaulted_contributions` appelle `recompute_reliability(payer_user_id)` pour chaque nouveau défaillant.
- `recompute_reliability` mis à jour : compte aussi `defaulted` (pas seulement `confirmed`) → `v_total_due` inclut les défauts, le ratio paiement plonge dès J+1.
- Nouveau seuil `reliability_tier = 'blocked'` si ≥ 2 défauts non régularisés OU 1 signalement `legal_action`.

### 6. KYC — préparation seulement (out of scope)

La vraie intégration KYC (pièce d'identité, certificat de résidence, vérification documentaire) est un chantier à part. Dans ce plan, on :
- ajoute les colonnes `profiles.kyc_status` (`none` / `pending` / `verified` / `rejected`), `kyc_verified_at` ;
- ajoute la table `kyc_documents` (id, user_id, type, storage_path, status, reviewed_by, reviewed_at) avec bucket privé `kyc-documents` ;
- expose dans le back-office défaillants un encart « KYC : non vérifié » avec CTA « Demander vérification ».
Le formulaire d'upload utilisateur et la review documentaire feront l'objet d'un plan dédié.

### 7. Côté UI utilisateur

- `/cotisations` : les contributions `defaulted` apparaissent dans un nouvel onglet rouge **« En défaut »** avec bandeau explicite « Votre compte a été signalé. Régularisez sous 48h pour éviter une mise en demeure. »
- Le paiement reste possible (le RPC `record_mock_payment` accepte maintenant `defaulted` en plus de `pending/submitted/rejected`) → régularise + applique pénalité figée + ferme automatiquement le signalement avec un commentaire système.

## Détails techniques

```text
db/52_defaulted_status.sql
  - enum contribution_status: + 'defaulted'
  - contributions: + defaulted_at, default_days
  - function mark_defaulted_contributions() (security definer)
  - cron 'tontine_mark_defaulters' à 06:00 UTC quotidien

db/53_defaulter_reports.sql
  - table member_default_reports + GRANT + RLS
  - permission group_admin_permissions.can_report_defaulter
  - RPC report_defaulter(contribution_id, reason)
  - RPC update_defaulter_report(id, status, internal_notes) — super-admin
  - view group_defaulters (security_invoker)

db/54_reliability_includes_defaults.sql
  - recompute_reliability: intègre 'defaulted' dans v_total_due
  - reliability_tier: + 'blocked'

db/55_kyc_scaffolding.sql
  - profiles.kyc_status, kyc_verified_at
  - table kyc_documents + bucket privé + RLS

UI:
  - src/pages/admin/Defaulters.tsx  (nouveau)
  - src/pages/MyContributions.tsx   (onglet "En défaut")
  - src/pages/GroupDetail.tsx       (section "Retards")
  - src/components/group/DefaulterBadge.tsx (badge rouge réutilisable)
  - src/components/group/ReportDefaulterDialog.tsx
  - Route admin /admin/defaulters dans App.tsx + lien dans AdminLayout
```

## Hors scope de ce plan

- Upload utilisateur KYC, OCR pièces d'identité, intégration vérification tierce (Sumsub / Onfido).
- Génération automatique de mise en demeure PDF.
- Intégration appel sortant automatisé (Twilio Voice).

Ces points feront l'objet de plans dédiés une fois la base défaillants en production.
