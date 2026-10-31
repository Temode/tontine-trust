Nom de l'expéditeur dans les notifications + test d'appel sur le téléphone

1. Ne plus jamais afficher d'adresse email
- Vérifier d'abord d'où vient « comptea@yopmail.com » : nom de profil vide remplacé par l'email dans la notification, ou nom de profil contenant lui-même l'email.
- Règle unique : on affiche le nom complet du membre ; s'il est vide ou ressemble à une adresse email, on affiche « Un membre ».
- S'applique aux notifications de nouveau message, d'appel entrant et d'appel manqué (téléphone, cloche et page Notifications).
- Les notifications déjà envoyées qui contiennent un email sont corrigées avec le même texte.
- Petit test qui vérifie la règle (nom présent, nom vide, nom en forme d'email).

2. Test d'appel sur votre TECNO (compte B)
- Le compte A lance un appel dans « Tontine teste ».
- Je vérifie que la notification « Appel entrant » part vers le téléphone du compte B avec priorité maximale.
- Vous me dites : le téléphone sonne-t-il, app fermée ? Toucher la notification ouvre-t-il l'écran de l'appel ?
- Je laisse ensuite l'appel sans réponse pour vérifier l'annonce « Appel manqué », qui doit ouvrir la discussion.
- Limite à connaître : une notification d'appel sonne comme une notification forte (comme un message WhatsApp), pas comme une sonnerie continue plein écran. Une vraie sonnerie d'appel plein écran demande un réglage Android supplémentaire ; je vous dirai après le test si elle est utile.

Avant le test, de votre côté
- App ouverte une fois avec compteb@yopmail.com, puis fermée (balayée). Notifications autorisées, économiseur de batterie désactivé pour l'app.

Détails techniques
- Inspecter les fonctions des triggers trg_group_messages_notify et trg_call_requests_notify ; remplacer le fallback par une fonction public.display_name_or_member(uuid) (null, vide ou contenant « @ » → « Un membre »).
- UPDATE des notifications chat_message/call_* dont title/body contient un email.
- Test SQL dans db/tests.
- Appel de test : insertion call_requests (status pending) au nom du compte A via run_sql, contrôle push_outbox (status, last_error), puis passage en missed.
