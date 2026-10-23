# Tontine Solo : une vraie épargne libre

## Constat de l'audit

La Solo est aujourd'hui un groupe classique déguisé. Trois problèmes de fond :

1. **La page de détail est celle d'une tontine collective.** `/groupes/:id` affiche invitations, code de parrainage, membres, rotation, échanges, contrat à signer, forfait SMS, « cycle non démarré, il faut 2 membres actifs ». Pour une épargne à un seul membre (moi), tout cela n'a aucun sens et bloque visuellement la page.
2. **Le montant et la fréquence sont imposés à la création** (`create_solo_group` refuse une cotisation nulle et force une fréquence), alors que l'utilisateur veut déposer ce qu'il peut, quand il peut.
3. **Il est en réalité impossible de déposer.** Un dépôt passe par la table des cotisations, qui exige obligatoirement un tour de rotation et n'autorise qu'une cotisation par tour et par personne. Une Solo n'a ni cycle ni tour : le total épargné restera donc à 0, et l'épargne n'alimente jamais le solde retirable.

## Ce qu'on construit

### Création simplifiée
- Plus de cotisation ni de fréquence obligatoires. Champs : nom, description, mode (Projet avec date d'échéance / Fonds de roulement), et **objectif d'épargne optionnel** (montant visé).
- Option facultative « me rappeler d'épargner » (rythme indicatif) — jamais bloquante, aucune pénalité, aucun défaut de paiement.

### Page Solo dédiée `/solo/:id`
Les Solos ne passent plus par la page groupe (redirection automatique). Contenu :
- En-tête : nom, mode, statut de blocage (Projet : « bloqué jusqu'au … »).
- Bloc épargne : total épargné, objectif et barre de progression, reste à épargner, date d'échéance.
- Bouton principal **« Déposer »** : montant libre saisi par l'utilisateur, paiement Djomy (OM / MOMO / Carte).
- Historique des dépôts (date, montant, moyen, statut, reçu).
- Bouton **« Retirer »** : envoie vers le portefeuille global ; désactivé avec explication si la Solo Projet est encore bloquée.
- Réglages légers : renommer, ajuster l'objectif, prolonger/lever l'échéance, archiver.
- Aucun onglet Membres, Invitations, Rotation, Échanges, Enchères, Avis, Contrat, SMS.

### Dépôts libres et solde
- Nouveau système de dépôts d'épargne indépendant des tours : montant libre, plusieurs dépôts par jour possibles, statut en attente puis confirmé au retour du paiement.
- Un dépôt confirmé **crédite le solde consolidé de l'utilisateur** : l'épargne Solo devient visible et retirable depuis « Mon solde », avec la règle de blocage Projet conservée.
- La liste des Solos affiche total épargné, objectif et progression réels.

## Détails techniques

- **Base** : nouvelle table `solo_deposits` (group_id, user_id, montant, statut, provider, référence Djomy, dates) avec GRANT + RLS strictement limités au propriétaire ; colonne `target_amount` et `savings_mode` (`free`) sur `groups`.
- **RPC** : `create_solo_group` assouplie (contribution et fréquence optionnelles, objectif accepté) ; `start_solo_deposit(group_id, amount)` ; `list_solo_deposits(group_id)` ; `list_my_solo_groups` recalculée sur `solo_deposits` avec l'objectif réel saisi.
- **Crédit du solde** : un dépôt confirmé écrit dans `beneficiary_balances` (via une écriture dédiée) et dans `platform_ledger` (escrow client), pour rester cohérent avec la réconciliation existante.
- **Paiement** : nouvelle fonction Edge `djomy-init-solo-deposit` calquée sur `djomy-init-deposit`, plus prise en charge du type `solo_deposit` dans `djomy-webhook` (idempotent).
- **Front** : `src/pages/SoloDetail.tsx` (route `/solo/:id`), `SoloDepositDialog`, `SoloDepositsList`, `SoloGoalCard` ; redirection `kind === 'solo'` depuis `GroupDetail` ; `src/lib/api/solo.ts` étendu ; `Solo.tsx` (création) simplifié.
- **Tests** : mise à jour de `db/tests/solo_and_international_rules.test.sql` (dépôts multiples autorisés, blocage retrait Projet, un seul membre) et test e2e création → dépôt → progression.
