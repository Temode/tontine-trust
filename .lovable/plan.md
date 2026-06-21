# Audit (corrigé) et nettoyage du flux paiement

## 1. Constat — pourquoi aucun membre n'a payé sur les tontines existantes

État réel des `payments` des deux groupes d'Alice :

- **14 tentatives** au total sur la contribution 1000 GNF + 100 000 GNF.
- **0 paiement `succeeded`**. Tout est resté `initiated` ou `pending`.
- Aucun `error_message` enregistré.

Causes identifiées :
1. **Bug montant ×100 côté Djomy** : la contribution est de 1 000 GNF dans notre base, l'edge function `djomy-init-payment` envoie bien `amount: 1000` à `/v1/payments/gateway`, mais la page Djomy affiche **100 000 GNF**. Symptôme classique d'unités mineures ("centimes") interprétées par Djomy. À corriger (voir §3).
2. **Webhook jamais reçu / statut jamais rafraîchi** : les paiements restent `initiated/pending` parce qu'aucun callback Djomy ne les confirme. Il manque une vérification automatique du statut au retour utilisateur (`/payment/return`) en plus du webhook.
3. **Modale intermédiaire inutile** : la sélection OM/MOMO/CARD côté app fait doublon avec la page de gateway Djomy qui propose déjà tous les moyens (Orange Money, MTN MoMo, Visa/Mastercard). L'utilisateur clique deux fois pour la même décision.

## 2. Suppression du « Mode test » (alignement doctrine design)

- **Supprimer** `src/components/group/TestModePanel.tsx`.
- **Retirer son import et son onglet** dans `src/pages/GroupDetail.tsx` (et tout déclencheur côté `GroupSettings.tsx`).
- **Retirer la mention « Mode test »** dans `DjomyPaymentModal.tsx` / écrans liés.
- Ne RIEN ajouter de simulation côté front : on traite la production comme la production. La doctrine interdit toute esthétique de jeu / bac à sable visible par l'utilisateur final.

## 3. Correction du montant envoyé à Djomy

- **Reproduire** : poser un `console.log` ciblé dans `djomy-init-payment` (`amount` envoyé + body brut Djomy + réponse `data`) puis relancer un paiement de 1 000 GNF et observer dans `supabase--edge_function_logs` ce que Djomy renvoie comme montant.
- Selon le résultat :
  - Si la réponse Djomy contient déjà `100000` → leur API utilise des centimes. Adapter en envoyant `amount * 100` côté serveur **et** documenter dans `mem/tech/partenaire-djomy.md`. Côté affichage front (DB, reçus, contributions) on garde les GNF entiers.
  - Si la réponse renvoie `1000` mais la page affiche `100000` → bug d'affichage Djomy à signaler ; en attendant, envoyer `amount` ajusté pour matcher leur convention.
- Ajouter un test unitaire dans `supabase/functions/_shared` qui fige la conversion, pour éviter une régression silencieuse.

## 4. Suppression de la modale de paiement intermédiaire

- **Supprimer** `src/components/payment/DjomyPaymentModal.tsx` et `src/components/payment/PaymentModal.tsx` (et leurs imports : `MyContributions.tsx`, `DueCard.tsx`, `PayContributionsDialog.tsx`, etc.).
- Remplacer chaque bouton « Payer » par un appel direct :
  1. RPC `start_djomy_payment(contribution_id, _method := NULL, _payer_phone := profile.phone)`.
  2. `supabase.functions.invoke('djomy-init-payment', { body: { contributionId, returnUrl, cancelUrl } })`.
  3. `window.location.assign(redirectUrl)` vers la page Djomy qui propose elle-même OM, MoMo, Visa.
- Adapter `start_djomy_payment` (migration) : `_method` devient optionnel ; et `djomy-init-payment` envoie `allowedPaymentMethods: ["OM","MOMO","CARD"]` par défaut.
- Conserver un `PaymentTracker` léger (toast + polling de `getDjomyPaymentStatus`) après retour sur `/payment/return` pour mettre à jour les statuts `initiated → pending → succeeded/failed` sans dépendre uniquement du webhook.

## 5. Visibilité de l'historique des cotisations dans chaque groupe

Dans `GroupDetail.tsx`, dans l'onglet de l'organisateur, vérifier que `PaymentsHistoryPanel` est bien monté pour Alice et qu'il affiche les 14 tentatives existantes (statut, méthode, date). Si une ligne n'apparaît pas, corriger la requête `listGroupPayments` (RLS : ajouter une policy `SELECT` sur `payments` pour les co-organisateurs du `group_id`).

## Hors périmètre

- Aucun outil de simulation / sandbox visible utilisateur.
- Pas de modification du système Défauts / Disputes (déjà audité, ok, juste invisible car aucune échéance n'est encore passée — c'est conforme).
- Pas de refonte UI au-delà du retrait des écrans listés.

## Détails techniques

- 1 migration : `start_djomy_payment` accepte `_method text DEFAULT NULL` ; ajustement éventuel d'unité monétaire géré côté edge function uniquement.
- Fichiers supprimés : `TestModePanel.tsx`, `DjomyPaymentModal.tsx`, `PaymentModal.tsx`.
- Fichiers modifiés : `GroupDetail.tsx`, `GroupSettings.tsx`, `MyContributions.tsx`, `DueCard.tsx`, `PayContributionsDialog.tsx`, `djomy-init-payment/index.ts`, `lib/api/djomy.ts`, `mem/tech/partenaire-djomy.md`.
- Tests : un test Deno pour la conversion de montant + une vérif Playwright que cliquer « Payer » redirige directement vers `djomy.africa`.
