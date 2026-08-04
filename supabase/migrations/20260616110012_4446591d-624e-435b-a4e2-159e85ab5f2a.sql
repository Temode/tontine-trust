
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role' and e.enumlabel = 'super_admin'
  ) then
    alter type public.app_role add value 'super_admin';
  end if;
end$$;

do $$
declare k text;
begin
  foreach k in array array[
    'group_deletion_requested',
    'group_deletion_vote_recorded',
    'group_deletion_rejected_by_member',
    'group_deletion_pending_admin',
    'group_deletion_approved',
    'group_deletion_refused'
  ] loop
    if not exists (
      select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
      where t.typname='notification_kind' and e.enumlabel=k
    ) then
      execute format('alter type public.notification_kind add value %L', k);
    end if;
  end loop;
end$$;

do $$ begin
  if not exists (select 1 from pg_type where typname='deletion_request_status') then
    create type public.deletion_request_status as enum
      ('pending_members','pending_admin','approved','rejected','cancelled');
  end if;
  if not exists (select 1 from pg_type where typname='deletion_vote_choice') then
    create type public.deletion_vote_choice as enum ('yes','no');
  end if;
end$$;
