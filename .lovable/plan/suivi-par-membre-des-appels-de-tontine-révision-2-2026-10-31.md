# Suivi par membre des appels de tontine (révision 2)

## Objectif
Pendant un appel, l'appelant voit sous chaque membre appelé son état réel. La bande des membres devient le tableau de bord de l'appel.

## Réponses aux quatre points

### 1. Écriture du refus téléphone verrouillé
Constat : le code natif n'a aujourd'hui aucun accès à la session. Le jeton de connexion vit dans la page web, qui ne tourne pas quand le téléphone est verrouillé. Le seul appel réseau natif existant sert à charger l'avatar. Il faut donc une requête réseau depuis le Java.

Les trois options :
- **Session stockée côté natif : écartée.** Il faudrait recopier un jeton longue durée hors de la page web et le rafraîchir en Java. Une fuite donnerait accès à tout le compte.
- **Secret serveur partagé dans l'app : écartée.** Le secret serait le même pour tous les utilisateurs et se lit dans l'APK. Une seule fuite permettrait de répondre à la place de n'importe qui.
- **Recommandée : un jeton court par destinataire, envoyé dans la notification.** Au moment de l'envoi, `consume-push-outbox` signe pour chaque destinataire un jeton {call_id, user_id, exp = 90 s}. Ce jeton part dans le message FCM data, qui n'est remis qu'à notre application. Une nouvelle fonction serveur `call-respond` vérifie la signature et l'expiration, puis applique la même règle que `respond_call_request`. Cette fonction ne fait que trois choses : accuser réception, refuser, accepter.

Risques de la solution recommandée et parades :
- Rejeu : le jeton expire en 90 s, ne vaut que pour cet appel et ce membre, et un état terminé ne se rouvre jamais.
- Vol du jeton : il donne au pire le droit de refuser un seul appel pendant 90 s. Il ne donne accès à aucune donnée.
- Réseau absent au moment du refus : la requête est retentée 3 fois en 10 s. Si elle échoue quand même, la ligne passe en `missed` à 60 s. L'appelant voit alors « Pas de réponse », jamais un faux « A refusé ».
- La clé de signature est un secret serveur nouveau. Elle n'existe que côté serveur, jamais dans l'app.

### 2. État `delivered`
Il est conservé, mais avec un sens strict : **l'appareil a confirmé avoir reçu l'appel**. `CallMessagingService` envoie cet accusé réception avec le même jeton dès qu'il reçoit le message FCM. Sans accusé, le membre reste à « Appel envoyé », et rien n'est affiché à l'appelant qui ne soit prouvé. Libellés : `ringing` = « Appel envoyé », `delivered` = « Sonne ». Le web obtient le même accusé quand l'écran d'appel entrant s'affiche.

### 3. Corrections d'affichage
- La bande se construit sur `call_recipients`, complétée par la présence LiveKit (parle, micro coupé). Elle s'affiche dès qu'il y a un destinataire, donc toujours. Le seuil de trois participants est retiré.
- Tant que personne n'a décroché, la grande place affiche la tontine (nom et initiale), jamais l'appelant. Le repli vers le participant local est retiré pendant la sonnerie.

### 4. Arrivée hors instantané
C'est réalisable, et le côté serveur s'y prête bien. `livekit-token` est obligatoirement appelé pour entrer dans un appel, et il vérifie déjà que la personne est membre de la tontine. On y ajoute un insert/upsert dans `call_recipients` en `accepted` (avec `joined_late = true`) quand la ligne n'existe pas. Le cas est donc couvert quel que soit le chemin d'entrée (Rejoindre depuis la discussion, membre ajouté pendant l'appel), sans dépendre du client.

## États (sept, tous prouvés)
`ringing` Appel envoyé · `delivered` Sonne · `declined` A refusé · `accepted` En ligne · `missed` Pas de réponse · `unreachable` Aucun appareil · `left` Parti.

## Détails techniques
- Migration `call_recipients` (call_id, user_id, status, delivered_at, responded_at, joined_late), avec GRANT, RLS et temps réel. Instantané inséré par `request_group_call`. Statut global dérivé des lignes.
- Fonctions : `call-respond` (nouvelle, sans session, avec jeton HMAC), `consume-push-outbox` (signe le jeton et l'ajoute à la charge utile), `livekit-token` (upsert accepted).
- Natif (`docs/android-appels/`) : accusé réception dans `CallMessagingService`. Refus et acceptation dans `IncomingCallActivity` via `call-respond`, avant l'ouverture de l'app. À recopier à la main.
- Web : `CallContext.tsx` (abonnement, join/leave), `AudioCallStage.tsx` (bande toujours affichée, grande place réservée à la tontine pendant la sonnerie).
- Tests SQL et `CallContext.test.tsx` : jeton expiré refusé ; un refus sur trois laisse l'appel en cours ; arrivée tardive créée en accepted ; état terminé jamais rouvert.
