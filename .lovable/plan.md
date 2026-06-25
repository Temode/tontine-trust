## Objectif

Stopper net l'hémorragie SMS et empêcher toute récidive. Trois fronts : (a) supprimer l'amplificateur qui transforme 1 notification en 15 envois parallèles, (b) installer un kill-switch + garde-fou de solde côté edge, (c) isoler/archiver les groupes de test orphelins qui sont la source réelle du volume.

## Diagnostic vérifié en base

- 109 SMS du 24/06 ventilés : 95 vers des groupes de test orphelins, 14 vers Epargne.
- Trigger `public.trg_dispatch_late_sms` (sur table `notifications`) → `net.http_post('send-tontine-reminders')` à chaque insert `contribution_late`. À 08:00, 15 notifications insérées en batch ⇒ 15 invocations parallèles ⇒ 10–11 SMS par utilisateur en quelques secondes (race sur l'ancienne idempotence `sms_logs`).
- 9 groupes orphelins en `pending` depuis 9 jours, jamais résolus.

## Changements

### 1) Supprimer l'amplificateur (DB)

Migration :

```sql
drop trigger if exists trg_notifications_dispatch_late_sms on public.notifications;
drop function if exists public.trg_dispatch_late_sms();
```

L'envoi reste assuré par :
- le trigger `sms_on_contribution_confirmed` (temps réel, par paiement, déjà déduppé),
- le cron `send-tontine-reminders-daily` (1× / jour, 09:00 UTC),
- l'ajout (ci-dessous) d'un cron horaire de retard.

### 2) Cron unique horaire pour les retards (DB)

Remplace le trigger d'amplification par un cron **séquentiel** :

```sql
select cron.schedule(
  'send-tontine-reminders-hourly',
  '10 8-20 * * *',
  $$ select net.http_post(url := '<functions_url>/send-tontine-reminders',
        headers := jsonb_build_object('Content-Type','application/json','apikey','<anon>'),
        body := jsonb_build_object('triggered_by','cron_hourly')); $$
);
```

Un seul appel par heure → aucune parallélisation. Combiné au `claim_sms_dedupe` déjà déployé : un user/turn/bucket/jour = strictement 1 SMS.

### 3) Kill-switch global (DB + edge)

`public.internal_config` reçoit deux clés (insert idempotent) :

- `sms_paused` : `'true'`/`'false'` (défaut `'false'`).
- `sms_min_balance` : `'50'` (seuil rouge, par défaut).

Les fonctions `send-tontine-sms` et `send-tontine-reminders` lisent ces clés au démarrage :

- Si `sms_paused = 'true'` → court-circuit immédiat, retour `{ ok:true, paused:true, count:0 }` et trace dans `sms_logs` (`status:skipped, error:'kill_switch'`).
- Sinon, appel `GET https://api.nimbasms.com/v1/accounts/balance` (endpoint utilisé dans `nimbasms.ts`). Si solde `< sms_min_balance` → court-circuit + notification admin `nimba_balance_low` (enum déjà ajouté) + log skipped `'low_balance'`.

Le check de solde est mis en cache 60 s dans la fonction pour éviter de saturer l'API Nimba.

### 4) Rate limit dur côté edge (filet)

Dans `send-tontine-reminders`, ajout d'un compteur en mémoire d'instance :

- max **30 SMS** par invocation (paramètre `internal_config.key='sms_max_per_run'`).
- Au-delà : log `skipped:'rate_limit_per_run'` + notification admin `sms_delivery_failed` (enum déjà présent) avec corps `"Plafond de N SMS atteint sur 1 exécution — vérifiez la base."`.

### 5) Isoler les groupes de test orphelins (data)

Migration (data-fix, INSERT/UPDATE seulement) :

```sql
update public.groups set status = 'archived'
where (name ilike 'Djomy Audit %' or name ilike 'Audit %' or name ilike 'Teste %' or name ilike 'Tontine Test %' or name ilike 'Test Djomy %')
  and status <> 'archived';
```

Et filtre dur dans les deux fonctions (lecture des vues `pending_reminders_view` et `contribution_late`) :

- `where g.status <> 'archived'` ajouté à chaque join.
- Ajout d'une colonne `groups.is_test_group boolean default false` ; toutes les fixtures E2E la mettent à `true`. Les reminders excluent `is_test_group = true`.

### 6) UI Admin — visibilité (1 carte + 1 toggle)

`src/pages/admin/SmsLogs.tsx` :

- Carte « État SMS » : badge Solde Nimba (couleur seuil), bouton **Pause envois** (toggle `sms_paused`), bouton **Tester solde maintenant** (force le check).
- Filtre rapide « Envois du jour par groupe / kind » avec totaux (anti-régression visible en un coup d'œil).

### 7) Documentation interne

Ajout `docs/SMS_ANTI_AMPLIFICATION.md` qui rappelle :

- Aucun trigger sur `notifications` ne doit appeler `net.http_post` vers `send-tontine-*`.
- Tout nouveau cron SMS doit utiliser `claim_sms_dedupe(key)` avant l'appel Nimba.
- Tout groupe de test doit positionner `is_test_group = true`.

## Détails techniques

- **Pas de modifications du wording SMS**, déjà conformes à la doctrine.
- Pas de breaking change client.
- Les fonctions edge restent rétro-compatibles avec leur signature actuelle (paramètres optionnels).
- Sauvegarde de mémoire projet : nouvelle entrée `mem://features/anti-amplification-sms` (règle Core : « jamais de trigger SMS sur la table notifications »).

## Critères d'acceptation

1. Forcer 20 inserts simultanés de `notifications.kind='contribution_late'` → **0 invocation** de `send-tontine-reminders` (le trigger n'existe plus).
2. Déclencher le cron horaire 3 fois dans la minute → **0 SMS dupliqué**.
3. Mettre `sms_paused='true'` puis confirmer une cotisation → **0 SMS envoyé**, 1 log `skipped:'kill_switch'`.
4. Solde Nimba < 50 → 1 notification admin `nimba_balance_low`, **0 SMS facturé**.
5. Aucun nouveau SMS vers les 9 groupes orphelins après archivage (vérification par requête `sms_logs` sur 24 h).

## Fichiers touchés

- `supabase/migrations/<new>.sql` — drop trigger amplificateur, cron horaire séquentiel, colonne `groups.is_test_group`, clés `internal_config`, valeur enum déjà OK.
- `supabase/migrations/<new+1>.sql` — *data* : `update groups set status='archived'` + `update groups set is_test_group=true` pour les 11 groupes listés.
- `supabase/functions/send-tontine-sms/index.ts` — kill-switch + check solde + filtre `is_test_group`.
- `supabase/functions/send-tontine-reminders/index.ts` — idem + rate-limit par run.
- `src/pages/admin/SmsLogs.tsx` — carte État SMS + toggle pause.
- `docs/SMS_ANTI_AMPLIFICATION.md` — nouveau.
- `mem://features/anti-amplification-sms` — nouvelle entrée mémoire.
