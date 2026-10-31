-- Rattrapage : assure que chaque créateur de groupe est bien membre actif
-- en tant qu'organisateur. Idempotent.
insert into public.group_members (group_id, user_id, role, status, position)
select g.id, g.created_by, 'organisateur', 'active', 1
from public.groups g
where not exists (
  select 1 from public.group_members gm
  where gm.group_id = g.id and gm.user_id = g.created_by
)
on conflict (group_id, user_id) do nothing;