-- Correctif db/18 : la vue my_receipts existait déjà avec un ordre de colonnes
-- différent. CREATE OR REPLACE VIEW interdit de renommer/réordonner les
-- colonnes existantes. On la supprime puis on la recrée.
drop view if exists public.my_receipts;

create view public.my_receipts
with (security_invoker = true) as
select
  r.id,
  r.receipt_number,
  r.turn_id,
  r.group_id,
  g.name as group_name,
  r.amount,
  r.fee_amount,
  r.net_amount,
  r.provider,
  r.hash,
  r.issued_at,
  t.turn_number,
  r.beneficiary_user_id,
  pb.full_name as beneficiary_name,
  pi.full_name as issued_by_name
from public.receipts r
join public.groups g on g.id = r.group_id
join public.turns t on t.id = r.turn_id
left join public.profiles pb on pb.id = r.beneficiary_user_id
left join public.profiles pi on pi.id = r.issued_by
where r.beneficiary_user_id = auth.uid()
order by r.issued_at desc;

grant select on public.my_receipts to authenticated;
