# Relance de cycle : bouton visible et signature intégrée au parcours

## Le problème constaté
Sur la page du groupe « Epargne », l'action de relance n'était pas trouvable : la bannière orange « Signature requise » se trouve en bas de page, et l'encart de relance reste discret dans le flux, sous la barre d'actions. L'utilisateur doit deviner qu'il faut d'abord signer avant de pouvoir relancer.

## Ce qu'on change

### 1. L'action de relance devient l'action principale de la page
Quand le cycle précédent est terminé et qu'aucune relance n'est ouverte, la page affiche en tête (juste sous le bandeau du groupe, avant la barre d'actions) un encart pleine largeur et contrasté :
- titre « Le cycle 1 est terminé — relancer une nouvelle tontine »,
- rappel court : chaque membre devra confirmer, rien n'est reconduit automatiquement,
- un unique bouton primaire « Préparer la relance », visible sans défilement.

Le bouton primaire de la barre d'actions devient également « Préparer la relance » dans cet état, et la même action est proposée dans le menu « Actions ». Pour les membres non organisateurs, l'encart affiche « L'organisateur peut relancer un nouveau cycle » sans bouton.

### 2. La signature du contrat devient une étape du parcours, pas un préalable caché
La bannière orange isolée « Signature requise » disparaît lorsqu'une relance est possible. À la place, le parcours de relance devient un assistant en deux étapes dans la même modale :

```text
Étape 1 — Contrat            Étape 2 — Conditions de la relance
Lecture du contrat  ─────>   Seuil minimum de participants
Case d'acceptation           Date limite de réponse
Code SMS + signature         [Lancer la demande de relance]
```

- Si l'organisateur a déjà signé le contrat en vigueur, l'étape 1 est sautée automatiquement et la modale s'ouvre directement sur les conditions.
- S'il n'a pas signé, l'étape 1 s'affiche d'abord, avec un fil d'Ariane « 1 Contrat · 2 Conditions » pour que la raison du blocage soit immédiate.
- Une fois la signature validée, on enchaîne sans fermeture de modale sur l'étape 2, puis sur l'envoi de la demande de relance, exactement comme prévu aujourd'hui (seuil, délai, notifications in-app/email/SMS).

### 3. Cohérence pour les membres
Pour un membre qui doit voter sur une relance en cours et qui n'a pas encore signé, la carte de vote propose « Je participe » ; si la signature manque, le clic ouvre d'abord la même modale de signature puis enregistre le vote. Aucun message d'erreur brut n'est renvoyé.

## Détails techniques
- `src/pages/GroupDetail.tsx` : remonter `RenewalPanel` au-dessus de la barre d'actions quand `cycleFinished` ; masquer `ContractSignSection` dans ce cas (la signature est portée par la modale) ; ajouter l'entrée « Préparer la relance » dans l'action primaire et le menu Actions.
- `src/components/group/RenewalPanel.tsx` : état 1 restylé en encart primaire pleine largeur ; branchement du vote membre sur la signature manquante.
- `src/components/group/RenewalLaunchDialog.tsx` : ajout d'un état d'étape (`contract` | `settings`), réutilisation du contenu de `ContractSignDialog` (extrait dans un composant interne réutilisable `ContractSignFlow`) pour ne pas dupliquer la logique OTP/hash ; saut automatique de l'étape contrat si `getMyContractSignature` renvoie une signature.
- `src/components/contract/ContractSignDialog.tsx` : refactor non fonctionnel — le corps (revue, case d'acceptation, OTP, signature) est extrait en `ContractSignFlow` avec un callback `onSigned`, la modale existante l'enveloppe telle quelle.
- Aucune modification SQL : `start_renewed_cycle` continue de vérifier `CONTRACT_NOT_SIGNED` côté serveur.
- Tests : mise à jour de `tests/e2e/cycle-renewal.spec.ts` pour vérifier que l'encart de relance est visible sans défilement et que la modale démarre sur l'étape contrat quand la signature manque.
