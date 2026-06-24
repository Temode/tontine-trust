## Pourquoi Rougui n'a reçu aucun SMS

J'ai vérifié ses logs : Rougui **a bien payé** (tour #1 « Epargne », confirmé à 21:44). Deux SMS ont été préparés pour elle (`contribution_confirmed` + `payout_released`) — les deux sont en `status = skipped, error = opted_out`.

Cause : dans `notification_preferences`, **tous ses canaux SMS sont désactivés** (`enabled = false` pour les 53 types de notifications, canal `sms`). Le système respecte donc son choix et n'envoie rien par SMS, mais les notifications in-app passent.

→ Action côté produit : lui suggérer (ou au super-admin) de réactiver les SMS critiques (`contribution_confirmed`, `contribution_due`, `contribution_late`, `payout_released`) depuis « Préférences de notifications ». Pas de bug technique.

---

## Plan — SMS de relance immédiat dès J+1 (tontines quotidiennes)

### Constat sur l'existant
- La fonction `enqueue_late_payment_alerts()` (migration 47) crée bien les notifications in-app + alertes organisateur dès J+1.
- **Mais** l'edge function `send-tontine-reminders` ne lit que `pending_reminders_view` (rappels `J-2/J-1/J0/J+1/J+3/J+7/J+14`) — elle ne traite pas le kind `contribution_late`. Résultat : aujourd'hui, **aucun SMS de retard n'est réellement envoyé**, même quand l'alerte est créée.
- Le cron horaire `5 8-22 * * *` détecte donc le retard en < 1 h, mais l'envoi SMS ne suit pas.

### Changements

**1. `supabase/functions/send-tontine-reminders/index.ts` — nouveau bloc « late alerts »**
- Lire les notifications `kind = 'contribution_late'` créées aujourd'hui non encore loguées en SMS (`sms_logs.kind = 'contribution_late_LATE_J<n>'` absente).
- Joindre `contributions` + `turns` + `groups` pour reconstruire montant, n° tour, jours de retard, pénalité attendue.
- Construire le message court : `Tontine [groupe] : cotisation #N en retard de J jour(s) (XXX GNF). Pénalité +Y% si non régularisé. Réglez via l'app.` (sender `Tontine`, déjà actif).
- Respecter `notification_preferences` canal `sms`, type `contribution_late` (défaut ON). Skipper avec `error=no_phone|opted_out` comme les autres buckets.
- Idempotent : check `sms_logs` pour (`user_id`, `turn_id`, `kind='contribution_late_LATE_J<n>'`, `created_at >= today`).

**2. `db/48_immediate_late_sms.sql` — déclenchement immédiat**
- Trigger `AFTER INSERT ON notifications` quand `kind = 'contribution_late'` → `pg_net.http_post` vers `send-tontine-reminders` (fire-and-forget). Garantit l'envoi SMS dans les secondes suivant la création de l'alerte, sans attendre le tick horaire.
- Resserrer le cron `tontine-late-alerts-hourly` à **toutes les 15 minutes entre 8h–22h** (`*/15 8-22 * * *`) pour la détection (le SMS lui-même se déclenche désormais immédiatement via le trigger).

**3. `src/pages/admin/Defaulters.tsx` — bouton « Relancer maintenant »**
- Après `rpc('enqueue_late_payment_alerts')`, invoquer aussi `supabase.functions.invoke('send-tontine-reminders')` pour pousser le SMS dans la foulée (au lieu d'attendre le prochain tick).

**4. Préférences par défaut**
- Vérifier que les rows `notification_preferences` créées par défaut incluent `('contribution_late', 'sms', true)`. Sinon, ajout via la fonction de seed existante (à confirmer dans `db/26_notification_preferences.sql`).

### Hors périmètre
- Pas de modification du flux in-app, du badge `CurrentTurnBanner` ni de l'UI Defaulters (déjà livrés à l'étape précédente).
- Pas d'envoi rétroactif aux retardataires « historiques » — seul le prochain passage du cron + tout nouveau J+1 déclenchera le SMS.
- Aucune modification des préférences de Rougui (RGPD : c'est son choix explicite).

### Tests
- Étendre `tests/e2e/late-payment-alert.spec.ts` : vérifier qu'après `enqueue_late_payment_alerts()` + invoke de l'edge function, un `sms_logs` `contribution_late_LATE_J1` est créé (mocké en dry-run).
- Test manuel : forcer un J+1 sur le groupe « Epargne » (autre membre que Rougui), exécuter l'edge function en `dry_run=true`, valider le preview.
