## Problème

`apply_subscription_webhook` échoue systématiquement avec `duplicate key … user_subs_active_uniq` : le user a déjà une ligne `free/active`, et la nouvelle ligne Premium ne peut pas passer à `active` à cause de l'index unique partiel sur `user_id WHERE status IN ('active','trialing','past_due')`. Résultat : Djomy encaisse, mais la table reste en pending et l'UI reste sur Free.

## Correctif

### 1. Migration — corriger `apply_subscription_webhook`
Avant de basculer une ligne à `active`, clôturer atomiquement les autres abonnements actifs du même user :

```sql
CREATE OR REPLACE FUNCTION public.apply_subscription_webhook(
  _subscription_id uuid, _new_status text, _djomy_ref text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _mapped public.subscription_status;
  _uid uuid;
BEGIN
  _mapped := CASE _new_status
    WHEN 'succeeded' THEN 'active'::public.subscription_status
    WHEN 'paid'      THEN 'active'::public.subscription_status
    WHEN 'failed'    THEN 'past_due'::public.subscription_status
    WHEN 'cancelled' THEN 'cancelled'::public.subscription_status
    ELSE 'pending'::public.subscription_status
  END;

  SELECT user_id INTO _uid FROM public.user_subscriptions WHERE id = _subscription_id;
  IF _uid IS NULL THEN RETURN; END IF;

  -- Si on active une nouvelle souscription, on clôture les précédentes
  -- pour respecter user_subs_active_uniq (index partiel sur active/trialing/past_due).
  IF _mapped = 'active' THEN
    UPDATE public.user_subscriptions
       SET status = 'cancelled', cancelled_at = now(), updated_at = now()
     WHERE user_id = _uid
       AND id <> _subscription_id
       AND status IN ('active','trialing','past_due');
  END IF;

  UPDATE public.user_subscriptions
     SET status = _mapped,
         djomy_ref = COALESCE(_djomy_ref, djomy_ref),
         current_period_end = CASE WHEN _mapped = 'active'
                                   THEN now() + interval '30 days'
                                   ELSE current_period_end END,
         updated_at = now()
   WHERE id = _subscription_id;
END; $$;
```

### 2. Migration — durcir `start_subscription_checkout`
Si un `pending` existe déjà pour ce user + plan, le réutiliser au lieu d'empiler les lignes (évite les orphelines à chaque clic sur « Payer »).

```sql
-- Avant l'INSERT pending, tenter :
SELECT * INTO _row FROM public.user_subscriptions
 WHERE user_id=_uid AND plan_code=_plan_code AND status='pending'
 ORDER BY created_at DESC LIMIT 1;
IF FOUND THEN
  UPDATE public.user_subscriptions
     SET tier_options=COALESCE(_tier_options,'{}'::jsonb),
         price_monthly=_price, updated_at=now()
   WHERE id=_row.id RETURNING * INTO _row;
  RETURN _row;
END IF;
-- sinon INSERT comme aujourd'hui
```

### 3. Réconciliation manuelle du compte impacté
Pour `moncomptepaypal5@gmail.com` (user `ade89a7d-dbb6-45e9-b40d-7b9a81942016`), après déploiement de la migration : appeler `apply_subscription_webhook(<id_pending>, 'succeeded', <djomy_ref>)` via `supabase--insert` afin d'activer l'abonnement Premium déjà payé et de clôturer l'ancienne ligne free. Vérification préalable via `supabase--read_query` pour identifier la ligne pending exacte et son `djomy_ref`.

### 4. Aucun changement frontend
`SubscriptionConfirmation.tsx` et `djomy-subscription-status` sont corrects : dès que la RPC réussira, Realtime + polling actuels basculeront l'UI sur l'écran « Félicitations » sans autre modification.

### 5. Vérification
- Rejouer un paiement Premium bout-en-bout → vérifier logs `djomy-subscription-status` (plus de 23505) et statut UI actif.
- `SELECT status, count(*) FROM user_subscriptions WHERE user_id=… GROUP BY status` → une seule ligne active.

## Fichiers touchés

- **Créé** : `supabase/migrations/<ts>_fix_apply_subscription_webhook.sql` (RPC + start_subscription_checkout)
- **Action ponctuelle** : réconciliation du compte `moncomptepaypal5@gmail.com` via insert tool
- Aucun changement code applicatif nécessaire.
