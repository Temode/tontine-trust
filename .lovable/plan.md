## Problème

La migration `db/46_djomy_payments.sql` référence une table inexistante `public.memberships` (avec des rôles `admin`/`co_admin`). Le vrai schéma utilise `public.group_members` avec les rôles `organisateur` / `co_organisateur` / `participant`, et un helper `public.is_group_organizer(group_id, user_id)`.

## Correctif

Remplacer dans `db/46_djomy_payments.sql` les deux policies RLS de `payment_links` :

- `payment_links_member_select` : utiliser `public.group_members gm` avec `gm.status = 'active'` au lieu de `memberships`.
- `payment_links_admin_write` : utiliser `public.is_group_organizer(payment_links.group_id, auth.uid())` (helper SECURITY DEFINER déjà en place, cohérent avec le reste du schéma — couvre organisateur + co-organisateur).

Aucun autre changement nécessaire : les RPC (`start_djomy_payment`, `attach_djomy_reference`, `apply_djomy_webhook`), les colonnes ajoutées à `payments`, la table `djomy_webhook_events` et l'enum `djomy` sont corrects.

## Étapes côté utilisateur

1. Je corrige `db/46_djomy_payments.sql`.
2. Tu relances **l'intégralité** du fichier dans le SQL Editor (il est idempotent — `if not exists`, `do $$ … exception …`, `drop policy if exists`).
3. Le webhook Djomy `https://f51a5fe7-3210-4b4e-97ff-b6c5213b2913.functions.supabase.co/djomy-webhook` est correct, on garde tel quel.
4. Je relance ensuite le test E2E Bob → paiement pour valider que `start_djomy_payment` et `djomy-init-payment` répondent OK.

## Détails techniques

Diff conceptuel des policies :

```sql
-- AVANT (cassé)
using (exists (
  select 1 from public.memberships m
  where m.group_id = payment_links.group_id and m.user_id = auth.uid()
))

-- APRÈS
using (exists (
  select 1 from public.group_members gm
  where gm.group_id = payment_links.group_id
    and gm.user_id = auth.uid()
    and gm.status = 'active'
))
```

```sql
-- AVANT (cassé)
using (exists (
  select 1 from public.memberships m
  where m.group_id = payment_links.group_id
    and m.user_id = auth.uid()
    and m.role in ('admin','co_admin')
))

-- APRÈS
using (public.is_group_organizer(payment_links.group_id, auth.uid()))
with check (public.is_group_organizer(payment_links.group_id, auth.uid()))
```