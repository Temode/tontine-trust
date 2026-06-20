## Objectif
Suppression validée ✅ — passons au test réel Djomy production avec un cycle de 1 000 GNF débité sur le 611 59 93 95.

## Étapes

### 1. Création du groupe de test (via compte Alice Organisateur)
- Nom: `Test Djomy Prod 1000`
- Montant cotisation: **1 000 GNF**
- Fréquence: hebdomadaire
- Membres: Alice (organisateur) + Bob (participant)
- Ordre de rotation: Bob en position 1 (bénéficiaire du 1er cycle) pour qu'Alice paie en premier — OU inverse selon préférence

### 2. Invitation et acceptation Bob
- Génération du lien d'invitation depuis le compte Alice
- Connexion compte Bob, acceptation de l'invitation
- Vérification du démarrage du cycle 1

### 3. Test paiement réel Djomy (Orange Money)
- Connexion compte **Alice** (la payeuse du cycle 1)
- Déclenchement cotisation 1 000 GNF
- Méthode: **OM** (Orange Money)
- Numéro: **611 59 93 95**
- Vérification:
  - Réception du push USSD sur le téléphone
  - Validation du PIN OM côté téléphone
  - Réception du webhook Djomy → mise à jour du statut paiement en base
  - Affichage `confirmed` dans l'UI
  - Mise à jour du solde du cycle pour Bob (bénéficiaire)

### 4. Vérifications post-paiement
- Logs edge function `djomy-payment-init` et `djomy-webhook`
- Table `payments`: statut, transaction_id Djomy, montant
- Notification reçue par Bob
- Score de fiabilité d'Alice mis à jour

## Question avant exécution
Confirmez-vous:
- **Qui paie**: Alice débite son 611 59 93 95 (je crée donc Bob comme bénéficiaire du cycle 1) ? Ou l'inverse (Bob paie depuis le 611) ?
- **Téléphone prêt** à recevoir le push USSD Orange Money maintenant ?

Dès validation, je passe en build mode et j'exécute les étapes 1→4 via les RPC et edge functions existantes (pas de nouveau code attendu, sauf bug rencontré pendant le test).
