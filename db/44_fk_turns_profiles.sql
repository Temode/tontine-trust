-- Add a second FK turns.beneficiary_user_id -> public.profiles so PostgREST
-- can resolve the embed `beneficiary:profiles!turns_beneficiary_user_id_fkey(...)`.
-- profiles.id is itself a PK that references auth.users(id), so the invariant
-- (beneficiary must be a real user) is preserved.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'turns_beneficiary_user_id_fkey'
      and conrelid = 'public.turns'::regclass
  ) then
    alter table public.turns
      add constraint turns_beneficiary_user_id_fkey
      foreign key (beneficiary_user_id)
      references public.profiles(id)
      on delete restrict;
  end if;
end $$;

notify pgrst, 'reload schema';