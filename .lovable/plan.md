## Doctrine SMS — alignement sur Paxefy

Adopter le principe de Paxefy : **un SMS, c'est un événement transactionnel critique où l'argent bouge, ou un code de sécurité.** Tout le reste est une notification in-app. Cela fait passer le catalogue de ~15 events × N buckets à **5 events, 1 SMS chacun, 1 fois.**

## Catalogue SMS officiel (figé, 5 events)

| # | Event | Destinataire | Quand | Message |
|---|---|---|---|---|
| 1 | `kyc_phone_otp` | utilisateur | inscription | OTP 6 chiffres |
| 2 | `contribution_paid` | payeur | trigger sur `contributions.status='confirmed'` | « Tontine Digitale : votre cotisation X GNF reçue. Tour #N de [Groupe]. C'est [Bénéficiaire] qui encaisse ce tour. » |
| 3 | `payout_received` | bénéficiaire | trigger sur `turns.status='paid'` | « Tontine Digitale : cagnotte X GNF créditée pour votre tour #N de [Groupe]. Retrait disponible dans 24 h. » |
| 4 | `contribution_late_final` | payeur retardataire | cron 1×/j à J+3 (un seul rappel SMS) | « Tontine Digitale : retard de 3 j sur le tour #N de [Groupe] (X GNF + pénalité Y GNF). Réglez maintenant pour éviter la suspension. » |
| 5 | `withdrawal_completed` | bénéficiaire | trigger sur `withdrawal_requests.status='completed'` | « Tontine Digitale : retrait de X GNF effectué. Référence #ID. » |

**Tout le reste passe en in-app uniquement** : `contribution_due` (J-2/J-1/J0), `contribution_late` (J+1, J+7, J+14), `payout_hold_extended`, `withdrawal_requested`, `withdrawal_cancelled`, `cycle_completed`, `group_pause_resume`, `member_status`, `pause_request_decision`, `dispute`, `default_report`, `group_deletion`, `payment_admin_decision`.

## Architecture cible (style Paxefy)

```text
trigger / cron
      │
      ▼
public.sms_outbox  (1 ligne = 1 SMS pour 1 destinataire)
      │  dedupe_key UNIQUE (event:user_id:scope_id:date)
      ▼
cron consume-sms-outbox  (toutes les 2 min, séquentiel, FIFO)
      │
      ▼
send-tontine-sms  ({event, to, userId, params})  ── seul appelant Nimba
      │
      ▼
_shared/smsTemplates.ts   (1 fonction par event, body figé)
      │
      ▼
_shared/nimbasms.ts (kill-switch + check solde déjà en place)
```

**Aucun trigger n'appelle plus `net.http_post`** vers un edge function. Ils écrivent une ligne dans `sms_outbox` (insert local, instantané, déduppé par index unique). Pas de fan-out parallèle possible — c'est la garantie structurelle.

## Garde-fous (en plus des existants)

Le dispatcher refuse l'envoi si :

1. Quota utilisateur dépassé : **max 3 SMS / user / 24 h** (count `sms_logs` where `status='sent'`).
2. Quota event : **max 1 SMS / (user, event) / 24 h**.
3. Groupe `is_test_group = true` → skip systématique.
4. Kill-switch `sms_paused = true` (déjà en place).
5. Solde Nimba < `sms_min_balance` (déjà en place).

## Changements DB

1. **Nouvelle table `public.sms_outbox`**
    - `id`, `event text`, `to_phone text`, `user_id uuid`, `group_id uuid`, `turn_id uuid`, `params jsonb`, `dedupe_key text UNIQUE`, `created_at`, `processed_at`, `status text` (`queued|sent|skipped|failed`), `attempts int`, `last_error text`.
    - RLS : service_role uniquement (pas d'accès client).
2. **`public.enqueue_tontine_sms(event, to, user_id, params, dedupe_key)`** réécrite : devient un simple `insert ... on conflict (dedupe_key) do nothing`. Plus jamais de `net.http_post`.
3. **Triggers SMS — purge ciblée** :
    - Conserver et adapter : `sms_on_contribution_confirmed`, `sms_on_turn_paid`, `sms_withdrawal_lifecycle` (filtré au seul status `completed`).
    - **Supprimer** : `sms_cycle_started`, `sms_group_pause_resume`, `sms_member_status`, `sms_pause_request_decision`, `sms_dispute`, `sms_default_report`, `sms_group_deletion`, `sms_payment_admin_decision`, `trg_dispatch_late_sms` (déjà drop hier). Ces events restent dans `notifications` (in-app) — aucune perte fonctionnelle, juste plus de SMS.
4. **Cron `consume-sms-outbox`** (toutes les 2 min) : POST vers la nouvelle edge function `consume-sms-outbox` qui pop jusqu'à 20 lignes `queued`, appelle `send-tontine-sms` une par une, met à jour `status`.
5. **Cron `tontine-late-final-sms`** (1× par jour, 09:00 UTC) : insère dans `sms_outbox` les `contribution_late_final` pour les contributions exactement à J+3 — un seul SMS par contribution, à vie (dedupe_key = `late_final:{contribution_id}`).
6. **Suppression** des crons `send-tontine-reminders-daily` et `send-tontine-reminders-hourly`. La function `send-tontine-reminders` est retirée du `config.toml` et son code est marqué deprecated (ou supprimé).

## Changements edge functions

1. **Refonte `send-tontine-sms`** en dispatcher pur, signature stricte :
   ```ts
   POST { event: SmsEvent, to: string, user_id: string, group_id?, turn_id?, params: object }
   ```
   - 1 destinataire par appel (jamais une liste).
   - Vérifie les quotas (user/jour + event/jour), kill-switch, balance, `is_test_group`.
   - Build du body via `smsTemplates.ts` (switch sur `event`).
   - Loggue dans `sms_logs` (status + cost) et met à jour `sms_outbox.status`.
2. **Nouvelle `_shared/smsTemplates.ts`** — 5 fonctions, une par event. Wording figé. Tests unitaires.
3. **Nouvelle `consume-sms-outbox`** — petite function qui pop FIFO et appelle `send-tontine-sms` séquentiellement, avec un budget de N envois max par run (par défaut 20).
4. **Suppression de `send-tontine-reminders`** (et de tout import).

## Frontend admin

`src/pages/admin/SmsLogs.tsx` (carte État SMS déjà ajoutée) :
- Nouveau panneau « Outbox » : compteur de lignes `queued`, bouton **Vider la file (admin only)**.
- Tableau « SMS / user / aujourd'hui » top 10 pour repérer toute dérive.

## Plan de migration sans casse

1. Migration DB : créer `sms_outbox` + index unique + grants.
2. Déployer dispatcher refondu + smsTemplates + consume-sms-outbox + cron 2 min.
3. Migrer les triggers SMS conservés pour insérer dans `sms_outbox`.
4. DROP des 9 triggers SMS non-critiques + des crons reminders + de la function `send-tontine-reminders`.
5. Mettre à jour la mémoire projet (`mem://features/doctrine-sms-paxefy`) : règle Core « 1 SMS = 1 event transactionnel + OTP. Tout le reste in-app. Aucun trigger n'appelle directement un edge function SMS — il insère dans sms_outbox. »

## Impact mesuré attendu

- Volume journalier SMS divisé par ~5–10 (5 events × ~quota 3/user/jour vs 15 events × 7 buckets).
- Zéro risque d'amplification (sms_outbox dedupe_key UNIQUE + cron séquentiel).
- Zéro SMS « inutile » du point de vue utilisateur — seuls les events où l'argent bouge déclenchent un SMS.

## Fichiers touchés

- **Nouveau** : `supabase/functions/_shared/smsTemplates.ts`, `supabase/functions/consume-sms-outbox/index.ts`, migration `sms_outbox` + `enqueue_tontine_sms` v2 + drop triggers/crons obsolètes, `docs/SMS_DOCTRINE.md`, `mem://features/doctrine-sms-paxefy`.
- **Refonte** : `supabase/functions/send-tontine-sms/index.ts`, triggers `sms_on_contribution_confirmed`, `sms_on_turn_paid`, `sms_withdrawal_lifecycle`.
- **Supprimés** : `supabase/functions/send-tontine-reminders/`, crons `send-tontine-reminders-daily` & `-hourly`, triggers SMS non-critiques listés ci-dessus.
- **UI** : `src/pages/admin/SmsLogs.tsx` (panneau Outbox + top users).
