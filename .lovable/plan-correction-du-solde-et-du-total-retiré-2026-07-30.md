# Correction du solde et du "Total retiré"

## Ce qui s'est réellement passé (audit)

Le compte Elhadj Mamadou Oury Diallo a été débité **deux fois** pour un seul retrait de 15 000 GNF, et le calcul du portefeuille compte une **troisième** fois ce même retrait.

Faits vérifiés en base :

- Crédité (groupe « Epargne ») : 30 034 GNF. Disponible actuel : 34 GNF. Retiré enregistré : 30 000 GNF.
- Une seule demande de retrait moderne : 15 000 GNF, statut « traité » (12/07/2026).
- Une demande **héritée** de 15 000 GNF du 15/07/2026, restée « en attente », créée par l'ancien module de retrait « par groupe » (depuis supprimé). Cette demande a débité le solde du groupe sans jamais donner lieu à un paiement.

Origine des 3 comptages :

```text
1. Débit ancien module (demande héritée, jamais payée)   -15 000  -> écrit dans le solde du groupe
2. Débit du retrait réel traité par l'admin              -15 000  -> écrit dans le solde du groupe
   => solde du groupe : "retiré" = 30 000, "disponible" = 34

3. get_my_wallet retranche EN PLUS les retraits "traités"
   => disponible = 30 034 - 30 000 - 15 000 = négatif, ramené à 0
   => total retiré = 30 000 + 15 000 = 45 000
```

La page « Mon solde » affiche 0 GNF disponible (venant du portefeuille) et 30 000 GNF retirés (venant des soldes de groupe) : deux sources incohérentes.

## Correctifs

### 1. Formule du portefeuille (`get_my_wallet`)

Les retraits traités sont déjà déduits des soldes de groupe. Le calcul ne doit donc plus les soustraire une seconde fois :

- disponible = crédité − retiré (soldes groupe) − retraits en attente
- total retiré = retiré des soldes de groupe uniquement
- gelé = retraits en attente

### 2. Réparation des données

- Annuler la demande héritée fantôme (15 000 GNF, « en attente », module supprimé) et rétablir les 15 000 GNF sur le solde du groupe concerné : disponible passe de 34 à 15 034 GNF, retiré de 30 000 à 15 000 GNF.
- Balayage global : détecter toute autre demande héritée « en attente » ayant débité un solde, et la traiter de la même façon. Trace écrite dans le journal d'audit pour chaque correction.

### 3. Cohérence de l'affichage

`Mon solde` affichera désormais **total crédité / total retiré / disponible** issus d'une seule source (le portefeuille consolidé), au lieu de mélanger portefeuille et soldes par groupe.

### 4. Garde-fous

- Neutraliser définitivement l'ancienne table de retraits par groupe (aucune nouvelle ligne possible), la fonction associée étant déjà désactivée.
- Contrôle de cohérence ajouté à la page Intégrité de l'admin : pour chaque membre, `retiré (soldes groupe)` doit être égal à la somme des demandes de retrait traitées. Toute divergence est listée.

## Détails techniques

- Migration : refonte de `public.get_my_wallet()` (suppression du double comptage de `user_withdrawal_requests.status='completed'`).
- Migration de réparation : pour chaque ligne `withdrawal_requests` (table héritée) au statut `pending`, passage à `cancelled` + ré-crédit `beneficiary_balances.available_amount += amount`, `total_withdrawn -= amount` (via le marqueur transactionnel `app.withdrawal_ctx` requis par `trg_guard_bb_withdrawn`) + entrée `audit_log`.
- `REVOKE INSERT` sur `public.withdrawal_requests` pour tous les rôles applicatifs.
- Front : `src/pages/MyBalance.tsx` utilise `walletQ.data` pour les trois indicateurs (aujourd'hui `totalCredited`/`totalWithdrawn` sont recalculés depuis `listMyBalances`).
- Vérification post-migration par requête SQL sur le compte concerné (attendu : disponible 15 034, retiré 15 000).
