# Audit : les notifications in-app sont-elles toutes envoyées par email ?

## Réponse courte

Non — le mécanisme existe et couvre presque tout, mais trois fuites font qu'une partie des notifications n'arrive jamais dans les boîtes mail.

## Ce qui fonctionne

Chaque insertion dans la table des notifications déclenche automatiquement la mise en file d'un email (sujet = titre, corps = message, bouton « Ouvrir dans l'app »), quel que soit le code qui crée la notification (RPC, trigger, edge function). La file est ensuite consommée par un worker toutes les minutes, avec réveil immédiat pour un envoi en moins d'une seconde.

## Les 3 fuites identifiées (vérifiées en base)

1. **Le type « system » est désactivé par défaut pour l'email chez les 64 utilisateurs.**
   Or ce type sert à des messages importants : « Dépôt confirmé », « Tontine Solo créée », « Nouvelle candidature », « Paramètres du groupe mis à jour », « Forfait SMS épuisé ». Aucun de ces messages n'a généré d'email.

2. **271 emails en échec ne sont jamais réessayés.**
   Cause historique : le domaine d'envoi n'était pas vérifié chez le prestataire (erreur 403). Le domaine fonctionne à nouveau depuis aujourd'hui (envois réussis en fin de matinée), mais 87 emails de notification échoués aujourd'hui, et 184 plus anciens, restent bloqués définitivement : le worker ne relit que les lignes « en attente ».

3. **25 emails sont figés au statut « en cours de traitement »** depuis le 29 juillet (worker interrompu en plein envoi) — jamais repris non plus.

Note : les notifications antérieures au 9 juillet n'ont pas d'email car le mécanisme a été activé à cette date — c'est normal, hors périmètre.

## Correctifs proposés

1. **Activer l'email par défaut pour le type « system »** (et vérifier que chaque type de notification existant possède bien une ligne de préférence email activée par défaut, avec l'utilisateur libre de la désactiver depuis ses préférences).
2. **Rejeu automatique des échecs** : remettre en file les emails échoués dont l'erreur est temporaire (403 domaine, 429, 5xx), avec un délai croissant entre tentatives et un plafond de tentatives ; les échecs définitifs (adresse invalide) restent en échec.
3. **Reprise des envois figés** : toute ligne « en cours de traitement » depuis plus de 10 minutes repasse en attente.
4. **Rejeu ponctuel** des 271 échecs + 25 blocages actuels, une fois le mécanisme de reprise en place (le domaine est maintenant opérationnel).
5. **Supervision** : alerte Ops si le nombre d'échecs dépasse un seuil sur une heure, et petit tableau de suivi côté back-office (envoyés / en attente / échecs / motif) pour ne plus découvrir le problème a posteriori.

## Détails techniques

- Trigger `notifications_enqueue_email` → `public.email_outbox` (clé de dédoublonnage `notif:<id>`), worker `consume-email-outbox`.
- `email_outbox_pop` ne sélectionne que `status = 'queued'` : ajouter une reprise des statuts `failed` (retryable, `attempts < N`, avec `next_attempt_at`) et `processing` périmés — via colonnes `next_attempt_at` / horodatage de prise en charge.
- Migration de données : `notification_preferences` (`notif_type='system'`, `channel='email'`) passe à `enabled = true`, et seed des types manquants.
- Ajout de tests SQL : reprise après échec, non-rejeu des échecs définitifs, dédoublonnage inchangé.
