-- =====================================================================
-- Tontine Digital — Phase F : centre de notifications
-- À exécuter APRÈS db/06_phase_e_reliability.sql
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Étend l'ENUM notification_kind avec les nouveaux types
-- ---------------------------------------------------------------------
do $$ begin
  alter type public.notification_kind add value if not exists 'turn_started';
  alter type public.notification_kind add value if not exists 'payout_released';
  alter type public.notification_kind add value if not exists 'receipt_ready';
  alter type public.notification_kind add value if not exists 'reliability_changed';
  alter type public.notification_kind add value if not exists 'member_joined';
  alter type public.notification_kind add value if not exists 'contribution_confirmed';
end $$;

-- ---------------------------------------------------------------------
-- 2. Colonnes supplémentaires
-- ---------------------------------------------------------------------
alter table public.notifications
  add column if not exists turn_id uuid references public.turns(id) on delete cascade,
  add column if not exists link text;

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. Helper notify()
-- ---------------------------------------------------------------------
create or replace function public.notify(
  _user_id uuid,
  _kind public.notification_kind,
  _title text,
  _body text default null,
  _group_id uuid default null,
  _turn_id uuid default null,
  _link text default null,
  _data jsonb default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if _user_id is null then return null; end if;
  insert into public.notifications (user_id, kind, title, body, group_id, turn_id, link, data)
  values (_user_id, _kind, _title, _body, _group_id, _turn_id, _link, _data)
  returning id into v_id;
  return v_id;
end; $$;

-- ---------------------------------------------------------------------
-- 4. RPC : marquer lu / tout marquer lu
-- ---------------------------------------------------------------------
create or replace function public.mark_notification_read(_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
   where id = _id and user_id = auth.uid() and read_at is null;
$$;

create or replace function public.mark_all_notifications_read()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.notify(uuid, public.notification_kind, text, text, uuid, uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Trigger : nouveau tour démarre (status -> collecting)
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_turn_started()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_group_name text;
begin
  if (TG_OP = 'UPDATE' and NEW.status = 'collecting' and OLD.status is distinct from 'collecting')
     or (TG_OP = 'INSERT' and NEW.status = 'collecting') then
    select name into v_group_name from public.groups where id = NEW.group_id;
    for r in
      select user_id from public.group_members
       where group_id = NEW.group_id and status = 'active'
    loop
      perform public.notify(
        r.user_id, 'turn_started',
        'Nouveau tour ouvert',
        format('Tour #%s de %s — cotisez avant l''échéance.', NEW.turn_number, coalesce(v_group_name, 'votre groupe')),
        NEW.group_id, NEW.id,
        '/groupes/' || NEW.group_id::text, null
      );
    end loop;
  end if;
  return NEW;
end; $$;

drop trigger if exists turns_notify_started on public.turns;
create trigger turns_notify_started
  after insert or update of status on public.turns
  for each row execute function public.trg_notify_turn_started();

-- ---------------------------------------------------------------------
-- 6. Trigger : versement (status -> paid) → notif bénéficiaire + reçu prêt
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_payout()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_group_name text;
begin
  if TG_OP = 'UPDATE' and NEW.status = 'paid' and OLD.status is distinct from 'paid' then
    select name into v_group_name from public.groups where id = NEW.group_id;
    perform public.notify(
      NEW.beneficiary_user_id, 'payout_released',
      'Versement reçu',
      format('Vous êtes le bénéficiaire du tour #%s de %s.', NEW.turn_number, coalesce(v_group_name, '')),
      NEW.group_id, NEW.id, '/recus', null
    );
    perform public.notify(
      NEW.beneficiary_user_id, 'receipt_ready',
      'Reçu disponible',
      'Votre reçu numérique est prêt à être consulté.',
      NEW.group_id, NEW.id, '/recus', null
    );
  end if;
  return NEW;
end; $$;

drop trigger if exists turns_notify_payout on public.turns;
create trigger turns_notify_payout
  after update of status on public.turns
  for each row execute function public.trg_notify_payout();

-- ---------------------------------------------------------------------
-- 7. Trigger : contribution confirmée → notif payeur + organisateur
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_contribution_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_group_name text; v_organizer uuid; v_payer_name text;
begin
  if (TG_OP = 'UPDATE' and NEW.status = 'confirmed' and OLD.status is distinct from 'confirmed')
     or (TG_OP = 'INSERT' and NEW.status = 'confirmed') then
    select name, created_by into v_group_name, v_organizer
      from public.groups where id = NEW.group_id;
    select full_name into v_payer_name from public.profiles where id = NEW.payer_user_id;

    perform public.notify(
      NEW.payer_user_id, 'contribution_confirmed',
      'Cotisation confirmée',
      format('Votre cotisation pour %s a été confirmée.', coalesce(v_group_name, 'le groupe')),
      NEW.group_id, NEW.turn_id,
      '/groupes/' || NEW.group_id::text, null
    );

    if v_organizer is not null and v_organizer <> NEW.payer_user_id then
      perform public.notify(
        v_organizer, 'contribution_received',
        'Nouvelle cotisation reçue',
        format('%s a cotisé pour %s.', coalesce(v_payer_name, 'Un membre'), coalesce(v_group_name, 'le groupe')),
        NEW.group_id, NEW.turn_id,
        '/groupes/' || NEW.group_id::text, null
      );
    end if;
  end if;
  return NEW;
end; $$;

drop trigger if exists contributions_notify_confirmed on public.contributions;
create trigger contributions_notify_confirmed
  after insert or update of status on public.contributions
  for each row execute function public.trg_notify_contribution_confirmed();

-- ---------------------------------------------------------------------
-- 8. Trigger : score de fiabilité — changement de palier
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_reliability_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and NEW.tier is distinct from OLD.tier then
    perform public.notify(
      NEW.user_id, 'reliability_changed',
      'Votre score de fiabilité a évolué',
      format('Nouveau palier : %s (%s/100).', NEW.tier::text, NEW.score),
      null, null, '/profil',
      jsonb_build_object('old_tier', OLD.tier, 'new_tier', NEW.tier, 'score', NEW.score)
    );
  end if;
  return NEW;
end; $$;

drop trigger if exists reliability_notify_changed on public.user_reliability_scores;
create trigger reliability_notify_changed
  after update on public.user_reliability_scores
  for each row execute function public.trg_notify_reliability_changed();

-- ---------------------------------------------------------------------
-- 9. Trigger : nouveau membre actif → notif organisateur
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_member_joined()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_group_name text; v_organizer uuid; v_member_name text;
begin
  if NEW.status = 'active'
     and (TG_OP = 'INSERT' or OLD.status is distinct from 'active') then
    select name, created_by into v_group_name, v_organizer
      from public.groups where id = NEW.group_id;
    if v_organizer is null or v_organizer = NEW.user_id then
      return NEW;
    end if;
    select full_name into v_member_name from public.profiles where id = NEW.user_id;
    perform public.notify(
      v_organizer, 'member_joined',
      'Nouveau membre',
      format('%s a rejoint %s.', coalesce(v_member_name, 'Un membre'), coalesce(v_group_name, 'le groupe')),
      NEW.group_id, null,
      '/groupes/' || NEW.group_id::text, null
    );
  end if;
  return NEW;
end; $$;

drop trigger if exists members_notify_joined on public.group_members;
create trigger members_notify_joined
  after insert or update of status on public.group_members
  for each row execute function public.trg_notify_member_joined();

-- ---------------------------------------------------------------------
-- 10. VIEW my_notifications (50 derniers)
-- ---------------------------------------------------------------------
create or replace view public.my_notifications
with (security_invoker = true) as
select n.*
  from public.notifications n
 where n.user_id = auth.uid()
 order by n.created_at desc
 limit 50;

-- ---------------------------------------------------------------------
-- 11. Realtime : publier la table notifications
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
         when others then null;
end $$;

alter table public.notifications replica identity full;

-- =====================================================================
-- Fin Phase F
-- =====================================================================