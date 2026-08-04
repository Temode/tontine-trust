-- =====================================================================
-- 48 — SMS de cycle de vie tontine (Nimba) via triggers temps réel
-- =====================================================================

-- Extension pg_net pour HTTP depuis Postgres
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Table de configuration interne (URL fonction + token partagé)
-- ---------------------------------------------------------------------
create table if not exists public.internal_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

grant select on public.internal_config to service_role;
grant all on public.internal_config to service_role;
alter table public.internal_config enable row level security;
-- Aucune policy : accès uniquement via SECURITY DEFINER ou service_role.

insert into public.internal_config (key, value) values
  ('functions_url', 'https://oljyzmannzejtsbfpzxp.supabase.co/functions/v1'),
  ('tontine_sms_token', encode(gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2. Ajout valeur ENUM 'cycle_completed' à notification_kind si absente
-- ---------------------------------------------------------------------
do $$ begin
  alter type public.notification_kind add value if not exists 'cycle_completed';
end $$;

-- ---------------------------------------------------------------------
-- 3. Helper enqueue_tontine_sms — déclenche un appel HTTP asynchrone
-- ---------------------------------------------------------------------
create or replace function public.enqueue_tontine_sms(
  _kind text,
  _payload jsonb
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url   text;
  v_token text;
begin
  select value into v_url   from public.internal_config where key = 'functions_url';
  select value into v_token from public.internal_config where key = 'tontine_sms_token';
  if v_url is null or v_token is null then
    raise warning '[enqueue_tontine_sms] config manquante (functions_url/tontine_sms_token)';
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/send-tontine-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Token', v_token
    ),
    body    := jsonb_build_object('kind', _kind) || _payload,
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning '[enqueue_tontine_sms] échec: %', sqlerrm;
end; $$;

revoke all on function public.enqueue_tontine_sms(text, jsonb) from public;
grant execute on function public.enqueue_tontine_sms(text, jsonb) to service_role;

-- ---------------------------------------------------------------------
-- 4. Trigger : contribution confirmée → SMS payeur + relance autres membres
-- ---------------------------------------------------------------------
create or replace function public.trg_sms_on_contribution_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'INSERT' and NEW.status = 'confirmed')
     or (TG_OP = 'UPDATE' and NEW.status = 'confirmed'
         and OLD.status is distinct from 'confirmed') then
    perform public.enqueue_tontine_sms(
      'contribution_confirmed',
      jsonb_build_object(
        'contribution_id', NEW.id,
        'turn_id',         NEW.turn_id,
        'group_id',        NEW.group_id,
        'payer_user_id',   NEW.payer_user_id,
        'amount',          NEW.amount
      )
    );
  end if;
  return NEW;
end; $$;

drop trigger if exists sms_on_contribution_confirmed on public.contributions;
create trigger sms_on_contribution_confirmed
  after insert or update of status on public.contributions
  for each row execute function public.trg_sms_on_contribution_confirmed();

-- ---------------------------------------------------------------------
-- 5. Trigger : turn payé → SMS bénéficiaire (+ cycle terminé éventuel)
-- ---------------------------------------------------------------------
create or replace function public.trg_sms_on_turn_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cycle_done boolean;
begin
  if TG_OP = 'UPDATE' and NEW.status = 'paid'
     and OLD.status is distinct from 'paid' then

    perform public.enqueue_tontine_sms(
      'turn_paid',
      jsonb_build_object(
        'turn_id',              NEW.id,
        'group_id',             NEW.group_id,
        'turn_number',          NEW.turn_number,
        'beneficiary_user_id',  NEW.beneficiary_user_id,
        'amount',               NEW.payout_amount
      )
    );

    -- Cycle terminé si plus aucun tour non-payé dans ce cycle
    select not exists (
      select 1 from public.turns
       where cycle_id = NEW.cycle_id
         and status <> 'paid'
    ) into v_cycle_done;

    if v_cycle_done then
      perform public.enqueue_tontine_sms(
        'cycle_completed',
        jsonb_build_object(
          'group_id', NEW.group_id,
          'cycle_id', NEW.cycle_id
        )
      );
    end if;
  end if;
  return NEW;
end; $$;

drop trigger if exists sms_on_turn_paid on public.turns;
create trigger sms_on_turn_paid
  after update of status on public.turns
  for each row execute function public.trg_sms_on_turn_paid();