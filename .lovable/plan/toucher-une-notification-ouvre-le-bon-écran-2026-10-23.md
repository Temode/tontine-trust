# Toucher une notification ouvre le bon écran

## Constat (vérifié)
- Côté téléphone, toute notification sans lien précis ouvre la page Notifications par défaut.
- Les nouveaux messages et les appels n'envoient **aucune** notification au téléphone aujourd'hui : seuls les rappels de cotisation, les reçus et les avis système partent. Il faut donc d'abord les créer, puis les faire atterrir au bon endroit.

## Règle : où atterrit le membre

| Notification | Écran ouvert |
|---|---|
| Nouveau message | La discussion de cette tontine |
| Appel entrant | L'écran de l'appel, prêt à décrocher |
| Appel manqué | La discussion de cette tontine |
| Cotisation due / en retard | Le paiement de la cotisation dans la tontine concernée |
| Cotisation reçue / confirmée | Mes cotisations |
| Nouveau tour, tour payé, cycle démarré ou terminé, annonce | La page de la tontine |
| Invitation reçue | Rejoindre une tontine |
| Nouveau membre, invitation acceptée | Membres de la tontine |
| Versement reçu, commission de parrainage | Mon solde |
| Reçu prêt | Ce reçu précis |
| Abonnement (rappel, expiré) | Abonnement |
| Score de fiabilité | Profil |
| Autre / inconnu | Notifications (dernier recours seulement) |

Si la tontine n'existe plus ou n'est plus accessible, on ouvre la liste des tontines, jamais une page vide.

## Ce qui change
1. **Messages au téléphone** : chaque nouveau message envoie une notification aux autres membres de la tontine (titre : nom de la tontine, texte : « Prénom : début du message »). Pas d'envoi à l'expéditeur, ni si le membre a coupé les notifications. Plusieurs messages rapprochés de la même discussion sont regroupés pour ne pas faire sonner 10 fois.
2. **Appels au téléphone** : un appel lancé notifie les membres appelés avec un son ; s'il n'est pas décroché, il devient « Appel manqué ».
3. **Destination juste partout** : une seule règle de destination, utilisée à la fois par le téléphone, la cloche et la page Notifications (une seule source de vérité).
4. **Ouverture de l'app** : si l'app était fermée, le membre arrive directement sur l'écran voulu une fois connecté, sans passer par le tableau de bord.

## Vérification avant livraison
- Test automatique de la règle de destination (un cas par ligne du tableau).
- Avec les comptes A et B : A envoie un message, B reçoit la notification sur le TECNO et arrive dans la discussion ; même essai avec un appel.
- Mise à jour de l'app sur le TECNO nécessaire (npm run build, npx cap sync android, ▶).

## Détails techniques
- Fonction SQL `notification_target(kind, link, group_id, data)` utilisée par `enqueue_push_from_notification` à la place du repli `/notifications` ; miroir TS dans `resolveNotificationLink` (+ test vitest).
- Nouveaux kinds `chat_message`, `call_incoming`, `call_missed` (prélude enum séparé).
- Triggers AFTER INSERT sur `group_messages` et `call_requests` qui insèrent dans `notifications` (donc outbox, jamais d'HTTP depuis un trigger) ; regroupement via `data.collapse_key` + `android.notification.tag` dans consume-push-outbox.
- Les notifications de message n'apparaissent pas en toast in-app si la discussion est déjà ouverte (useChatToasts gère déjà le cas).
- `useNativeApp` : mémoriser le lien reçu au démarrage à froid et naviguer après hydratation de la session.
