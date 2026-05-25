## Phase D — Versements & Reçus

Migration C confirmée. Place à Phase D : verser la cagnotte au bénéficiaire du tour et générer un reçu numérique.

### 1. Migration SQL — `db/05_phase_d_payout.sql`

- **Table `receipts`** : `id`, `turn_id`, `group_id`, `beneficiary_user_id`, `amount`, `receipt_number` (unique, format `TD-YYYY-NNNNNN`), `payment_id`, `issued_at`, `hash` (chaîné au ledger).
- **RPC `release_payout(_turn_id uuid, _provider payment_provider default 'simulation')`** :
  - Vérifie : caller = admin/owner du groupe (via `has_group_role`), tour en `collecting`, somme cotisations = `expected_amount`, pas déjà versé.
  - Crée `payments` (sortant, `user_id = beneficiary`, `amount` négatif logiquement mais stocké positif avec type), status `succeeded`.
  - Appelle `append_ledger` avec `entry_type = 'payout_out'`, montant négatif.
  - Crée `receipts` avec numéro séquentiel + hash.
  - Update `turns.status = 'paid'`, `paid_at = now()`.
  - Insère notification au bénéficiaire (`kind = 'payout_released'`).
  - Si dernier tour du cycle → `cycles.status = 'completed'`.
- **View `group_ledger_view`** : ledger lisible (entrées + libellés humains) pour membres du groupe.
- **View `my_receipts`** : reçus du user courant (en tant que bénéficiaire).
- RLS : `receipts` lecture par membre du groupe ; pas d'écriture directe.

### 2. Couche API — `src/lib/api/payouts.ts`

- `releasePayout(turnId, provider?)` → RPC.
- `listGroupLedger(groupId)` → view.
- `listMyReceipts()` → view.
- `getTurnSettlement(turnId)` → cotisations confirmées + total + statut versement.

### 3. UI

- **GroupDetail — onglet Rotation** :
  - Sur tour en `collecting` et user = owner/admin → bouton **« Verser au bénéficiaire »** (montant + bénéficiaire affichés, confirmation modale).
  - Sur tour `paid` → badge « Versé » + lien « Voir le reçu ».
  - Mini-tableau ledger du groupe (5 dernières entrées, lien « Voir tout »).
- **Nouvelle page `src/pages/Receipts.tsx`** (`/receipts`) : liste de mes reçus (numéro, groupe, montant, date, bouton télécharger PDF V2 → pour l'instant impression navigateur via `window.print` + vue dédiée).
- **Composant `ReceiptCard`** : aperçu reçu (logo, n°, montant en lettres, parties, hash de vérif).
- **Dashboard** : KPI « Reçu ce mois » remplace un KPI mock si pertinent.
- **Sidebar + BottomNav** : entrée « Reçus ».
- **Notifications** : la notif `payout_released` ouvre la page Receipts.

### 4. Hors scope (phases suivantes)

- Score fiabilité (Phase E)
- Centre de notifications complet (Phase F)
- Génération PDF serveur (sera ajoutée en Phase H ou avec Djomy)
- Intégration Djomy réelle (Phase I — swap `simulation` → `djomy` dans `release_payout`)

### Action utilisateur après mes changements

Exécuter `db/05_phase_d_payout.sql` dans le SQL Editor Supabase, puis confirmer pour enchaîner Phase E (score de fiabilité).
