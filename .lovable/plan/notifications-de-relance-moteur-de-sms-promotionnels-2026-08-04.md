# Notifications de relance + moteur de SMS promotionnels

## 1. Réponse à la question (vérifiée en base)

Oui : la demande de relance a bien notifié tout le monde par email.

- 3 notifications in-app `system` ont été créées le 04/08 à 16:21 (« Nouveau cycle proposé » x2, « Demande de démarrage envoyée » x1).
- Les 3 emails correspondants sont partis dans la même seconde, statut `sent` (rouguialas@, hadjakankoutoure04@, moncomptepaypal5@).
- Aucun SMS : le portefeuille SMS de tous les comptes est à 0 et aucun n'a de plan payant, donc le routage SMS s'arrête sur `plan_free` / `wallet_empty`. C'est le comportement attendu.

Problème réel : personne ne sait qu'il rate des SMS. Rien ne le lui dit, et rien ne lui propose d'acheter un forfait au moment où ça compte.

## 2. Ce qu'on met en place

### a) SMS « premier contact » offert sur événement critique
Quand une action importante (demande de démarrage de cycle, échéance, versement) ne peut pas partir en SMS faute de forfait, on envoie **un seul** SMS offert par la plateforme, qui annonce l'événement en une ligne et invite à activer les SMS.

Exemple : `Tontine Digitale: une demande de demarrage de cycle attend votre reponse sur Epargne. Activez vos SMS pour ne rien rater: tontinedigitale.com/sms`

Règles : 1 SMS offert par utilisateur tous les 30 jours maximum, jamais deux fois pour le même type d'événement, coût imputé au budget marketing plateforme.

### b) Moteur de campagnes déclenchées (« lifecycle »)
Un catalogue figé de messages promotionnels, chacun avec sa cible, son délai et son plafond. Premiers scénarios :

| Scénario | Cible | Déclenchement | Angle |
|---|---|---|---|
| `sms_missed_event` | solde SMS = 0, a raté ≥1 notif critique | J+0 puis J+3 | « Vous ratez ce qui se passe dans vos tontines » |
| `sms_wallet_low` | solde < 5 SMS | à la baisse, max 1/semaine | Recharge avant panne |
| `sms_wallet_empty_relance` | solde 0 depuis 14 j, actif dans un groupe | J+14 | Pack d'entrée, prix unitaire |
| `sub_savings_value` | plan free, ≥1 groupe actif depuis 21 j | J+21 puis J+60 | Avantage épargne + fonctions Premium |
| `sub_organizer` | organisateur free avec ≥2 groupes | J+7 après 2e groupe | Gestion multi-groupes, rappels auto |
| `reactivation` | aucune connexion depuis 30 j | J+30 | Reprise d'activité |
| `post_cycle_win` | cycle terminé avec succès | J+2 | Relancer un cycle, preuve de réussite |

### c) Garde-fous obligatoires
- **Opt-out** : `STOP` respecté, table de désabonnement marketing, lien/mention dans chaque message, et interrupteur dans les préférences de notification.
- **Heures calmes** : envoi uniquement 08:00–20:00 heure de Conakry.
- **Plafonds** : max 2 SMS marketing / utilisateur / 30 jours, tous scénarios confondus.
- **Budget** : plafond quotidien et mensuel en GNF, configurable en back-office ; au-delà, la file s'arrête proprement.
- **Séparation stricte** : les SMS marketing ne consomment jamais le forfait de l'utilisateur, et ne passent jamais devant un SMS transactionnel dans la file.
- **Mesure** : chaque envoi porte une campagne + un lien tracké, avec attribution des achats de packs et abonnements dans les 7 jours.

### d) Back-office « Campagnes » (SMS + Email)
Chaque campagne existe en deux canaux : SMS (payant, plafonné par le budget) et Email (gratuit, envoyé par défaut). Une page d'administration unique permet de tout piloter sans redéploiement.

- **Liste des campagnes** : code, libellé, segment ciblé, canaux actifs (SMS / Email indépendamment), état activé/désactivé.
- **Édition d'une campagne** : segment et déclencheur (délai en jours, récurrence), plafond par utilisateur et par période, heures d'envoi autorisées, priorité.
- **Éditeur de contenu** : texte SMS (compteur de caractères et de segments, aperçu, variables `{prenom}`, `{groupe}`, `{lien}`) et contenu email (objet + corps, même jeu de variables), avec aperçu et envoi de test vers un numéro / une adresse.
- **Budget** : plafonds SMS quotidien et mensuel en GNF, consommation en temps réel, arrêt automatique au plafond.
- **Statistiques** : envoyés, échecs, clics, conversions (achat de pack ou d'abonnement sous 7 jours), coût par conversion, par campagne et par canal.
- **Journal des envois** : filtres par campagne, canal, statut, utilisateur, période ; désabonnements visibles.
- **Actions** : activer/désactiver une campagne, mettre tout le marketing en pause (interrupteur global), rejouer un envoi échoué.

## 3. Détails techniques

- Migration SQL :
  - `marketing_campaigns` : `code`, libellé, segment, déclencheur (délai/récurrence), `sms_enabled`, `email_enabled`, plafonds, priorité, `is_active`.
  - `marketing_campaign_contents` : une ligne par campagne et par canal (`sms` | `email`), avec objet, corps, version, contenu éditable depuis le back-office.
  - `marketing_sends` : un envoi = une ligne (`campaign_code`, `channel`, `user_id`, `dedupe_key`, statut, coût, clic, conversion).
  - `marketing_optouts`, `marketing_settings` (budget quotidien/mensuel, heures calmes, interrupteur global).
  - RLS : lecture/écriture réservées aux `super_admin` via `has_role`, plus `service_role` pour les workers.
- RPC admin : `admin_list_marketing_campaigns`, `admin_upsert_marketing_campaign`, `admin_upsert_campaign_content`, `admin_toggle_campaign`, `admin_marketing_stats`, `admin_list_marketing_sends`, `admin_update_marketing_settings`, `admin_send_campaign_test`.
- Fonction `public.enqueue_marketing_message(campaign_code, channel, user_id, vars)` : vérifie opt-out, plafond utilisateur, heures calmes, budget et interrupteur global, rend le contenu depuis `marketing_campaign_contents`, puis insère dans `sms_outbox` (`kind = 'marketing_<code>'`) ou `email_outbox` — conforme à la doctrine Paxefy (catalogue en base + outbox, jamais de `net.http_post` dans un trigger).
- Fonction `public.enqueue_lifecycle_campaigns()` planifiée en cron quotidien (09:00 Conakry) : évalue les segments et déclenche les canaux actifs de chaque campagne.
- Le message « premier contact » se branche dans `dispatch_notification` : quand `sms_skipped` vaut `plan_free` ou `wallet_empty` sur un `kind` critique, appel de `enqueue_marketing_message('sms_missed_event', ...)`.
- Gabarits de secours (fallback si aucun contenu en base) dans `supabase/functions/_shared/smsTemplates.ts` et `emailTemplates.ts` — SMS sans accents, < 160 caractères.
- Redirection de tracking : route `/r/:code` qui enregistre le clic dans `marketing_sends` puis redirige vers `/abonnement` ou la recharge SMS.
- Front : page `src/pages/admin/Campaigns.tsx` (onglets Campagnes / Contenus / Statistiques / Journal / Réglages) + entrée de menu back-office, et bascule « offres et conseils » (SMS et email) dans les préférences de notification.
- Tests : SQL sur opt-out / plafond / heures calmes / budget / interrupteur global, unitaires sur le rendu des variables, E2E sur l'édition et l'activation d'une campagne dans le back-office.

## 4. Conformité
Les SMS promotionnels sont du marketing direct : consentement présumé pour les clients actifs, désabonnement systématique, aucune donnée financière dans le corps du message.
