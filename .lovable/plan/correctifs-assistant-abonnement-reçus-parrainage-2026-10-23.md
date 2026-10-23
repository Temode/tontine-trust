# Correctifs : assistant, abonnement, reçus, parrainage

## Ce que j'ai constaté (vérifié dans la base et le code)
- **Assistant** : l'onglet existe sur la page d'une tontine, mais il est le 9e onglet d'une rangée qui défile ; sur un petit écran il est caché à droite. Il n'apparaît aussi qu'une fois le site republié.
- **Abonnement** : le compte de Kankou est encore « Premium actif » alors que sa période a pris fin le 29/08/2026. Aucune tâche automatique ne fait expirer les abonnements, et l'accès Premium ne regarde pas la date de fin.
- **Reçus** : 10 paiements réussis, 0 reçu en base. Les reçus ne sont créés qu'au versement de la cagnotte au bénéficiaire, jamais quand un membre paie sa cotisation. Aucun email de reçu n'est envoyé.
- **Parrainage** : le lien `/?ref=CODE` n'est lu nulle part dans l'app. Le code est perdu, aucun parrainage n'est enregistré (0 en base), et un membre déjà connecté est envoyé sur l'accueil.

## 1. Assistant visible
- Bouton « Poser une question » bien visible en haut de la page de la tontine, qui ouvre l'onglet Assistant.
- Onglet Assistant placé juste après « Aperçu ».
- Entrée « Assistant » dans les actions rapides.

## 2. Expiration des abonnements
- L'accès Premium n'est accordé que si la date de fin n'est pas dépassée (vérifié côté serveur, y compris pour l'assistant).
- Tâche automatique chaque heure : les abonnements échus passent en « expiré », retour au plan gratuit, notification au membre (« Votre Premium a expiré — renouveler »).
- Rappel 3 jours avant la fin.
- Correction immédiate des comptes déjà échus.
- Page Abonnement : affiche « Expire le jj/mm/aaaa » ou « Expiré ».

## 3. Reçus de paiement
- Un reçu numéroté et infalsifiable (empreinte) est créé automatiquement à chaque paiement confirmé : cotisation, dépôt de garantie, épargne solo, abonnement, achat de SMS. Pas de doublon si le paiement est confirmé deux fois.
- Rattrapage : création des reçus pour les 10 paiements déjà réussis.
- « Mes reçus » et « Historique & reçus » listent les reçus du payeur (en plus des reçus de versement reçus), avec téléchargement PDF.
- Email de reçu envoyé au payeur (montant, tontine, date, n° de reçu, moyen de paiement, lien vers le reçu). Prérequis : un domaine d'envoi d'emails ; je vérifierai son état et vous demanderai de le configurer s'il manque.

## 4. Parrainage qui fonctionne
- Le lien `/?ref=CODE` est mémorisé dès l'ouverture.
- Visiteur non connecté : le code suit l'inscription et le parrainage est créé à la création du compte.
- Membre déjà connecté : page claire « Rejoindre le parrainage de X ? », rattachement si son compte est récent et sans parrain (règles anti-fraude : pas d'auto-parrainage, un seul parrain).
- Lien de parrainage pointant vers l'inscription plutôt que l'accueil.
- Page Affiliation : chaque membre voit son propre lien, ses filleuls, et « Parrainé par X » s'il en a un.

## Vérifications
- Tests sur : expiration à la date de fin, un seul reçu par paiement, refus de l'auto-parrainage et du double parrain.
- Parcours réel : paiement test → reçu visible + email en file ; lien de parrainage connecté et déconnecté → filleul visible chez le parrain.

## Détails techniques
- `get_my_entitlements` + `tontine-assistant` : condition `current_period_end > now()` ; cron `expire_subscriptions()` via pg_cron (statut `cancelled`/expiré, notification via `dispatch_notification`).
- Trigger après passage de `payments.status` à `succeeded` (et équivalents dépôts/solo/abonnement/SMS) → `issue_payment_receipt()` idempotent (unique sur la source) ; `receipts.turn_id` rendu facultatif, ajout `payer_user_id`, `kind`, `source_id` ; vue `my_receipts` élargie.
- Email : notification → `email_outbox` (déjà consommé par `consume-email-outbox`), jamais d'appel HTTP depuis un trigger.
- Parrainage : capture dans `main.tsx`/route `/` vers localStorage, RPC `claim_referral(code)` appelée après connexion/inscription, référence passée dans les métadonnées d'inscription.
