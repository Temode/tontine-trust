# Correctifs + test complet du parrainage

## 1. Défauts à corriger
- Page Abonnement : remplacer « Quota atteint — upgrade requis » par « Limite atteinte : passez à Premium pour créer un groupe » / « … pour ajouter un membre ».
- Page Abonnement : afficher « Expire le jj/mm/aaaa » ou « Expiré » au lieu de « Prochaine échéance ».
- Actions rapides : ajouter l'entrée « Assistant » (ouvre l'onglet Assistant de la tontine).

## 2. Commission versée dans le solde du parrain
Aujourd'hui la commission reste « En attente » jusqu'à validation admin. Nouveau fonctionnement :
- Dès que l'abonnement du filleul est payé, la commission (10 % du prix) est créditée dans le solde du parrain, marquée « Payé », tracée dans le journal comptable, et retirable comme le reste du solde.
- Une seule commission par filleul et par période, même si le paiement est confirmé deux fois.
- Notification au parrain avec le montant exact en GNF.
- Les commissions déjà « En attente » sont créditées de la même façon.

## 3. Test de bout en bout (comptes A et B)
1. Compte A = parrain, compte B = filleul ; numéro 611599395 enregistré sur le compte B.
2. B déjà connecté ouvre le lien de A → arrive sur Affiliation, message « Parrainage enregistré », « Parrainé par A ».
3. Vérifier chez A : 1 filleul visible.
4. Refus vérifiés : auto-parrainage avec A, second parrain pour B.
5. B paie Premium par Djomy avec 611599395 : vous validez le paiement sur votre téléphone (argent réel débité).
6. Vérifier : abonnement B actif, reçu créé et email en file, commission créditée au solde de A, notification reçue, montant juste.
7. Parcours visiteur non connecté (nouveau compte via le lien) vérifié jusqu'à l'inscription.

Je vous signalerai le moment exact où valider le paiement sur votre téléphone.

## Détails techniques
- `accrue_referral_earning` : après insertion, crédit wallet via le même mécanisme que les soldes bénéficiaires (beneficiary_balances / ledger), `paid=true`, idempotent par contrainte unique existante ; backfill des `paid=false`.
- Test SQL dans `db/tests/` : un seul crédit par période, montant = floor(prix × 10 %).
- Mise à jour de `profiles`/numéro du compte B via l'interface Profil.
