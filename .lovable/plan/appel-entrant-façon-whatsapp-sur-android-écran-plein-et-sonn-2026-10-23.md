Appel entrant façon WhatsApp sur Android : écran plein et sonnerie

Ce que vous verrez après
- Un appel arrive : le téléphone sonne en continu (sonnerie d'appel, pas un simple bip) et vibre, même app fermée ou écran verrouillé.
- L'écran s'allume et affiche l'appel en grand : nom de la tontine, « Un membre vous appelle » ou le prénom, boutons « Décrocher » et « Refuser ».
- Décrocher ouvre l'app directement dans l'appel. Refuser arrête la sonnerie et prévient l'appelant.
- La sonnerie s'arrête seule après 45 secondes ou dès que l'appelant raccroche ; une notification « Appel manqué » prend alors le relais.

Ce qu'il faudra faire de votre côté (une fois)
- Je vous donne 2 petits fichiers à ajouter dans Android Studio et 3 lignes à coller dans le fichier de réglages de l'app (AndroidManifest.xml), avec des étapes pas à pas comme pour strings.xml.
- Puis : git pull, npm run build, npx cap sync android, désinstaller l'app, ▶.
- Au premier lancement, Android peut demander d'autoriser l'affichage en plein écran pour les appels : il faudra accepter.

Test
- Je relance un appel du compte A vers le compte B ; vous me dites si l'écran s'allume, si ça sonne, et si « Décrocher » ouvre l'appel.
- Puis je vérifie « Refuser » et l'appel manqué.

Limites
- Android uniquement pour l'instant ; l'iPhone demandera un réglage Apple distinct (au moment de la publication App Store).
- Certains TECNO bloquent l'écran plein si l'économiseur de batterie est actif pour l'app.

Détails techniques
- Serveur : consume-push-outbox envoie call_incoming en message FCM « data only » (priority high, ttl 45 s), et un message data « call_cancel » quand l'appel passe à accepted/declined/cancelled/missed/ended (nouvelle ligne push_outbox depuis notify_call_request).
- Natif : CallMessagingService (extends Capacitor MessagingService) intercepte call_incoming / call_cancel ; canal « tontine_calls » importance max avec sonnerie système TYPE_RINGTONE ; NotificationCompat category CALL, setFullScreenIntent, FLAG_INSISTENT, setTimeoutAfter(45 s), actions Décrocher (deep link /appel/:id) et Refuser (ouvre /appel/:id?action=decline).
- Manifest : USE_FULL_SCREEN_INTENT, déclaration du service avec intent-filter MESSAGING_EVENT en priorité sur celui du plugin.
- Web : CallJoin gère ?action=decline via respondCallRequest(id, 'declined').
- Les autres notifications restent inchangées.
