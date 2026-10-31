-- Force PostgREST schema cache reload + idempotent re-création du FK
-- turns.beneficiary_user_id -> public.profiles(id).
-- À ré-exécuter si l'aperçu Rotation renvoie encore PGRST200.

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