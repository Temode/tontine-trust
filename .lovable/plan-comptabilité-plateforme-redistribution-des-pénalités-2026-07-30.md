# Comptabilité plateforme & redistribution des pénalités

## Volet 1 — Séparer l'argent des clients des revenus Tontine Digitale

### Principe
Deux soldes système, jamais mélangés :

- **Séquestre clients (`client_escrow`)** : cotisations encaissées, cagnottes, soldes membres. Cet argent n'appartient jamais à la plateforme.
- **Revenus plateforme (`platform_revenue`)** : ventes de SMS, abonnements, frais de retrait, commissions coordinateur.

### Journal comptable
Nouvelle table `platform_ledger` (journal analytique unique, en écriture seule) :

- compartiment : `client_escrow` ou `platform_revenue`
- catégorie : `contribution`, `payout`, `sms_pack`, `subscription`, `withdrawal_fee`, `coordinator_fee`, `refund`, `adjustment`
- sens (entrée/sortie), montant, devise GNF
- références : utilisateur, groupe, paiement, commande SMS, abonnement, retrait
- clé d'idempotence unique pour éviter tout double comptage

Alimentation automatique aux points d'encaissement existants : confirmation de cotisation, versement de tour, webhook Djomy abonnement, webhook commande SMS, retrait payé.

Deux vues agrégées : `admin_treasury_balances` (les 2 soldes + sous-totaux par catégorie) et `admin_treasury_journal` (journal filtrable/paginé).

### Frais de retrait paramétrables
- Table de configuration `withdrawal_fee_config` (pourcentage, minimum, maximum, actif) éditable par le super-admin.
- Ajout sur `user_withdrawal_requests` : `fee_amount`, `net_amount`. Le membre voit clairement « montant demandé / frais / net reçu » avant de valider.
- Au paiement du retrait, les frais sont écrits en revenu plateforme, le net en sortie de séquestre.

### Backoffice `/admin/comptabilite`
- Deux grandes cartes : **Fonds clients sous séquestre** et **Revenus Tontine Digitale**, avec évolution 30 j.
- Répartition des revenus par source (SMS / abonnements / frais de retrait / commissions).
- Journal de trésorerie : filtres par compartiment, catégorie, période, recherche utilisateur/groupe, export CSV.
- Nouvelle page dans la barre latérale admin + écran de réglage des frais de retrait.

## Volet 2 — Redistribution des pénalités

### Règle
Quand une pénalité de retard est encaissée, son montant est **intégralement réparti à parts égales entre tous les membres actifs du groupe** (y compris le membre pénalisé et le bénéficiaire du tour), et crédité sur leur solde. Les pénalités n'alimentent plus la trésorerie de groupe.

Le reliquat de division (arrondi au franc) est attribué de façon déterministe aux premiers membres par ordre d'adhésion, afin que la somme redistribuée soit exactement égale à la pénalité (contrôle d'équilibre à zéro).

### Mécanique
- Nouvelle table `penalty_distributions` (pénalité source, membre crédité, part, date) pour la traçabilité et l'idempotence.
- RPC `distribute_penalty(contribution_id)` : verrou transactionnel, calcul des parts, crédit de `beneficiary_balances`, écriture au registre de groupe et notification. Rejouable sans double crédit.
- Appel automatique au moment où la pénalité est encaissée (paiement confirmé avec pénalité), et après un ajustement admin (annulation d'une pénalité déjà redistribuée = reprise inverse des parts).

### Notifications
Chaque membre crédité reçoit, via le canal de notification existant : notification in-app, e-mail automatique, et SMS si son forfait SMS est actif. Message type : « Vous avez reçu X GNF issus d'une pénalité de retard dans le groupe Y ».

### Rattrapage de l'historique
Migration de rattrapage qui reprend toutes les pénalités déjà prélevées, les redistribue selon la même règle, retire les montants correspondants de la trésorerie de groupe, et journalise l'opération. Les notifications ne sont pas renvoyées pour l'historique (une seule notification récapitulative par membre).

## Détails techniques

- Migrations : `platform_ledger` (+ GRANT, RLS super_admin seul), `withdrawal_fee_config`, `penalty_distributions`, colonnes `fee_amount`/`net_amount`, vues admin, triggers/points d'appel d'alimentation.
- RPC : `distribute_penalty`, `revert_penalty_distribution`, `admin_treasury_summary`, `admin_treasury_journal`, `admin_update_withdrawal_fee_config`.
- Mise à jour de `request_user_withdrawal` et `admin_mark_withdrawal_paid` pour les frais.
- Front : `src/pages/admin/Accounting.tsx`, `src/lib/api/accounting.ts`, entrée de menu admin, affichage des frais dans le dialogue de retrait, ligne « Part de pénalité » dans Mon solde.
- Tests : SQL (équilibre de la redistribution, idempotence, frais) et Vitest sur les helpers de calcul.
