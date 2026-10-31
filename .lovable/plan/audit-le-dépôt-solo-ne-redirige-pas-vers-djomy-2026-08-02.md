# Audit : le dépôt Solo ne redirige pas vers Djomy

## Diagnostic (vérifié)

Le bouton « Payer » de la modale de dépôt Solo appelle la fonction backend `djomy-init-solo-deposit`. Cette fonction **n'est pas déployée** : l'appel renvoie `404 NOT_FOUND`. Aucune redirection Djomy n'est donc possible.

Éléments confirmés :
- Appel direct à la fonction : `404 {"code":"NOT_FOUND"}`, alors que les autres fonctions Djomy (`djomy-init-payment`, `djomy-init-deposit`, `djomy-payment-status`, `djomy-init-subscription`, `djomy-webhook`) répondent normalement.
- Aucun log pour cette fonction : elle n'a jamais été exécutée.
- La table `solo_deposits` est vide : aucun dépôt n'a jamais été créé.
- Côté base, tout est en place : les fonctions `start_solo_deposit`, `apply_solo_deposit_webhook`, `get_my_solo_group`, `list_solo_deposits` existent bien.
- Le code source de la fonction existe dans le projet mais n'a jamais été publié sur le serveur.

Cause secondaire : l'erreur remontée à l'écran est peu lisible (la modale affiche seulement un message technique), ce qui masque le vrai problème.

## Correctif proposé

1. **Déployer** la fonction `djomy-init-solo-deposit` (et redéployer `djomy-webhook` pour garantir la prise en charge du routage des dépôts Solo).
2. **Vérifier de bout en bout** après déploiement : création d'un dépôt en base au statut « en attente », obtention de l'URL Djomy, redirection.
3. **Améliorer la remontée d'erreur** dans la modale de dépôt : afficher un message clair (« Service de paiement indisponible, réessayez ») quand la fonction est injoignable, plutôt qu'un code technique, et ne pas fermer la modale en cas d'échec.
4. **Contrôle de non-régression** : ajouter au test E2E Solo une assertion qui échoue si l'appel d'initialisation du dépôt ne renvoie pas d'URL de redirection.

## Détails techniques

- Déploiement des Edge Functions `djomy-init-solo-deposit` et `djomy-webhook`.
- `src/lib/api/solo.ts` : dans `startSoloDeposit`, lire le corps de la réponse d'erreur (comme le fait déjà `readFunctionError` dans `src/lib/api/djomy.ts`) et mapper `FunctionsFetchError`/404 vers un message explicite.
- `src/pages/SoloDetail.tsx` (`DepositDialog`) : ne déclencher `onDone()` qu'en cas de succès effectif.
- `tests/e2e/solo.spec.ts` : vérifier la réponse de `functions/v1/djomy-init-solo-deposit`.
