# Reçus par email réel + notifications sonores sur téléphone

## Constat (vérifié)
- Des reçus partent déjà par vrai email : 27 emails de reçu envoyés, aucun en échec.
- Mais 105 emails (tous types confondus) ont échoué : le service d'envoi refuse au-delà de sa limite quotidienne (environ 100 par jour sur l'offre actuelle). Un jour chargé, des reçus peuvent donc ne jamais arriver.
- Notifications téléphone : seulement 2 téléphones sont enregistrés et 7 notifications envoyées. Le son est demandé, mais l'app ne crée pas de « canal » Android prioritaire. Sur Android, sans ce canal, la notification arrive souvent sans bannière en haut de l'écran ni vibration, contrairement à WhatsApp.

## 1. Reçus par email : fiables pour chaque paiement
- Garder la création automatique du reçu à chaque paiement confirmé : cotisation, épargne solo, SMS, abonnement, dépôt de garantie.
- Les reçus passent en priorité dans la file d'envoi, avant les emails de rappel ou de campagne.
- Un email refusé pour cause de limite est renvoyé automatiquement le lendemain, sans doublon.
- Alerte Ops envoyée à l'équipe dès qu'un reçu reste non envoyé depuis plus d'une heure.
- Sur chaque reçu de la page « Historique & reçus » : mention « Envoyé par email le … » ou « Envoi en attente », avec un bouton « Renvoyer par email ».
- Renvoyer maintenant les emails déjà en échec, reçus d'abord.
- Votre décision : relever la limite du service d'envoi (offre payante, environ 20 $/mois) pour ne plus dépendre du lendemain. Je vous le signale, je ne le fais pas.

## 2. Notifications comme WhatsApp
- Créer dans l'app un canal Android « Alertes Tontine Digitale » de priorité haute : son, vibration, bannière en haut de l'écran, affichage sur l'écran verrouillé.
- Chaque notification envoyée au téléphone utilise ce canal, avec la priorité haute, pour arriver même app fermée et en veille.
- Vérifier que toutes les notifications de l'app (cotisation reçue, tour, paiement, reçu, parrainage, retrait, appel…) partent aussi vers le téléphone, sauf si le membre les a désactivées.
- Demander l'autorisation des notifications dès la connexion sur mobile (Android 13+ l'exige), avec un bouton pour la réactiver si elle a été refusée.
- Retirer automatiquement les téléphones qui ne répondent plus.

## Ce que vous devrez faire sur votre ordinateur
Mettre à jour l'app sur le TECNO : git pull, npm run build, npx cap sync android, désinstaller l'app, puis ▶. Ensuite je déclenche une notification test pendant que l'app est fermée.

## Vérification
- Paiement de test : reçu créé, email en file puis envoyé, mention visible dans l'app.
- Notification test avec app fermée : son, vibration, bannière.

## Technique
- email_outbox : colonne priority, tri par priorité dans consume-email-outbox ; 429 quota → next_attempt_at = lendemain 00:05 UTC ; RPC resend_my_receipt(receipt_id) idempotente ; check cron → ops_alerts.
- useNativeApp : PushNotifications.createChannel({ id: 'tontine_alerts', importance: 5, sound: 'default', vibration: true, visibility: 1 }) avant register ; requestPermissions au login.
- consume-push-outbox : android.notification.channel_id 'tontine_alerts', notification_priority PRIORITY_HIGH, default_sound, default_vibrate_timings ; suppression des tokens UNREGISTERED.
- Audit du trigger notifications → push_outbox contre notification_preferences.
