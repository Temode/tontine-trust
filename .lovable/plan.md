## Objectif

1. Éliminer définitivement les SMS dupliqués (capture : 3 fois la même relance à 08:00).
2. Garantir que chaque cotisation confirmée déclenche **un seul** SMS au payeur (avec nom du bénéficiaire du tour) **et un seul** SMS à chaque autre membre (qui paie + à qui le tour).
3. Rendre visible et récupérable l'échec d'envoi quand le solde Nimba est insuffisant (cas réel : la confirmation de Rougui a échoué silencieusement).

## Diagnostic confirmé

- Cron `send-tontine-reminders-daily` (09:00 UTC, unique) — l'idempotence est en mémoire de boucle : `SELECT count FROM sms_logs WHERE kind=… AND created_at >= today` n'attrape pas les envois faits dans la même exécution (race entre `sendMessage` et insertion du log). Résultat observé : `contribution_late_LATE_J2` envoyé 4× au même utilisateur/tour, et `contribution_due` envoyé plusieurs fois à Rougui.
- Trigger `sms_on_contribution_confirmed` fonctionne. L'échec pour Rougui (`sms_logs`) est `NimbaSMS 400 — Le solde de votre compte est insuffisant`. Aucun rejeu, aucune notification admin.
- Le SMS de confirmation contient déjà *bénéficiaire* + *progression* `(tour #N, beneficiaire X) … X/N membres ont cotise` — conforme à la demande, à conserver.

## Changements

### 1) Verrou anti-doublon dur (DB) — table d'unicité

Nouvelle table `public.sms_dedupe_keys` :

- Colonnes : `dedupe_key text primary key`, `created_at timestamptz default now()`.
- Pas de RLS publique, accès `service_role` uniquement.
- TTL : purge `created_at < now() - interval '7 days'` via cron quotidien.

La clé est construite côté edge avant chaque envoi :

```
{user_id}:{turn_id|'-'}:{kind}:{yyyy-mm-dd}
```

Pour les confirmations qui ne sont pas datées par jour (un payeur peut payer plusieurs cotisations sur le même tour si re-création), la clé inclut l'`contribution_id` :

```
contrib_confirmed:{contribution_id}        → SMS payeur
contrib_notify:{contribution_id}:{user_id} → SMS aux autres membres
```

Insertion via `INSERT … ON CONFLICT DO NOTHING RETURNING 1`. Si rien n'est retourné → on saute l'envoi. Cela rend l'idempotence atomique et indépendante des logs d'envoi.

### 2) Refactor des deux edge functions

`supabase/functions/send-tontine-sms/index.ts` :
- Avant chaque `sendOne`, calculer la clé puis appeler un helper `claimDedupe(key)` (RPC SECURITY DEFINER `public.claim_sms_dedupe(key text) returns boolean`). Si `false` → log `status:skipped, error:'dedupe'` et `continue`.

`supabase/functions/send-tontine-reminders/index.ts` :
- Remplacer le `select count from sms_logs` par le même `claimDedupe`.
- Couvrir les trois boucles : `turn_upcoming_j2`, `contribution_due_${bucket}`, `contribution_late_${bucket}`.

### 3) Robustesse de la confirmation de paiement

Dans `send-tontine-sms` branche `contribution_confirmed` :
- Si `sendOne` renvoie `failed` avec un message contenant `solde` / `insufficient` / `balance`, marquer dans `sms_logs.error` `nimba_balance_exhausted` (déjà fait), **et** :
  - Insérer une `notifications` (`kind: 'sms_delivery_failed'` — ajout à l'ENUM) pour le super-admin (rôle `app_role.admin`), liée au `group_id`/`turn_id`.
  - Re-tenter une seule fois après 2s (couvre les flaps réseau, n'aggrave pas le solde nul).
- Ajouter un test SQL `db/tests/sms_dedupe.test.sql` qui :
  1. Insère 5 contributions confirmées identiques → vérifie qu'un seul SMS log `contribution_confirmed` existe.
  2. Réinvoque la fonction de reminders 3× → vérifie 1 seul log par bucket/jour.

### 4) Vérification automatique du solde Nimba (préventif)

Nouvelle edge function planifiée `nimba-balance-watchdog` (cron toutes les heures, 6h–22h) :
- Appelle l'endpoint Nimba `/account` (déjà utilisé dans `_shared/nimbasms.ts`), récupère le solde.
- Si solde < seuil (`internal_config.key='nimba_balance_threshold'`, défaut 500), insère `notifications` pour tous les `app_role='admin'` (`kind: 'nimba_balance_low'`).
- Expose le solde courant dans `/admin/sms-logs` (carte en haut).

### 5) UI admin — visibilité

Page `src/pages/admin/SmsLogs.tsx` :
- Badge rouge "Solde Nimba faible" si dernier check < seuil.
- Filtre rapide "Échecs aujourd'hui" + bouton "Rejouer" qui appelle `send-tontine-sms` avec le même payload reconstitué depuis le log (réservé `admin`).

## Détails techniques

- Migrations : ajout enum values `sms_delivery_failed`, `nimba_balance_low` ; création `sms_dedupe_keys` + fonction `claim_sms_dedupe(text) RETURNS boolean SECURITY DEFINER` ; cron `purge-sms-dedupe-keys` quotidien.
- Aucune modif du trigger `sms_on_contribution_confirmed` (déjà correct).
- Le wording des SMS reste identique (déjà conforme à la doctrine : informe le bénéficiaire du tour, ton sobre, signé "Tontine Digitale").
- Pas de breaking change côté client/app : tout le travail est en DB + edge functions + 1 page admin.

## Fichiers touchés

- `supabase/migrations/<new>.sql` — table dedupe + RPC + enums + cron purge
- `supabase/functions/send-tontine-sms/index.ts` — claimDedupe + retry + notif admin
- `supabase/functions/send-tontine-reminders/index.ts` — claimDedupe sur les 3 boucles
- `supabase/functions/nimba-balance-watchdog/index.ts` — nouvelle
- `supabase/config.toml` — déclaration de la nouvelle fonction
- `db/tests/sms_dedupe.test.sql` — nouveau
- `src/pages/admin/SmsLogs.tsx` — badge solde + bouton rejouer

## Critères d'acceptation

- Rejouer 10× la même cotisation confirmée → exactement 1 SMS au payeur, 1 par autre membre.
- Forcer le cron de reminders à tourner 3× dans la minute → 0 doublon.
- Couper le solde Nimba → un échec génère 1 notification admin `sms_delivery_failed` et le watchdog lève `nimba_balance_low`.
- SMS au payeur contient bien `(tour #N, beneficiaire <Prénom>)`. SMS aux autres membres contient `<Payeur> vient de cotiser pour la tontine "<Groupe>" (tour #N)`.
