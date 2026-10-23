Appel d'essai du compte A vers le compte B (sonnerie plein écran, 60 secondes)

Changement demandé
- La sonnerie dure 60 secondes au lieu de 45, puis s'arrête et affiche « Appel manqué ».
- Côté serveur, je fais le changement moi-même.
- Côté téléphone, il faut changer une ligne dans CallMessagingService.java, dans Android Studio. Je vous donne la ligne exacte, puis vous relancez ▶.

Ce qui va se passer
- Le compte A lance un appel dans « Tontine teste ».
- Votre TECNO, verrouillé, doit s'allumer et afficher l'appel en grand, avec « Décrocher » et « Refuser ». Il doit sonner en continu et vibrer.
- Je vérifie de mon côté que l'appel est bien parti vers le téléphone.

Ce que vous me dites ensuite
1. L'écran s'est-il allumé avec l'appel en grand ?
2. Le téléphone a-t-il sonné en continu ?
3. « Décrocher » ouvre-t-il l'app directement sur l'appel ?

Étapes suivantes
- Un 2e appel pour essayer « Refuser » : la sonnerie doit s'arrêter.
- Un 3e appel laissé sans réponse : il doit s'arrêter seul après 60 secondes, puis afficher « Appel manqué ».

Si rien n'arrive
- Je lis le journal d'envoi pour voir si le message a bien été envoyé au téléphone.
- Je vous indique le réglage à vérifier sur le téléphone : notifications en plein écran, et économiseur de batterie à désactiver pour l'app.

Détails techniques
- consume-push-outbox : la durée de vie (ttl) de call_incoming passe de 45 s à 60 s. La fonction est redéployée.
- docs/android-appels/CallMessagingService.java : RING_MS passe à 60_000L. L'utilisateur fait le même changement dans son projet android.
- Si un délai automatique fait passer les appels non décrochés en « manqué », il est aligné sur 60 s.
- Essai : création d'une ligne dans call_requests (tontine 1c3fe17d…, appel demandé par le compte A, statut pending). Ensuite, appel de consume-push-outbox, puis contrôle de push_outbox (statut et dernière erreur) et des journaux de la fonction.
