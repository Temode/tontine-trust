
## 1. Suppression du parcours "Retrait par groupe" (UI) + remboursement Rouguiatou

**Audit effectué en base :**
- Rouguiatou Alas Bah (`b9857ed1-…`) a un solde groupe "Epargne" : crédité 30 000, retiré 29 900, disponible 0.
- Deux demandes dans la table héritée `withdrawal_requests` : une `cancelled` (30 000, 24/06) et **une `pending` de 29 900 datée du 16/07** — jamais traitée par le back-office (qui gère `user_withdrawal_requests`, pas cette table héritée).
- Aucune ligne dans `user_withdrawal_requests` (le nouveau flux consolidé).
- Conclusion : son argent n'a pas été volé mais **gelé** dans une demande fantôme du parcours par groupe qui n'est plus supervisée.

**Actions UI (`src/pages/MyBalance.tsx`) :**
- Retirer la section "Par groupe" (liste avec bouton "Retirer" par tontine, lignes 179–224).
- Retirer la section "Retraits par groupe (historique)" (lignes 246–263).
- Retirer les états, requêtes et dialogue devenus inutiles : `selected`, `WithdrawDialog`, `balancesQ.queryFn=listMyBalances`, `withdrawalsQ.queryFn=listMyWithdrawals`, `EmptyState`, `WithdrawalRow`, `statusLabel`, `METHOD_LABEL`, imports associés.
- Le hero (solde consolidé) et le bouton unique "Faire une demande de retrait" restent. Ajout d'un `EmptyState` léger quand `totalAvailable = 0` et aucune demande.
- On garde `listMyBalances` uniquement pour agréger `total_credited` / `total_withdrawn` / nombre de groupes affichés dans le Hero (aucun changement backend).

**Action data (insert tool) :**
- Marquer la demande fantôme `7337e12f-f7cc-4387-99be-8affed2b371e` comme `cancelled` avec motif "Migration vers portefeuille consolidé" et **restaurer** 29 900 dans `beneficiary_balances.available_amount` de la ligne `52e943d1-…`. Le solde consolidé sera alors immédiatement retirable via le nouveau flux.

## 2. Annuaire "Internationale" : inclure toutes les tontines publiques

Migration SQL : `list_international_groups` élargie —
- Actuellement filtre `is_international=true AND status IN ('draft','open')`.
- Nouveau : inclut aussi `visibility IN ('directory','public-link')`, ajoute `status='active'`, exclut `kind='solo'`, exclut `archived_at`/`deleted_at`. Trois groupes publics existants apparaîtront (Epargne, Tontine Test rapide, Tontine teste).

## 3. Bug création Tontine Solo — enum "archived" inexistant

**Cause :** `create_solo_group` fait `WHERE status <> 'archived'` pour compter les Solo actives, mais l'enum `group_status` ne contient pas `archived` (seulement draft/open/active/completed/cancelled/paused). Postgres lève `invalid input value for enum group_status: "archived"`.

**Fix migration SQL :** remplacer `status <> 'archived'` par `archived_at IS NULL AND deleted_at IS NULL` (colonnes existantes sur `groups`). Aligne aussi `src/pages/Solo.tsx` (filtre `g.status !== "archived"`) → filtrer plutôt sur `!g.archived_at` — nécessite d'exposer `archived_at` dans `list_my_solo_groups` si absent (à vérifier après migration, sinon on garde le filtre côté client sur `status !== 'cancelled'`).

## Détails techniques

- Une seule migration regroupant `create_solo_group` (corrigée) + `list_international_groups` (élargie).
- Un seul appel `insert` pour le remboursement Rouguiatou (UPDATE `withdrawal_requests` + UPDATE `beneficiary_balances`).
- Édition de `src/pages/MyBalance.tsx` uniquement pour la partie UI.
- Aucun changement aux tables, RLS ou GRANTs.

## Ordre d'exécution

1. Migration SQL (fixe Solo + Internationale).
2. Insert tool (rembourse Rouguiatou).
3. Édition `src/pages/MyBalance.tsx`.
4. Vérification build.

Prêt à basculer en mode build ?
