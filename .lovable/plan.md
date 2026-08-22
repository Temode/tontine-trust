# Audit : les 100 SMS inclus dans Premium n'ont jamais été crédités

## Ce que j'ai vérifié en base

- Le plan `premium` déclare bien `sms_included = 100` (et `business` = 200).
- Hadja Kankou Touré a un abonnement `premium` **actif** depuis le 12/07, renouvelé le 30/07, téléphone renseigné (+224 623708727).
- La table `sms_wallets` est **vide** : aucun utilisateur, ni elle ni vous, n'a de portefeuille SMS.
- La table `sms_ledger` est **vide** : aucun crédit `plan_grant` n'a jamais été écrit.

## Cause racine (confirmée)

La fonction qui active un abonnement après paiement (`apply_subscription_webhook`) met à jour le statut, la période et la référence de paiement — mais **n'appelle jamais** la fonction de crédit `sms_wallet_credit`. Aucune fonction du projet ne lit `sms_included` pour créditer un portefeuille : ce champ n'est utilisé que pour l'affichage des droits.

Conséquence en chaîne : le routage SMS (`try_send_notification_sms`) voit un abonnement valide, puis lit un solde `NULL`, et classe l'envoi en `wallet_empty`. C'est exactement pourquoi Kankou n'a pas reçu de SMS lors de la demande de relance de cycle, alors que l'email est bien parti.

## Ce qu'il faut mettre en place

### 1. Créditer les SMS inclus à l'activation
Dans la fonction d'activation d'abonnement, lorsqu'une ligne passe à `active` : créditer `sms_included` du plan via `sms_wallet_credit` avec la raison `plan_grant`, en une seule fois par période de facturation (clé d'idempotence = abonnement + date de début de période), afin qu'un webhook rejoué ne double pas le crédit.

### 2. Recréditer à chaque renouvellement
Au renouvellement (nouvelle période), un nouveau lot de SMS inclus est accordé. Règle à trancher ci-dessous : soit le reliquat non consommé est reporté, soit il est remis à la valeur du plan.

### 3. Rattrapage des abonnés déjà payants
Créditer rétroactivement les comptes ayant un abonnement `premium`/`business` actif et jamais crédités : Kankou et votre compte, plus tout autre cas identique. Chaque crédit passe par le grand livre SMS (`sms_ledger`), donc traçable en back-office.

### 4. Changement de plan / options
Si l'utilisateur change de plan en cours de période, ne créditer que le différentiel positif, jamais de débit rétroactif.

### 5. Visibilité
- Afficher le solde SMS et son origine (inclus dans le forfait vs acheté) sur la page Abonnement et sur la page de recharge SMS.
- Back-office : voir le solde et l'historique des crédits par utilisateur.

### 6. Non-régression
- Test SQL : activation d'un premium → solde 100, ledger `plan_grant` unique, webhook rejoué → solde inchangé.
- Test SQL : renouvellement → second crédit selon la règle choisie.
- Test SQL : notification critique avec solde > 0 → `sms_outbox` alimenté, solde décrémenté (plus de `wallet_empty`).

## Détails techniques

- Migration modifiant `public.apply_subscription_webhook` : après la bascule en `active`, lecture de `subscription_plans.sms_included` pour le `plan_code` de la ligne, puis `sms_wallet_credit(user_id, qty, 'plan_grant', subscription_id, {period_start})`. Garde d'idempotence via une vérification d'existence dans `sms_ledger` sur `ref_id` + `metadata->>'period_start'`.
- Même crédit à appliquer sur le chemin de renouvellement de période (là où `current_period_end` est prolongé) et sur toute activation manuelle admin.
- Script de rattrapage en une passe sur les abonnements actifs sans ligne `plan_grant`.
- Front : `src/pages/Subscription.tsx` et la page de recharge SMS affichent `balance_remaining` avec la ventilation issue de `sms_ledger`.
