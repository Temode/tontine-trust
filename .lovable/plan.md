## Vue d'ensemble

Quatre chantiers à livrer **séquentiellement** (1 → 2 → 3 → 4). Chacun est autonome : on ne démarre le suivant qu'après validation visible du précédent (UI + données). Ce plan définit la cible. Avant chaque chantier, je redemande votre feu vert.

---

## Chantier 1 — KYC à paliers (« Parcours de confiance »)

### Modèle de données
- Nouvelle table `kyc_levels_config` (configurable par admin plateforme) — plafonds par palier.
- Colonne `profiles.kyc_level smallint not null default 0` (0=non vérifié, 1=Découverte, 2=Vérifié).
- Réutilise la table existante `kyc_documents` (déjà présente) pour stocker NINA / passeport / carte d'électeur.
- Trigger : passage à `kyc_level=1` dès qu'un OTP SMS est validé (réutilise le flux Nimba existant).
- Workflow back-office : page admin `KycReview` (file d'attente), RPC `admin_validate_kyc(user_id, decision, level)`.

### Règles métier (gardes-fous SQL)
- RPC `join_group` (à étendre) : rejette `KYC_INSUFFICIENT` si `groups.contribution_amount > kyc_max_amount[user.kyc_level]`.
- RPC `assign_turn_position` (rotation) :
  - Palier 1 → position dans le **dernier tiers** uniquement.
  - Palier 2 → position autorisée à partir du **deuxième tiers**.
  - Organisateur peut toujours forcer (audit-logué).

### UI
- Page `/profil/kyc` avec stepper (Téléphone → Pièce d'identité), badges « Découverte » / « Vérifié », explications des privilèges débloqués.
- Banner dans `JoinFlow` si KYC insuffisant : « Vérifiez votre identité pour rejoindre cette tontine » + CTA.
- Back-office : `src/pages/admin/KycReview.tsx`.

---

## Chantier 2 — Intégration nouveaux membres sur gros montants

Trois verrous **optionnels au choix de l'organisateur**, configurés dans `GroupSettings` :

### A. Positionnement algorithmique (déjà partiellement amorcé en chantier 1)
- Flag `groups.new_member_lock_last_third boolean default false`.
- Si activé : tout membre ayant rejoint après le début du cycle (ou avec `kyc_level=2` mais sans historique) est forcé dans le dernier tiers de la rotation.

### B. Caution financière
- Nouvelle colonne `groups.deposit_amount bigint` (défini par l'organisateur, ex. 1 ou 2 mensualités).
- Nouvelle table `member_deposits (member_id, group_id, amount, status [held/released/forfeited], djomy_payment_id, locked_at, released_at, forfeited_reason)`.
- Flux Djomy dédié : `init_deposit_payment` → webhook → `member_deposits.status='held'` → membre activé dans le groupe.
- Restitution automatique à la clôture du cycle si aucun incident (`member_default_reports` vide pour ce membre).
- Saisie automatique en cas de défaut post-payout (lien avec la règle existante du chantier précédent).
- UI : `DepositPanel` dans `JoinFlow` + carte « Mes cautions » dans `MyBalance`.

### C. (Pas demandé — on s'en tient aux deux ci-dessus.)

### UI Organisateur
- `GroupSettings` → nouvelle carte « Sécurité des nouveaux membres » : 2 toggles indépendants + champ caution.

---

## Chantier 3 — Passerelle juridique : export de litige certifié

### Contrat numérique de solidarité
- Nouvelle table `group_contracts (group_id, version, body_md, created_at)` — modèle par défaut maintenu par admin plateforme, surchargeable par groupe.
- Nouvelle table `contract_signatures (contract_id, user_id, signed_at, ip, user_agent, hash_sha256, otp_ref)` — signature électronique via OTP SMS (réutilise Nimba).
- Garde-fou : `start_cycle` rejette `CONTRACT_NOT_SIGNED` si un membre n'a pas signé.
- UI : `ContractSignDialog` (texte scrollable + OTP), affiché à l'adhésion.

### Bouton « Export de litige »
- RPC `generate_dispute_export(group_id, member_id, reason)` → enregistre une demande dans `dispute_exports (id, group_id, member_id, requested_by, reason, status, pdf_path, sha256, created_at)`.
- Edge function `generate-dispute-pdf` (Deno + jsPDF/pdf-lib) qui assemble le PDF :
  1. Page de garde certifiée Tontine Digitale (logo, n° de dossier, hash SHA-256 du PDF).
  2. Identité du défaillant : KYC validé (photo pièce, NINA), profil, n° téléphone vérifié.
  3. Historique immuable du ledger (`ledger_entries`) horodaté.
  4. Reçus Orange Money / MoMo (`receipts` + `payments.provider_ref`).
  5. Contrat numérique signé (texte + horodatage signature + hash).
  6. Preuve de versement de la cagnotte au défaillant (`turns` complétés + `payments` de payout).
  7. Preuve du défaut de paiement (cotisations `status='pending'` après échéance + SMS de rappel envoyés via `sms_logs`).
- Stockage : bucket `dispute-exports` (privé, signé URL 24 h, accès admin + organisateur).
- UI : bouton dans `GroupDefaultersSection` → modal motif → file d'attente → téléchargement.
- Audit : `audit_log` entrée systématique.

---

## Chantier 4 — Pénalité de rétention majorée

### Logique
- Colonne `group_members.was_late_in_cycle boolean default false`.
- Colonne `group_members.was_late_at_turn_number int[]` (trace les tours concernés, debug).
- Trigger / extension de `enqueue_payment_reminders` : dès J+1 sur une cotisation `pending`, basculer le flag à `true` pour ce membre dans le cycle courant.
- Reset à `false` au démarrage d'un nouveau cycle (`start_cycle`).

### Application sur le payout
- Fonction `compute_hold_until(turn_id) returns timestamptz` :
  - Si `was_late_in_cycle = false` → `due_date + standard_hold_days[frequency]`.
  - Si `was_late_in_cycle = true` → `due_date + standard_hold_days[frequency] + 7`.
- `standard_hold_days` (table de config ou enum) :
  - `daily` → 0, `weekly` → 7, `biweekly` → 7, `monthly` → 7.
- Colonne `turns.payout_hold_until timestamptz` calculée à la complétion du tour (`status='collecting' → 'paid'`).
- Garde-fou retrait : `request_withdrawal` rejette `PAYOUT_LOCKED_UNTIL` tant que `now() < payout_hold_until`.

### UI
- `MyBalance` : carte « Fonds en attente de libération » avec date exacte + raison (« Retard durant ce cycle : libération repoussée de 7 jours »).
- `GroupDetail` (vue bénéficiaire) : badge « Rétention prolongée — libération le 03/07 ».
- Notification SMS automatique au membre concerné dès qu'il devient bénéficiaire avec rétention majorée.

---

## Ordre d'exécution et points de validation

| Étape | Livrable visible | Critère d'acceptation |
|---|---|---|
| 1.a Migration KYC + RPC | `kyc_level` visible sur le profil | `select kyc_level from profiles` renvoie 0 par défaut |
| 1.b UI `/profil/kyc` + admin review | Stepper fonctionnel, file admin | Vous pouvez valider un faux NINA en local |
| 1.c Gardes-fous `join_group` / rotation | `JoinFlow` bloque si KYC insuffisant | Test E2E Rougui adapté |
| 2.a Migration caution + Djomy deposit | `member_deposits` peuplée | Webhook crée bien la ligne `held` |
| 2.b UI organisateur + UI joueur | Carte « Sécurité nouveaux » + flux caution | Démo bout en bout |
| 3.a Contrat numérique + signature OTP | Dialog signature à l'adhésion | `start_cycle` bloqué tant que non signé |
| 3.b Export PDF + bucket | Bouton fonctionne dans `GroupDefaultersSection` | PDF téléchargeable avec les 7 sections |
| 4.a Migration `was_late_in_cycle` + recalcul `payout_hold_until` | Colonne visible, calcul testable | Backfill sur cycles en cours |
| 4.b Garde-fou retrait + UI | Retrait bloqué avec message clair | Notification SMS au bénéficiaire |

---

## Questions avant de démarrer le chantier 1

1. **Plafond Palier 1** : OK pour `50 000 GNF` comme demandé ? Voulez-vous aussi un plafond cumulé (somme des cotisations sur 30 jours) ?
2. **Pièces acceptées Palier 2** : NINA + Passeport + Carte d'électeur uniquement, ou ajoute-t-on permis de conduire / carte consulaire ?
3. **Validation KYC** : revue **manuelle** par l'équipe Tontine Digitale uniquement, ou veut-on dès maintenant brancher un fournisseur OCR/biométrie (Smile ID, Youverify) ? La revue manuelle est plus rapide à livrer.
4. **OTP SMS** : on réutilise Nimba (déjà en prod) — confirmez-vous ? Sinon préciser le fournisseur.

Une fois ces réponses obtenues, je passe en mode build et j'implémente le **chantier 1 uniquement**, puis je vous remontre la démo avant de toucher au chantier 2.
