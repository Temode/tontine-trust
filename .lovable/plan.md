## Geler le payout de Rougui, appliquer la pénalité, et créer une caisse de groupe

### État actuel (vérifié en base)
- Demande de retrait `5fddd9e2…` : 30 000 GNF, statut `pending`, **non encore versée**. Le solde a juste été décrémenté côté `beneficiary_balances` (available 0 / withdrawn 30 000).
- Pénalité due par Rougui : `contributions.penalty_amount = 100` GNF (cotisation 8a7a07c1, non waivée).
- Aucune table de « caisse de groupe » n'existe aujourd'hui.

### Ce qu'il faut faire

#### 1) Nouvelle table `group_treasury` + ledger
Migration ajoutant :
- `group_treasury(group_id pk, balance bigint, updated_at)` — solde de la caisse du groupe.
- `group_treasury_entries(id, group_id, amount, source, contribution_id?, user_id?, created_at)` avec `source ∈ ('late_penalty','manual_credit','manual_debit')` pour la traçabilité.
- RLS : lecture pour membres du groupe ; admin du groupe pour `manual_*` ; service_role pour le reste.

#### 2) Évolution de `request_withdrawal`
Avant l'insert de la demande :
- Calculer `v_penalty_due = SUM(penalty_amount)` sur les `contributions` du groupe pour ce user, status `confirmed`, `penalty_waived_at IS NULL`, et **non encore prélevées** (nouveau flag `penalty_collected_at timestamptz`).
- Si `v_penalty_due > 0` :
  - Vérifier `available_amount >= _amount + v_penalty_due`.
  - Décrémenter `beneficiary_balances.available_amount` du **montant + pénalité**.
  - Créditer `group_treasury.balance += v_penalty_due` et insérer une entrée `group_treasury_entries('late_penalty')` par contribution.
  - Marquer ces `contributions.penalty_collected_at = now()`.
- Message d'erreur dédié `PENALTY_DUE:<montant>` côté UI pour expliquer la déduction.

#### 3) Correction rétroactive Rougui (one-shot data fix)
Comme la demande est encore `pending` (rien envoyé chez Djomy), on peut tout réécrire proprement :
- `withdrawal_requests.status = 'cancelled'` + note explicative.
- `beneficiary_balances` : remettre `available_amount = 30 000`, `total_withdrawn = 0`.
- `group_members.was_late_in_cycle = true`, `was_late_at_turn_number = ARRAY[1]` pour Rougui.
- `turns.payout_hold_until = paid_at + 7 jours` (passe à 2026-07-01 21:44 UTC).
- SMS automatique à Rougui : « Suite à un retard de cotisation dans ce cycle, votre retrait est annulé et vos fonds (30 000 GNF) sont remis en attente jusqu'au 01/07/2026. Une pénalité de 100 GNF sera prélevée lors du retrait. »

#### 4) UI `WithdrawDialog`
- Charger le montant total de pénalités dues avant le retrait via une petite RPC `get_pending_penalty(_group_id)`.
- Afficher un panneau « Pénalité de retard : 100 GNF — sera prélevée et versée à la caisse du groupe ».
- Gérer le nouveau code d'erreur `PENALTY_DUE:`.

### Détails techniques

**Schéma**
```text
group_treasury           group_treasury_entries
─────────────            ──────────────────────
group_id  pk             id              uuid pk
balance   bigint         group_id        uuid fk
updated_at               amount          bigint   (signé : + crédit, − débit)
                         source          text     ('late_penalty'|'manual_credit'|'manual_debit')
                         contribution_id uuid?    fk
                         user_id         uuid?    fk
                         created_by      uuid?    (acteur, NULL pour auto)
                         note            text?
                         created_at      timestamptz
```

`contributions` reçoit une colonne `penalty_collected_at timestamptz` pour éviter de prélever deux fois la même pénalité.

**Fichiers impactés**
- `supabase/migrations/<ts>_group_treasury_and_penalty_collection.sql` (nouvelle table, colonne, RPC modifiée, RPC `get_pending_penalty`).
- `supabase/migrations/<ts>_fix_rougui_payout_hold.sql` (data fix one-shot, via `supabase--insert`).
- `src/lib/api/balances.ts` (gestion `PENALTY_DUE`, exposer `getPendingPenalty`).
- `src/components/balance/WithdrawDialog.tsx` (affichage du panneau pénalité).
- Optionnel : page admin « Caisse du groupe » dans `GroupSettings.tsx` pour visualiser `group_treasury` + historique. Je le proposerai en suivi si tu veux.

### Hors périmètre
- UI admin de la caisse du groupe (consultation/débit manuel) — à faire dans un second temps si besoin.
- Logique de redistribution de la caisse en fin de cycle — non demandée, à définir avec toi plus tard.

Je passe en build dès validation.
