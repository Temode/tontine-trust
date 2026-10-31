ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_max_members_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_max_members_check CHECK (
  (kind = 'solo'::public.group_kind AND max_members = 1)
  OR (kind <> 'solo'::public.group_kind AND max_members >= 2 AND max_members <= 100)
);