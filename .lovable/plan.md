## Vérification d'implémentation — Chantiers 1 à 4

Audit du code, du schéma DB (RPCs, colonnes, tables) et des tests présents. Voici l'état réel.

### Chantier 1 — KYC à Paliers ✅ Implémenté
- Table `kyc_levels_config` (3 niveaux), `kyc_documents`, colonnes `profiles.kyc_level / kyc_status / phone_verified_at / kyc_verified_at`.
- Edge functions `kyc-send-otp`, `kyc-verify-otp` (Nimba SMS — logs OK).
- RPCs `submit_kyc_document`, `admin_validate_kyc`.
- UI : `src/pages/Kyc.tsx` (parcours membre), `src/pages/admin/KycReview.tsx` (revue admin).
- Plafond par palier appliqué côté join (erreur `KYC_INSUFFICIENT`).

### Chantier 2 — Caution & verrou dernier tiers ✅ Implémenté
- `group_members.deposit_status` + `was_late_*`, table `member_deposits` (0 lignes en prod = aucun parcours réel exécuté encore).
- Page `src/pages/DepositPayment.tsx`, admin `src/pages/admin/Deposits.tsx` (forçage + audit_log).
- Composant `PositionBadge`, blocage `request_withdrawal` (`DEPOSIT_REQUIRED`, `POSITION_LOCKED`).
- Webhook Djomy idempotent via `djomy_webhook_events`.

### Chantier 3 — Contrat numérique & export de litige ✅ Implémenté
- Tables `group_contracts` (1 modèle par défaut publié), `contract_signatures`, `dispute_exports`.
- RPCs `get_active_contract`, `sign_contract`, `admin_publish_contract_template`.
- Edge function `generate-dispute-pdf` + bucket `dispute-exports` (URL signée 24 h).
- UI : `ContractSignDialog` (OTP SMS + SHA-256), `DisputeExportButton`, `src/pages/admin/ContractTemplate.tsx`.
- Garde-fou `start_cycle` rejette `CONTRACT_NOT_SIGNED`.

### Chantier 4 — Pénalité de rétention majorée ✅ Implémenté
- `group_members.was_late_in_cycle / was_late_at_turn_number`, `turns.payout_hold_until`, `payout_hold_config` (4 fréquences).
- RPCs `send_payout_hold_extended_if_needed` (idempotent), `admin_list_payout_holds`, `admin_resend_payout_hold_notice`, `list_my_payout_hold_history`.
- `enqueue_payment_reminders` flagge J+1, `auto_close_turn` calcule la date de libération.
- UI : `src/pages/admin/PayoutHolds.tsx`, `PayoutHoldHistory`, badge « Rétention prolongée », blocage `WithdrawDialog` (`PAYOUT_LOCKED_UNTIL`).
- SMS Nimba `payout_hold_extended` via `send-tontine-sms`, log idempotent `payout_hold_notifications_log`.
- Tests unitaires `src/lib/holds/computeHoldUntil.test.ts` (Vitest, propriétés + cas limites).

### ⚠️ Écart constaté — Tests E2E non exécutables
Les 3 fichiers `tests/e2e/{deposits,dispute-export,payout-hold}.spec.md` sont des **scénarios rédigés en Markdown**, pas des specs Playwright. Seuls `famille-alice.spec.ts`, `payment-return-realtime.spec.ts` et `rls-quick-actions.spec.ts` tournent réellement dans la CI (`.github/workflows/e2e.yml`).

Conséquence : la logique back est en place et vérifiable manuellement, mais **aucune garantie automatisée** que les parcours bout-en-bout (caution échouée, signature OTP, J+1, blocage retrait) ne régressent.

### Recommandation — action de finition
Convertir les 3 specs Markdown en specs Playwright `.spec.ts` réelles, branchées sur le fixture `famille-alice` :

1. `tests/e2e/deposits.spec.ts` — scénarios A/B/C (rejoin tardif, dépôt en échec, forçage admin) avec assertions sur `group_members.deposit_status`, `audit_log` et l'UI.
2. `tests/e2e/contract-and-dispute.spec.ts` — scénarios F/G/H (garde-fou `start_cycle`, signature OTP avec mock Nimba, publication template admin) + export PDF avec vérification du hash SHA-256 et de l'URL signée 24 h.
3. `tests/e2e/payout-hold.spec.ts` — scénarios 1 à 7 (détection J+1, application +7 j, blocage `request_withdrawal`, idempotence du log, reset au `start_cycle`, SMS Nimba mocké, resend admin).
4. Ajout des 3 nouvelles specs dans `.github/workflows/e2e.yml` (matrice ou liste).
5. Lancement local via `bunx playwright test` pour confirmer le vert avant push.

Aucune migration ni changement de schéma n'est nécessaire — uniquement de la couverture de test. Une fois ces specs en place, les 4 chantiers sont considérés livrés + verrouillés contre régression.