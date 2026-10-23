
do $$ begin
  create type public.payment_method_external as enum ('cash', 'bank_transfer', 'om_external', 'mtn_external', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.external_proof_status as enum ('pending', 'confirmed', 'rejected');
exception when duplicate_object then null; end $$;

do $$
declare k text;
begin
  for k in select unnest(array[
    'payment_confirmed_by_admin','payment_rejected_by_admin','external_payment_submitted',
    'penalty_waived','penalty_adjusted','cycle_paused','cycle_resumed',
    'due_date_shifted','group_archived','manual_reminder'
  ]) loop
    begin execute format('alter type public.notification_kind add value if not exists %L', k);
    exception when others then null; end;
  end loop;
end $$;

do $$ begin
  alter type public.group_status add value if not exists 'paused';
exception when others then null; end $$;
