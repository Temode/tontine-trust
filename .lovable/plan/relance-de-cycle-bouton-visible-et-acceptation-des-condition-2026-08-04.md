# Relance de cycle : bouton visible et acceptation des conditions

## Le problème constaté
Sur la page du groupe « Epargne », l'action de relance n'était pas trouvable : la bannière orange « Signature requise » se trouve en bas de page, et l'encart de relance reste discret dans le flux, sous la barre d'actions. L'utilisateur doit deviner qu'il faut d'abord signer avant de pouvoir relancer.

## Ce qu'on change

### 1. L'action de relance devient l'action principale de la page
Quand le cycle précédent est terminé et qu'aucune relance n'est ouverte, la page affiche en tête (juste sous le bandeau du groupe, avant la barre d'actions) un encart pleine largeur et contrasté :
- titre « Le cycle 1 est terminé — relancer une nouvelle tontine »,
- rappel court : chaque membre devra confirmer, rien n'est reconduit automatiquement,
- un unique bouton primaire « Préparer la relance », visible sans défilement.

Le bouton primaire de la barre d'actions devient également « Préparer la relance » dans cet état, et la même action est proposée dans le menu « Actions ». Pour les membres non organisateurs, l'encart affiche « L'organisateur peut relancer un nouveau cycle » sans bouton.

### 2. Plus de signature par code SMS : une simple acceptation des conditions
La bannière orange « Signature requise » et la signature électronique par code SMS sont retirées de ce parcours. À la place, le parcours de relance devient un assistant en deux étapes dans la même modale :

```text
Étape 1 — Conditions                Étape 2 — Conditions de la relance
Conditions générales d'utilisation  Seuil minimum de participants
et protection des données  ──────>  Date limite de réponse
[x] J'accepte                       [Lancer la demande de relance]
```

- L'étape 1 affiche les conditions générales d'utilisation et de protection des données de Tontine Digitale, avec une seule case à cocher : « J'ai lu et j'accepte les conditions générales d'utilisation et la politique de protection des données ». Aucun numéro de téléphone, aucun code SMS.
- Si l'utilisateur a déjà accepté la version en vigueur, l'étape 1 est sautée et la modale s'ouvre directement sur les conditions de la relance.
- L'acceptation est horodatée et conservée (utilisateur, groupe, version du texte, date) comme preuve de consentement.
- Une fois la case cochée, on enchaîne sans fermeture de modale sur l'étape 2, puis sur l'envoi de la demande de relance (seuil, délai, notifications in-app/email/SMS).

### 3. Cohérence pour les membres
Un membre qui n'a pas encore accepté les conditions et qui clique sur « Je participe » voit d'abord l'écran d'acceptation, coche la case, et son vote est enregistré dans la foulée. Aucun message d'erreur brut n'est renvoyé.

## Détails techniques
- `src/pages/GroupDetail.tsx` : remonter `RenewalPanel` au-dessus de la barre d'actions quand `cycleFinished` ; retirer `ContractSignSection` de ce parcours ; ajouter « Préparer la relance » dans l'action primaire et le menu Actions.
- `src/components/group/RenewalPanel.tsx` : état 1 restylé en encart primaire pleine largeur ; le vote membre ouvre l'écran d'acceptation si les conditions ne sont pas encore acceptées.
- `src/components/group/RenewalLaunchDialog.tsx` : état d'étape (`terms` | `settings`) avec saut automatique si l'acceptation existe déjà.
- Nouveau composant `src/components/legal/TermsAcceptStep.tsx` : texte des conditions + case à cocher + bouton « J'accepte et je continue », réutilisable ailleurs.
- Migration : table `terms_acceptances` (utilisateur, groupe, version, date) avec GRANT et RLS (chacun lit et écrit uniquement ses propres acceptations) ; RPC `accept_group_terms(_group_id, _version)` et `get_my_terms_acceptance(_group_id)`.
- Migration : `start_renewed_cycle` et `vote_cycle_renewal` remplacent la vérification `CONTRACT_NOT_SIGNED` (signature OTP) par la vérification de l'acceptation des conditions — la signature par code SMS n'est plus requise pour relancer un cycle.
- `ContractSignDialog` n'est plus utilisé dans le parcours de relance ; il reste en place pour ses autres usages.
- Tests : mise à jour de `tests/e2e/cycle-renewal.spec.ts` (encart visible sans défilement, modale démarrant sur l'acceptation) et test SQL vérifiant qu'un cycle ne peut pas être relancé sans acceptation.
