# Test E2E Paiement Djomy + Audit UX

## Objectif
Exécuter un parcours de bout en bout sur la preview en se connectant successivement avec **Alice** (organisatrice) puis **Bob** (membre payeur), pour :
1. Vérifier que le flux de paiement Djomy s'initialise correctement (jusqu'à la redirection vers le portail sandbox).
2. Capturer un audit UX (captures d'écran + observations) à chaque étape clé.

## Périmètre du test fonctionnel

Parcours **Bob (membre)** — chemin principal :
- Connexion via `/auth`
- Dashboard → carte "À payer" / "Mes cotisations"
- Page `/cotisations` (MyContributions)
- Ouverture de `DjomyPaymentModal` sur une cotisation due
- Sélection du moyen (OM / MTN / CARD), saisie du numéro
- Clic "Continuer vers Djomy" → vérifier :
  - appel à l'edge function `djomy-init-payment`
  - création d'une ligne `payments` en statut `initiated` avec `djomy_transaction_id` et `redirect_url`
  - réception d'une `redirectUrl` valide (`https://…`) — **on s'arrête juste avant la redirection** (on ne peut pas finaliser le paiement réel côté Djomy depuis Playwright)
- Retour simulé via `/payment/return?transactionId=…` → vérifier l'écran de polling

Parcours **Alice (organisatrice)** — vérification côté admin :
- Connexion, ouverture du groupe
- Onglet "Paiements" / historique : la tentative de Bob apparaît bien (statut `initiated` ou `pending`)
- Aucun écran cassé, aucune erreur console

## Audit UX — grille d'observation

Pour chaque écran capturé, noter :
- **Lisibilité** : hiérarchie, contraste, densité d'information
- **Clarté du CTA** : action principale visible, libellé sans ambiguïté
- **Feedback** : loaders, toasts, états vides, gestion d'erreurs
- **Cohérence visuelle** : respect tokens (bleu sarcelle / or), pas de hardcoded colors visibles
- **Mobile-readiness** : le test tournera aussi en viewport 390×844 sur 2-3 écrans clés
- **Accessibilité rapide** : labels formulaire, focus visibles, rôles ARIA sur la modale paiement
- **Friction** : nombre de clics jusqu'au paiement, champs pré-remplis ou non (téléphone)

## Détails techniques

Script Playwright sous `/tmp/browser/djomy-e2e/` :
- Chromium headless, viewport 1280×1800 (desktop) + run secondaire 390×844 (mobile)
- Lecture des logs console + requêtes réseau (filtrage `djomy-init-payment`, `payments`)
- Captures numérotées par étape dans `/tmp/browser/djomy-e2e/screenshots/`
- Pas de seed : on utilise les comptes fournis tels quels. Si Bob n'a pas de cotisation due visible, le test bascule en mode "audit UX seul" sur les écrans accessibles et le signale.
- Aucun secret n'est loggé (numéros de téléphone masqués dans le rapport).

## Livrables

1. Tableau récapitulatif : étape → résultat (✅ / ⚠️ / ❌) → capture
2. Liste priorisée des points UX (Bloquant / Majeur / Mineur / Polish)
3. Erreurs console / réseau détectées avec contexte
4. Recommandations concrètes (fichiers concernés) — **sans modification de code** dans ce tour

## Hors périmètre
- Finalisation réelle du paiement côté Djomy (nécessite le portail sandbox interactif)
- Test du webhook (nécessite un appel signé depuis Djomy — peut être simulé séparément si souhaité)
- Modifications de code : ce plan est strictement diagnostic
