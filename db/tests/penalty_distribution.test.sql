-- Test manuel : équilibre et idempotence de la redistribution des pénalités.
-- Invariant 1 : la somme des parts distribuées égale exactement la pénalité.
select c.id,
       c.penalty_amount,
       coalesce(sum(pd.amount), 0) as distributed,
       c.penalty_amount - coalesce(sum(pd.amount), 0) as ecart
  from public.contributions c
  left join public.penalty_distributions pd
    on pd.contribution_id = c.id and pd.reverted_at is null
 where coalesce(c.penalty_amount, 0) > 0
 group by c.id, c.penalty_amount
having c.penalty_amount <> coalesce(sum(pd.amount), 0);
-- Attendu : 0 ligne.

-- Invariant 2 : rejouer distribute_penalty ne crée pas de double crédit.
-- select public.distribute_penalty('<contribution_id>', false); -- doit retourner 0

-- Invariant 3 : cohérence du journal comptable (séquestre >= 0)
select
  coalesce(sum(amount) filter (where direction = 'in'), 0)
  - coalesce(sum(amount) filter (where direction = 'out'), 0) as escrow_net
from public.platform_ledger
where compartment = 'client_escrow';
