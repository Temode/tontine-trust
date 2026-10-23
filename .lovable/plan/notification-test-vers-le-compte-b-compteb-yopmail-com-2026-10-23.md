Notification test vers le compte B (compteb@yopmail.com)

Ce que je ferai
1. Vérifier que le téléphone du compte B est bien enregistré pour recevoir les notifications (l'app doit avoir été ouverte et connectée avec compteb@ au moins une fois, notifications autorisées).
2. Créer une notification « Test — Tontine Digitale » avec le texte « Ceci est une notification d'essai. Si vous l'entendez sonner, tout fonctionne. », qui ouvre la page Notifications au toucher.
3. Laisser l'envoi automatique (chaque minute) la transmettre au téléphone, puis vérifier qu'elle est marquée « envoyée » ou lire l'erreur exacte.
4. Vous dire le résultat : envoyée, ou ce qui bloque (téléphone non enregistré, service d'envoi non connecté…).

Avant l'essai, de votre côté
- App mise à jour sur le TECNO, connectée avec compteb@yopmail.com, notifications autorisées.
- Fermez l'app (balayez-la) pour tester comme WhatsApp.

Détails techniques
- Insertion dans notifications (kind system) pour l'utilisateur B via run_sql ; le trigger remplit push_outbox ; consume-push-outbox l'envoie via FCM.
- Contrôles : push_tokens pour B, statut et last_error dans push_outbox, logs de la fonction.
