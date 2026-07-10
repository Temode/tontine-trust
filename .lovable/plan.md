## Problème

La page `/abonnement/confirmation` ne fait que du polling de la table `user_subscriptions`. Elle reste bloquée si le webhook Djomy n'a pas encore été livré ou si sa signature n'est pas validée. À l'inverse, `/payment/return` (cotisations) déclenche activement une réconciliation côté serveur : elle appelle `djomy-payment-status` qui interroge Djomy et applique `apply_djomy_webhook` sans attendre le webhook, puis écoute Realtime pour l'update instantané.

Il faut appliquer exactement le même schéma aux abonnements.

## Plan

### 1. Nouvelle Edge Function `djomy-subscription-status`
Miroir de `djomy-payment-status` pour les abonnements :
- Input : `{ subscriptionId }` (ou `transactionId`)
- Lit la ligne `user_subscriptions` (service role) après vérification de l'ownership utilisateur
- Si déjà `active/trialing/failed/cancelled` → retour immédiat
- Sinon appelle `GET /v1/payments/{txId}/status` sur Djomy via `djomyFetch`
- Mappe le statut (`SUCCESS→active`, `FAILED→failed`, `CANCELLED→cancelled`, `PENDING→pending`) et exécute `apply_subscription_webhook`
- Déclenche `accrue_referral_earning` en cas de succès (parité avec le webhook)
- Retourne `{ status, subscriptionId }`

Déclarer la fonction dans `supabase/config.toml` (verify_jwt=true).

### 2. Frontend : `SubscriptionCheckout.tsx`
Après l'appel `djomy-init-subscription`, stocker en `sessionStorage` :
- `lastDjomySubscriptionId` = `subscriptionId`
- `lastDjomySubscriptionTxId` = `transactionId`

Passer aussi `?sid={id}` dans `returnUrl` pour ne pas dépendre du sessionStorage si le navigateur le purge.

### 3. Refonte de `SubscriptionConfirmation.tsx`
Aligner sur `PaymentReturn` :

1. **Résolution de l'abonnement** : lire `sid` / `transactionId` dans l'URL, sinon fallback `sessionStorage`, sinon fallback dernier `user_subscriptions` du user.
2. **Réconciliation active immédiate** au montage : `supabase.functions.invoke("djomy-subscription-status", { body: { subscriptionId } })`. Cela force la mise à jour DB sans attendre le webhook.
3. **Realtime** : `supabase.channel(...).on("postgres_changes", { event:"UPDATE", table:"user_subscriptions", filter:"id=eq.<id>" }, ...)` pour couper le spinner dès l'UPDATE (par le webhook OU par la réconciliation).
4. **Polling de secours** allégé : 2 s pendant 30 s (au lieu de 60 s) uniquement si Realtime n'a rien remonté.
5. **Écran de succès professionnel** : icône `CheckCircle2`, titre « Félicitations ! Votre abonnement {plan} est activé. », récap plan/montant/échéance, bouton principal « Aller au tableau de bord » + secondaire « Retour aux abonnements ». Nettoyage `sessionStorage` (options + IDs) + `refetchEntitlements()`.
6. **Gestion d'erreurs** : si `failed/cancelled` → écran d'échec avec « Réessayer le paiement » qui repointe vers `/abonnement/checkout?plan={plan}` (options conservées).

### 4. Vérifs
- Confirmer que `apply_subscription_webhook` accepte le status `active` (retour de la RPC). Sinon, envoyer `succeeded` puis laisser la RPC mapper (déjà le cas d'après la migration `20260710191224`).
- La policy RLS `user reads own subscription` permet déjà au client de lire son abonnement pour le polling.
- Aucun changement de schéma DB requis.

### 5. Test
- Playwright : script qui restaure la session, ouvre `/abonnement/confirmation?sid=<pending-sub-id>`, simule côté DB un UPDATE `status=active`, vérifie que le titre passe à « Félicitations ! ».
- Vérifier logs `djomy-subscription-status` via `supabase--edge_function_logs` après un vrai paiement.

## Fichiers touchés

- **Créé** : `supabase/functions/djomy-subscription-status/index.ts`
- **Édité** : `supabase/config.toml` (déclaration function)
- **Édité** : `src/pages/SubscriptionCheckout.tsx` (stockage IDs + `?sid=` dans returnUrl)
- **Édité** : `src/pages/SubscriptionConfirmation.tsx` (réconciliation active + Realtime + écran succès)
- **Édité (option)** : `tests/e2e/subscription-checkout.spec.ts` (cas confirmation)
