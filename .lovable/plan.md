# Mode alerte « retard J+1 » sur les cotisations

## Contexte
Rougui a 1 jour de retard sur la tontine quotidienne « Epargne » mais aucune alerte n'a été déclenchée : ni notification, ni SMS, ni signal côté organisateur. Le cron de rappels (`db/21_payment_reminders.sql`) existe mais ses buckets ne produisent rien d'utile pour le quotidien, et `tontine_alerts` n'est jamais alimenté pour les retards de paiement.

## Objectif
À partir de **J+1 (1 jour après la due_date)** sur toute cotisation `pending|rejected` d'un tour `upcoming|collecting` :
1. Envoyer **une notification in-app + un SMS NimbaSMS** au membre retardataire (sender « Tontine »).
2. Créer **une entrée `tontine_alerts`** (severity `warning`, code `late_contribution`) visible par l'organisateur, avec **badge rouge** sur le membre dans la liste du tour.

Pas de blocage du tour suivant, pas de pré-signalement défaut automatique (l'organisateur garde la main via le flux existant).

## Périmètre — ce qu'on touche

### Base de données — nouvelle migration `db/47_late_payment_alerts.sql`
- Fonction `public.enqueue_late_payment_alerts() returns int` :
  - Parcourt `contributions` non payées dont `(current_date - turns.due_date) >= 1`.
  - Pour chaque (contribution, jour), idempotent via `reminder_log` (bucket `LATE_J+n` où `n = days_late`).
  - Insert dans `notifications` (`kind = 'contribution_late'`, body localisé GNF + n° tour).
  - Insert dans `tontine_alerts` (une seule par contribution non résolue : ON CONFLICT DO NOTHING via index unique partiel `(contribution_id) where resolved_at is null and code='late_contribution'`).
  - Insert dans `sms_logs` via fonction utilitaire existante (déclenche l'envoi NimbaSMS côté edge function `send-tontine-reminders`, qui scanne la queue).
  - Auto-résolution : quand une contribution passe `confirmed`, trigger qui met `tontine_alerts.resolved_at = now()` pour le code `late_contribution` correspondant.
- Cron `pg_cron` : remplace l'ancien `tontine_payment_reminders` par un job **toutes les heures** (8h–22h) appelant à la fois `enqueue_payment_reminders()` et `enqueue_late_payment_alerts()` → réactivité < 1h sur le quotidien.

### Edge function — `supabase/functions/send-tontine-reminders/index.ts`
- Étendre pour traiter les notifications `contribution_late` non envoyées en SMS : message « Tontine [nom] · Cotisation tour #N en retard de J jours. Pénalité +X% dès demain. Payez ici : [lien Djomy]. »
- Sender = `Tontine` (déjà en place après le précédent correctif).

### Frontend
- **`src/components/group/CurrentTurnBanner.tsx`** : ajouter un badge rouge « En retard J+n » sur la ligne du membre quand `status pending|rejected` et `days_late >= 1` (déjà calculé via `overdue`, juste renforcer la pastille avec le nombre de jours).
- **`src/pages/admin/Defaulters.tsx`** : nouvelle section « Retards en cours » alimentée par `tontine_alerts` code `late_contribution` non résolus, avec lien direct vers le membre + bouton « Relancer maintenant » (appelle la RPC `enqueue_late_payment_alerts` ciblée sur la contribution).
- **`src/components/notifications/NotificationItem.tsx`** : icône + style dédié pour `contribution_late`.

### Tests E2E — `tests/e2e/late-payment-alert.spec.ts`
- Seed : 1 groupe quotidien, 1 tour due hier, 1 contribution pending.
- Exécute la RPC `enqueue_late_payment_alerts()`.
- Vérifie : notification créée, alerte `tontine_alerts` visible, badge « En retard J+1 » rendu dans le banner, page admin Defaulters liste le membre.
- Re-exécution → idempotent (pas de doublon le même jour).

## Hors périmètre (non demandé)
- Blocage automatique du prochain tour
- Pré-création d'un `member_default_reports`
- Escalade automatique vers défaut après N jours (reste manuel via le flux organisateur)

## Détails techniques
- Idempotence : clé composite `(contribution_id, sent_on, bucket)` déjà en place sur `reminder_log`, on réutilise.
- RLS : `tontine_alerts` a déjà les policies (lecture organisateur+admin) — rien à ajouter.
- GRANT : `enqueue_late_payment_alerts()` `SECURITY DEFINER`, `grant execute ... to authenticated, service_role`.
- Realtime : `tontine_alerts` déjà dans la publication ? À vérifier dans la migration, sinon `ALTER PUBLICATION supabase_realtime ADD TABLE public.tontine_alerts`.

## Impact attendu pour Rougui
Dès le déploiement + premier passage du cron : elle reçoit un SMS + push « Cotisation tour #1 en retard de 1 jour », l'organisateur voit un badge rouge sur sa ligne et une entrée dans Defaulters › Retards en cours.
