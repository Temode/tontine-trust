Écran d'appel entrant plein écran façon WhatsApp (Android et iPhone)

Ce que vous verrez
- Téléphone en veille : l'écran s'allume directement sur un grand écran d'appel, sans passer par une notification.
- Nom de l'appelant, tontine en dessous, photo ronde (ou initiales sur fond sarcelle).
- Boutons « Refuser » et « Décrocher » ; sonnerie et vibration continues jusqu'à 60 s, puis « Appel manqué ».
- Décrocher : l'app s'ouvre directement dans l'appel en cours.
- Si l'appelant raccroche avant : l'écran se ferme tout seul.
- Rien à régler pour vos clients.

Android
- Écran d'appel dédié à Tontine Digitale (comme WhatsApp sur votre capture), avec un bouton « Message » qui ouvre la discussion de la tontine.
- Vous ajoutez 2 fichiers dans Android Studio, remplacez CallMessagingService.java, collez 1 bloc dans AndroidManifest.xml. Je vous guide pas à pas.

iPhone
- Apple impose son propre écran d'appel (le même que pour un appel téléphonique ou WhatsApp sur iPhone) : nom de l'appelant, « Tontine Digitale Audio », Refuser / Accepter, sonnerie même téléphone verrouillé. C'est la seule façon autorisée par Apple, et c'est ce que fait WhatsApp.
- L'appel apparaît aussi dans l'historique « Récents » de l'iPhone.
- Prérequis de votre côté : un Mac avec Xcode et un compte Apple Developer (99 $/an), pour créer le certificat d'appel Apple. Je vous guide pas à pas.
- Tant que ce n'est pas fait, l'iPhone garde la notification d'appel actuelle.

Notifications classiques sur iPhone (messages, cotisations, reçus…)
- L'envoi est déjà préparé pour l'iPhone, avec son, et toucher la notification ouvre le même bon écran que sur Android.
- Pas encore testé : il faut, une seule fois, déposer la clé de notifications Apple (fichier .p8 du compte Apple Developer) dans Firebase, et activer « Push Notifications » dans Xcode. Je vous guide.
- Test ensuite : notification test vers un iPhone connecté au compte B, écran verrouillé, avec son.

Ordre de livraison
1. Android d'abord (votre TECNO est prêt pour tester tout de suite).
2. iPhone dès que vous avez le Mac et le compte Apple Developer.

Test (sur chaque téléphone)
1. En veille : l'écran d'appel s'affiche-t-il ?
2. Refuser : la sonnerie s'arrête et le compte A voit « refusé ».
3. Décrocher : vous êtes dans l'appel et on s'entend.
4. Sans réponse : arrêt après 60 s et « Appel manqué ».

Détails techniques
- Android : IncomingCallActivity native (showWhenLocked, turnScreenOn, singleInstance) cible du setFullScreenIntent ; layout XML ; sonnerie Ringtone + Vibrator ; call_cancel ferme l'Activity par broadcast local ; Décrocher → deep link /appel/:id?action=accept, Refuser → ?action=decline.
- iOS : PushKit (VoIP push) + CallKit via un plugin Capacitor (ex. capacitor-voip / plugin maison dans docs/ios-appels/). Enregistrement du token VoIP dans push_tokens (platform "ios_voip"). Apple exige d'appeler reportNewIncomingCall à chaque push VoIP. Réponse/refus CallKit → deep link vers /appel/:id.
- Serveur : consume-push-outbox ajoute caller_name, caller_avatar_url, group_name, group_id au payload call_incoming ; pour les tokens ios_voip, envoi APNs VoIP (apns-push-type voip, topic <bundle>.voip) via le certificat/clé APNs à fournir en secret ; call_cancel termine l'appel CallKit.
- CallJoin : gestion de ?action=accept (rejoint automatiquement).
- Fichiers natifs de référence dans docs/android-appels/ et docs/ios-appels/.
