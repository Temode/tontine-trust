## Libération automatique des fonds gelés en fin de sanction

### Objectif
À l'expiration de `turns.payout_hold_until`, libérer automatiquement les fonds du bénéficiaire et lui envoyer un SMS de notification.

### Mécanisme

**1. Nouvelle RPC `release_due_payout_holds()`** (SECURITY DEFINER)
- Sélectionne les `turns` où :
  - `status = 'paid'`
  - `payout_hold_until <= now()`
  - `payout_released_at IS NULL` (nouvelle colonne flag)
- Pour chaque tour :
  - Marque `payout_released_at = now()`.
  - S'assure que `beneficiary_balances.available_amount` reflète bien le payout disponible (no-op si déjà crédité — la rétention bloquait juste la demande de retrait, pas le solde affiché ; voir détail technique).
  - Insère un `notifications` (in-app) "Fonds libérés".
  - Appelle `send-tontine-sms` (kind `payout_hold_released`) via `pg_net` avec le token interne.
- Retourne le nombre de tours libérés (pour debug/admin).

**2. Nouveau kind SMS `payout_hold_released`** dans `supabase/functions/send-tontine-sms/index.ts`
- Message : « Bonjour, la période de retenue sur votre tour #N de la tontine "X" est terminée. Vos fonds (Y GNF) sont à nouveau disponibles. Demandez votre retrait depuis l'application. Ref: … »

**3. Cron pg_cron toutes les 5 minutes**
- Job `release-payout-holds` qui appelle la RPC `release_due_payout_holds()` directement (pas besoin de `net.http_post`, c'est purement SQL).

**4. Colonne `turns.payout_released_at timestamptz NULL`**
- Évite les doubles libérations / doubles SMS.
- Backfill : pour les tours déjà `paid` sans `payout_hold_until` ou avec hold passé, on **ne renvoie pas** de SMS rétroactif (on positionne juste `payout_released_at = COALESCE(payout_hold_until, paid_at)` pour les anciens).

### Détails techniques

```text
turns
─────
+ payout_released_at  timestamptz NULL

release_due_payout_holds() returns int
  → boucle sur les turns éligibles
  → UPDATE turns SET payout_released_at = now()
  → INSERT notifications(...)
  → PERFORM net.http_post(send-tontine-sms, {kind:'generic_broadcast', sms_kind:'payout_hold_released', recipients:[benef], body:...})
```

Cron (via `supabase--insert`, pas migration, car contient l'URL projet et l'anon key) :
```sql
select cron.schedule(
  'release-payout-holds',
  '*/5 * * * *',
  $$ select public.release_due_payout_holds(); $$
);
```

**Note sur le solde** : aujourd'hui `beneficiary_balances.available_amount` est crédité dès `turn_paid` ; la rétention est purement appliquée côté `request_withdrawal` (qui refuse si `payout_hold_until > now()`). Donc « libérer » = simplement laisser passer la condition de date — la RPC n'a pas à recréditer le solde, juste à marquer le tour et notifier. À confirmer en lisant `request_withdrawal` au moment du build.

### Fichiers impactés
- `supabase/migrations/<ts>_release_payout_holds.sql` — colonne + RPC + backfill.
- `supabase/functions/send-tontine-sms/index.ts` — branche `payout_hold_released` (ou réutilisation de `generic_broadcast`).
- Insert SQL (non-migration) — création du cron `release-payout-holds`.

### Hors périmètre
- Modifier l'UI : rien à changer, les composants `holdPayouts.ts` filtrent déjà sur `payout_hold_until > now()`.
- Rappels intermédiaires (J-1, etc.) — à voir plus tard si besoin.
