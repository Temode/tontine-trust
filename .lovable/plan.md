## Problème

Lorsqu'un groupe est mis en pause (`groups.status = 'paused'`), les membres peuvent encore lancer un paiement Djomy. La RPC `start_djomy_payment` ne vérifie que le contributeur et le statut de la cotisation, jamais l'état du groupe. La vue `my_contributions_due` et la liste « À régler » continuent donc d'exposer les cotisations du groupe en pause avec un bouton **Payer** actif.

## Correctifs

### 1. Bloquer côté base (source de vérité)

Nouvelle migration qui remplace `public.start_djomy_payment` pour :
- charger `groups.status` via `v_contrib.group_id` ;
- lever `GROUP_PAUSED` si `status = 'paused'` ;
- lever `GROUP_NOT_ACTIVE` si `status in ('archived','closed','deleted')`.

Cela ferme la porte même si l'UI est contournée (appel direct RPC / Edge).

### 2. Masquer les cotisations dans la vue « dues »

Mettre à jour `public.my_contributions_due` pour ajouter dans le `WHERE` :
```
and g.status not in ('paused','archived','closed')
and g.deleted_at is null
```
Conséquence directe :
- Le dialogue « Payer mes cotisations » (`PayContributionsDialog`) n'affiche plus les cotisations du groupe en pause.
- La page `/cotisations` (MyContributions) idem.
- Le compteur de dues sur le Dashboard est automatiquement à jour.

### 3. Feedback côté UI (frontend, presentation only)

- `src/pages/GroupDetail.tsx` : lorsque `group.status === 'paused'`, afficher un bandeau « Cycle en pause — paiements suspendus » et masquer/désactiver le bouton **Payer ma cotisation** (badge « En pause » à la place). Le bouton **Reprendre** de l'organisateur reste visible.
- `src/lib/payment/launchDjomyCheckout.ts` : intercepter l'erreur `GROUP_PAUSED` renvoyée par la RPC et afficher un toast clair : « Ce groupe est en pause, les paiements sont suspendus. ».

Aucune modification de logique métier hors paiement.

## Fichiers touchés

```text
supabase/migrations/<new>_block_payment_when_paused.sql   (RPC + vue)
src/pages/GroupDetail.tsx                                 (bandeau + bouton)
src/lib/payment/launchDjomyCheckout.ts                    (toast d'erreur)
```

## Validation

1. Sur « Famille Moussa » (en pause) avec le compte Bob : `/cotisations` ne montre plus la dette, le dialogue « Payer » est vide pour ce groupe, et la page du groupe affiche le bandeau « Cycle en pause ».
2. Tenter `supabase.rpc('start_djomy_payment', …)` directement → erreur `GROUP_PAUSED`.
3. Après `resume_cycle`, la cotisation réapparaît et le paiement repart normalement.
