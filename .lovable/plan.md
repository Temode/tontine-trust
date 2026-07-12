## Problème

La RPC `request_user_withdrawal` échoue en **HTTP 400 / SQLSTATE 22003 « integer out of range »** dès son entrée.

Cause exacte : le verrou de sérialisation utilise
```sql
pg_advisory_xact_lock(4242, hashtextextended(v_uid::text, 0)::int)
```
`hashtextextended()` renvoie un **bigint** (souvent > 2 147 483 647). Le cast `::int` fait overflow → 22003, et l'exception remonte avant même la vérification du solde. Aucune demande de retrait ne peut aboutir aujourd'hui, quel que soit le montant ou le moyen de paiement.

## Correctif

Une **migration SQL unique** qui remplace la RPC `request_user_withdrawal` par la même logique, mais avec un verrou 64-bit valide :

```sql
PERFORM pg_advisory_xact_lock(hashtextextended('user_withdrawal:' || v_uid::text, 0));
```

- Signature à un seul argument `bigint` → aucun cast risqué.
- Le préfixe `user_withdrawal:` scope le namespace applicatif (remplace le `4242`).
- Comportement identique : sérialise les demandes concurrentes du même utilisateur (test `db/tests/user_withdrawals_flow.test.sql` reste vert).

Aucun autre changement (UI, edge functions, autres RPC) — le bug est 100 % côté SQL.

## Vérification

1. Recharger `/solde`, faire une demande de retrait valide → doit renvoyer un `uuid` (200).
2. Rejouer `db/tests/user_withdrawals_flow.test.sql` pour confirmer la non-régression (gel, rejet/dégel, completed FIFO, `INSUFFICIENT_BALANCE`).
3. Vérifier dans les logs qu'aucun `22003` ne réapparaît sur `/rpc/request_user_withdrawal`.
