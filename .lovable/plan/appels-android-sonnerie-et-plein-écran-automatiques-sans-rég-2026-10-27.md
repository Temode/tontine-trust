# Appels Android : sonnerie et plein écran automatiques, sans réglage client

## Objectif
Un membre installe Tontine Digitale et reçoit un appel comme sur WhatsApp : le téléphone sonne et l'écran d'appel s'affiche, sans ouvrir aucun paramètre.

## Constat vérifié
- Le canal actuel `tontine_calls` est créé une seule fois (`getNotificationChannel(...) == null`). Sur le TECNO, Android l'a enregistré en importance 2 (silencieux) ; un canal existant ne peut plus être remonté par le code.
- Le signal arrive bien (l'écran s'allume) : le problème est le canal et l'ouverture de l'écran d'appel, pas l'envoi.

## Ce qui change (uniquement `docs/android-appels/`)
1. **Nouveau canal `tontine_calls_v2`** en importance haute, sonnerie d'appel en boucle, vibration, visible sur écran verrouillé. L'ancien canal `tontine_calls` est supprimé au démarrage pour ne pas laisser deux entrées.
2. **Création du canal au lancement de l'app** (dans `MainActivity`), pas seulement à la réception du premier appel : il existe déjà avec les bons réglages avant tout appel.
3. **Autorisations demandées dans l'app, une seule fois, avec une phrase claire** :
   - Notifications (Android 13+) : fenêtre système standard « Autoriser ».
   - Plein écran (Android 14+) : si non accordée, l'app ouvre directement la bonne page système en un appui. Sur les téléphones achetés via Play Store pour une app d'appel, elle est accordée d'office.
4. **Ouverture directe de l'écran d'appel** quand l'app est au premier plan ou que le téléphone est verrouillé, en plus de la notification plein écran (secours si HiOS bloque l'intention plein écran).
5. **Sonnerie jouée par le service lui-même** pendant 60 s, arrêtée au décroché, refus, annulation ou expiration, pour ne plus dépendre du réglage du canal.
6. Un seul lot de fichiers cohérents (service, activité, identité, layout, manifeste, styles) fourni d'un bloc, avec les mêmes identifiants partout, pour éviter les erreurs de compilation rencontrées.

## Limite honnête
- HiOS (TECNO) peut encore restreindre le démarrage en arrière-plan sur certains modèles. Le point 4 et la sonnerie du service (point 5) couvrent ce cas sans réglage manuel ; à confirmer sur votre TECNO.
- iPhone non concerné ici (nécessite CallKit, Mac et compte Apple).

## Test
Vous recopiez le lot, Run, verrouillez ; je lance l'appel test et vous confirmez sonnerie + écran.

## Détails techniques
- `CallMessagingService.java` : `CHANNEL_ID = "tontine_calls_v2"`, `deleteNotificationChannel("tontine_calls")`, `MediaPlayer`/`Ringtone` en boucle + `Vibrator`, `startActivity` avec `FLAG_ACTIVITY_NEW_TASK` en complément du `setFullScreenIntent`.
- `MainActivity.java` (fichier nouveau dans docs) : `CallChannels.ensure(this)`, demande `POST_NOTIFICATIONS`, vérification `NotificationManager.canUseFullScreenIntent()` et ouverture de `ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT`.
- Manifeste : `USE_FULL_SCREEN_INTENT`, `POST_NOTIFICATIONS`, `WAKE_LOCK`, `VIBRATE`, activité `showWhenLocked`/`turnScreenOn`.
- Aucun fichier web, `src/`, `index.css` ni fonction serveur modifié.
