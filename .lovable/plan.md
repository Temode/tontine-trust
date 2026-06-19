
# Passage Djomy en mode production (live)

## Ce qui change
Le code reste identique : `supabase/functions/_shared/djomy.ts` choisit déjà l'URL sandbox ou prod à partir de la variable d'environnement `DJOMY_ENV`. Il suffit donc de :

1. Mettre à jour 3 secrets côté backend avec les valeurs **live** affichées dans l'espace développeur Djomy.
2. Configurer le webhook live côté Djomy pour pointer vers notre edge function.
3. Redéployer les 3 fonctions Djomy pour qu'elles relisent les nouveaux secrets.
4. Faire un paiement test réel de petit montant pour valider.

## Étapes détaillées

### 1. Mise à jour des secrets (via `update_secret`)
Une fenêtre sécurisée s'ouvrira, vous y collerez les valeurs depuis Djomy → Espace développeur → "Identifiants de production (live)" :

- `DJOMY_CLIENT_ID` → `djomy-client-1781853075821-edf9` (celui visible sur la capture)
- `DJOMY_CLIENT_SECRET` → cliquer sur l'œil pour révéler la clé live, puis la copier
- `DJOMY_WEBHOOK_SECRET` → à récupérer dans la section "Webhooks" de l'espace développeur (signing secret live, distinct du client secret)
- `DJOMY_ENV` → valeur `prod` (à ajouter si absent ; sinon la passer de `sandbox` à `prod`)

### 2. Configuration webhook côté Djomy
Dans la section **Webhooks** de l'espace développeur Djomy (visible en bas de votre capture), saisir :

- **URL du webhook** :  
  `https://oljyzmannzejtsbfpzxp.supabase.co/functions/v1/djomy-webhook`
- **Événements à activer** : `payment.success`, `payment.failed`, `payment.cancelled`, `payment.pending`, `payment.created`, `payment.redirected` (tous ceux liés aux paiements).
- **Sauvegarder** puis copier le signing secret généré → c'est lui qui va dans `DJOMY_WEBHOOK_SECRET`.

### 3. Redéploiement des edge functions
Une fois les secrets à jour, je redéploie :
- `djomy-init-payment`
- `djomy-webhook`
- `djomy-payment-status`
- `djomy-admin-replay`

Cela force la relecture des nouvelles variables d'environnement.

### 4. Validation en production
Plan de test recommandé :
1. Sur l'app publiée `https://tontine-digitale.lovable.app`, lancer un paiement réel de très faible montant (ex. 100 GNF si autorisé, sinon le minimum Djomy live) avec votre propre numéro Orange Money ou MTN.
2. Vérifier la redirection vers la page Djomy **live** (URL `djomy.africa`, plus `sandbox-`).
3. Confirmer le débit sur votre numéro, puis vérifier dans l'app :
   - Le widget « Paiements en cours » passe à **Confirmé**.
   - Le reçu apparaît dans `Mes cotisations`.
   - Dans l'admin → Paiements, le statut est `succeeded` et `djomy_webhook_events` contient l'événement avec `signature_valid = true`.
4. Si le webhook n'arrive pas : utiliser le bouton « Rejouer » de l'admin pour vérifier que le RPC interne fonctionne (ça permet d'isoler "problème côté Djomy" vs "problème côté app").

## Pré-requis avant que je lance le passage en prod
Merci de confirmer ces 3 points :

1. **Le compte Djomy est bien activé en live** (KYC validé, encaissement autorisé). La présence de la section "Identifiants de production (live)" suggère que oui.
2. **Vous avez le `DJOMY_WEBHOOK_SECRET` live sous la main** (ou êtes prêt à le créer en sauvegardant l'URL webhook ci-dessus).
3. **Numéro de test prêt** (Orange Money ou MTN MoMo Guinée approvisionné) pour valider après bascule.

## Rollback rapide
Si quelque chose tourne mal, on revient à sandbox en passant `DJOMY_ENV` à `sandbox` et en remettant les anciens `CLIENT_ID` / `CLIENT_SECRET` / `WEBHOOK_SECRET` sandbox. Aucun changement de code requis.

## Hors-scope (à traiter séparément si besoin)
- Suppression de l'encart "Mode Sandbox" / pages d'info dédiées sandbox éventuellement présentes dans l'UI.
- Mise à jour de la documentation README pour mentionner l'environnement prod.
