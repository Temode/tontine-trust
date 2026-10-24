Écran d'appel entrant plein écran façon WhatsApp (Android)

Ce que vous verrez
- Téléphone en veille : l'écran s'allume directement sur un grand écran d'appel Tontine Digitale, sans passer par une notification.
- En haut : nom de l'appelant, puis la tontine en dessous ; au centre : sa photo ronde (ou ses initiales sur fond sarcelle).
- En bas : « Refuser » (rouge) et « Décrocher » (vert), grandes cibles tactiles. Un 3e bouton « Message » ouvre la discussion de la tontine.
- Ça sonne et vibre en continu jusqu'à 60 s, puis « Appel manqué ».
- Décrocher : l'app s'ouvre directement dans l'appel en cours (haut-parleur, micro, terminer), sans écran de connexion entre les deux.
- Si l'appelant raccroche avant : l'écran se ferme tout seul.
- Rien à régler pour vos clients : tout est prévu dans l'app.

Pourquoi ça ne marchait pas
- Aujourd'hui, l'appel ouvre l'app normale (la page de l'appel web). Sur un téléphone verrouillé, Android préfère un écran dédié, léger, prévu pour l'appel : c'est ce que fait WhatsApp.

Ce que vous aurez à faire (une seule fois)
- Ajouter 2 fichiers dans Android Studio (l'écran d'appel et sa mise en page), remplacer CallMessagingService.java, coller 1 bloc dans AndroidManifest.xml. Je vous guide pas à pas comme avant.
- Puis Run, verrouiller, et je relance l'appel.

Test
1. Téléphone en veille : l'écran d'appel s'affiche-t-il ?
2. Refuser : la sonnerie s'arrête et le compte A voit « refusé ».
3. Décrocher : vous êtes dans l'appel, et on s'entend.
4. Sans réponse : arrêt après 60 s et « Appel manqué ».

Limites
- Android uniquement ; iPhone demandera l'écran d'appel Apple au moment de la publication App Store.
- Android 14 et plus : l'autorisation plein écran est accordée d'office aux apps d'appel ; si le Play Store la refuse à notre catégorie, l'app vous la demandera une seule fois en un toucher.

Détails techniques
- Nouvelle IncomingCallActivity native (showWhenLocked, turnScreenOn, excludeFromRecents, launchMode singleInstance, thème sombre plein écran) cible du setFullScreenIntent ; layout XML avec avatar, nom, tontine, boutons.
- consume-push-outbox : ajouter caller_name, caller_avatar_url, group_name, group_id dans le payload data de call_incoming.
- Avatar téléchargé dans l'Activity (HttpURLConnection, timeout 3 s), initiales sinon.
- Sonnerie gérée par l'Activity (Ringtone + Vibrator) quand elle est visible ; la notification reste en secours.
- Refuser : appel direct à respond_call_request avec la session stockée côté web impossible en natif → l'Activity ouvre l'app en arrière-plan via le deep link ?action=decline puis se ferme ; Décrocher → deep link /appel/:id?action=accept, CallJoin rejoint automatiquement.
- call_cancel ferme l'Activity via broadcast local.
- Fichiers de référence dans docs/android-appels/ (IncomingCallActivity.java, activity_incoming_call.xml, manifeste).
