# Refonte du tunnel d'achat abonnement (modèle Hostinger)

Objectif : passer d'une page unique combinée (pricing + config + téléphone + CTA) à un parcours en 2 étapes clair et sans friction, en **supprimant définitivement la saisie du numéro** (Djomy la demande de toute façon, et elle est inutile pour un paiement carte).

## Étape 1 — Page pricing (`/abonnement`)

Refonte de `src/pages/Subscription.tsx` :
- Conserve : bandeau usage/quotas, encart plan actuel, alertes read-only.
- **Supprime** : champ "Téléphone Mobile Money" (state `payerPhone`, `<Input>`, validation).
- **Supprime** : sliders Premium inline et calcul de prix dynamique (déplacés à l'étape 2).
- Trois cartes Free / Premium / Business avec un bouton unique chacune :
  - **Free** → active immédiatement via `start_subscription_checkout` (inchangé).
  - **Premium** → `navigate("/abonnement/checkout?plan=premium")`. Prix affiché "À partir de {min_price} GNF/mois".
  - **Business** → `navigate("/abonnement/checkout?plan=business")`. Prix fixe.

## Étape 2 — Page récapitulative (`/abonnement/checkout`)

Nouvelle page `src/pages/SubscriptionCheckout.tsx` (route ajoutée dans `src/App.tsx`, sous `AppShell` protégé).

Lecture du paramètre `?plan=premium|business`. Si invalide/manquant → redirect `/abonnement`.

Layout 2 colonnes desktop / stacked mobile, inspiré cart.hostinger.com :

**Colonne gauche — Configuration**
- Titre du plan + description + liste des avantages inclus.
- Si `plan=premium` : sliders `tier_options` (issus de `subscription_plans.tiers`), initialisés avec l'abonnement actuel si applicable, sinon `base`.
- Si `plan=business` : simple récapitulatif fixe, pas de config.

**Colonne droite — Résumé de la commande (sticky)**
- Ligne "Abonnement {label} — mensuel".
- Prix total en gras, mis à jour dynamiquement à chaque changement de slider (Premium : entre `min_price` et `max_price` de `tiers`, formule identique à celle actuellement dans `Subscription.tsx`).
- Mention "Facturation mensuelle, résiliable à tout moment · Paiement sécurisé Djomy (OM, MoMo, Carte)".
- **Bouton unique "Procéder au paiement"** → appelle `supabase.functions.invoke("djomy-init-subscription", { body: { planCode, tierOptions, returnUrl, cancelUrl } })` puis `window.location.assign(redirectUrl)`. Aucun état intermédiaire, aucune modale.
- Lien discret "← Retour aux plans".

## Détails techniques

### Edge function `djomy-init-subscription` (Option B — retenue)
Actuellement `payerPhone` est **obligatoire** (rejet `MISSING_FIELDS` sinon) et est passé à Djomy dans `payerNumber`. Modifications :
- Retirer `payerPhone` du type `Body`.
- Retirer la vérification `!body.payerPhone` et l'appel à `normalizePhone`.
- Ne plus envoyer la clé `payerNumber` dans le body vers `POST /v1/payments/gateway` — Djomy la demandera sur son écran (comme il le fait déjà pour Orange Money / MoMo, et comme elle est inutile pour Carte).
- Aucun autre changement (auth, RPC `start_subscription_checkout`, webhook restent identiques).

### Routing
- Nouvelle route `/abonnement/checkout` dans `src/App.tsx` (lazy import + `RouteBoundary`, dans le bloc `AppShell` protégé, à côté de `/abonnement`).

### Types / API
- Réutilise `subscription_plans` (fetch par `code` dans la page checkout pour supporter le deep-link).

### Tests
- Nouveau `tests/e2e/subscription-checkout.spec.ts` : depuis `/abonnement`, clic Premium → arrivée sur `/abonnement/checkout?plan=premium` → sliders visibles → résumé se met à jour → bouton "Procéder au paiement" présent et cliquable. Vérifie aussi qu'aucun champ téléphone n'existe sur `/abonnement`.

## Fichiers touchés

- ✏️ `src/pages/Subscription.tsx` — retire champ tel + sliders inline + logique checkout ; les boutons Premium/Business redirigent vers `/abonnement/checkout`.
- ➕ `src/pages/SubscriptionCheckout.tsx` — nouvelle page panier/récap avec bouton unique.
- ✏️ `src/App.tsx` — ajout route + lazy import.
- ✏️ `supabase/functions/djomy-init-subscription/index.ts` — suppression paramètre `payerPhone` (obligatoire → retiré).
- ➕ `tests/e2e/subscription-checkout.spec.ts` — parcours 2 étapes.

## Hors périmètre

- Pas de changement DB / RPC / webhook.
- Pas de refonte du reste du back-office abonnements.
- Pas de changement du flux de paiement des cotisations (`launchDjomyCheckout`).
