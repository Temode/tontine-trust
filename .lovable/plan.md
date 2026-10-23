Appel d'essai du compte A vers le compte B (sonnerie plein écran)

Ce qui va se passer
- Le compte A lance un appel dans « Tontine teste ».
- Votre TECNO, verrouillé, doit s'allumer et afficher l'appel en grand, avec « Décrocher » et « Refuser ». Il doit sonner en continu et vibrer.
- Je vérifie de mon côté que l'appel est bien parti vers le téléphone.

Ce que vous me dites ensuite
1. L'écran s'est-il allumé avec l'appel en grand ?
2. Le téléphone a-t-il sonné en continu, comme un appel WhatsApp ?
3. « Décrocher » ouvre-t-il l'app directement sur l'appel ?

Étapes suivantes
- Un 2e appel pour essayer « Refuser » : la sonnerie doit s'arrêter.
- Un 3e appel laissé sans réponse : il doit s'arrêter seul après 45 secondes, puis afficher « Appel manqué ».

Si rien n'arrive
- Je lis le journal d'envoi pour voir si le message a bien été envoyé au téléphone.
- Je vous indique le réglage à vérifier sur le téléphone : notifications en plein écran, et économiseur de batterie à désactiver pour l'app.

Détails techniques
- Création d'une ligne dans call_requests (group 1c3fe17d…, requested_by = compte A, status pending). Le trigger met alors call_incoming dans push_outbox.
- Appel de consume-push-outbox, puis contrôle de push_outbox.status / last_error et des journaux de la fonction.
- Pour « Refuser » et « Appel manqué » : passage à declined/missed, ce qui envoie le message call_cancel.
