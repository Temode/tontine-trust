-- =====================================================================
-- Phase C1 prelude — enums isolés dans une transaction dédiée pour
-- pouvoir être référencés en littéral dans 35_external_payments.sql.
-- Idempotent.
-- =====================================================================

-- 1. Enum des méthodes de paiement hors-app
do $$ begin
  create type public.payment_method_external as enum (
    'cash', 'bank_transfer', 'om_external', 'mtn_external', 'other'
  );
exception when duplicate_object then null; end $$;

-- 2. Enum statut des preuves
do $$ begin
  create type public.external_proof_status as enum (
    'pending', 'confirmed', 'rejected'
  );
exception when duplicate_object then null; end $$;

-- 3. notification_kind : valeurs ajoutées pour Phase C complète
do $$
declare k text;
begin
  for k in select unnest(array[
    'payment_confirmed_by_admin',
    'payment_rejected_by_admin',
    'external_payment_submitted',
    'penalty_waived',
    'penalty_adjusted',
    'cycle_paused',
    'cycle_resumed',
    'due_date_shifted',
    'group_archived',
    'manual_reminder'
  ]) loop
    begin
      execute format('alter type public.notification_kind add value if not exists %L', k);
    exception when others then null; end;
  end loop;
end $$;

-- 4. group_status : ajoute 'paused'
do $$ begin
  alter type public.group_status add value if not exists 'paused';
exception when others then null; end $$;

-- 5. Seed notification_preferences via EXECUTE pour différer la résolution
--    des littéraux enum nouvellement créés.
do $seed$
declare k text;
begin
  for k in select unnest(array[
    'payment_confirmed_by_admin','payment_rejected_by_admin',
    'external_payment_submitted','penalty_waived','penalty_adjusted',
    'cycle_paused','cycle_resumed','due_date_shifted',
    'group_archived','manual_reminder'
  ]) loop
    begin
      execute format($f$
        insert into public.notification_preferences (kind, in_app, email, sms)
        select %L::public.notification_kind, true, false, false
        where exists (select 1 from information_schema.tables
                       where table_schema='public' and table_name='notification_preferences')
        on conflict (kind) do nothing
      $f$, k);
    exception when others then null; end;
  end loop;
end $seed$;