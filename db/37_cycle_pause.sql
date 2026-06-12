-- =====================================================================
-- Phase C3 — Pause / reprise de cycle + report d'échéance
-- Prérequis : db/35a (enum 'paused' déjà ajouté), db/33 (has_admin_permission).
-- Idempotent.
-- =====================================================================

alter table public.groups
  add column if not exists paused_at        timestamptz,
  add column if not exists paused_reason    text,
  add column if not exists paused_by        uuid references auth.users(id),
  add column if not exists total_paused_days int not null default 0;

-- ---------------------------------------------------------------------
-- Trigger : empêche tout UPDATE direct de groups.status hors RPC
-- ---------------------------------------------------------------------
create or replace function public.trg_groups_block_direct_status()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and OLD.status is distinct from NEW.status
     and not public.is_rpc_context() then
    raise exception 'DIRECT_GROUP_STATUS_UPDATE_FORBIDDEN'
      using hint = 'Use pause_cycle / resume_cycle / archive_group RPCs';
  end if;
  return NEW;
end; $$;
drop trigger if exists groups_block_direct_status on public.groups;
create trigger groups_block_direct_status
  before update on public.groups
  for each row execute function public.trg_groups_block_direct_status();

-- ---------------------------------------------------------------------
-- RPC : pause_cycle(_group_id, _reason)
-- ---------------------------------------------------------------------
create or replace function public.pause_cycle(_group_id uuid, _reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_g public.groups%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_g from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if not public.has_admin_permission(_group_id, v_uid, 'can_pause_cycle') then
    raise exception 'FORBIDDEN';
  end if;
  if v_g.status not in ('active', 'open') then raise exception 'NOT_PAUSABLE'; end if;

  perform set_config('app.via_rpc', '1', true);
  update public.groups set
    status = 'paused',
    paused_at = now(),
    paused_reason = _reason,
    paused_by = v_uid
  where id = _group_id;

  insert into public.notifications (user_id, kind, title, body, group_id, data)
  select gm.user_id, 'cycle_paused',
         'Cycle mis en pause',
         coalesce(_reason, 'Le cycle de tontine a été mis en pause.'),
         _group_id, jsonb_build_object('paused_at', now())
  from public.group_members gm
  where gm.group_id = _group_id and gm.status = 'active';

  perform public.log_audit(_group_id, 'cycle_paused', 'group', _group_id,
    jsonb_build_object('reason', _reason));
end; $$;
grant execute on function public.pause_cycle(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- RPC : resume_cycle(_group_id)
--   Reporte les due_date des tours non clôturés du nb de jours pausés.
-- ---------------------------------------------------------------------
create or replace function public.resume_cycle(_group_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_g public.groups%rowtype;
  v_days int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_g from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if not public.has_admin_permission(_group_id, v_uid, 'can_pause_cycle') then
    raise exception 'FORBIDDEN';
  end if;
  if v_g.status <> 'paused' then raise exception 'NOT_PAUSED'; end if;

  v_days := greatest(0, extract(day from (now() - v_g.paused_at))::int);

  perform set_config('app.via_rpc', '1', true);
  update public.groups set
    status = 'active',
    paused_at = null,
    paused_reason = null,
    paused_by = null,
    total_paused_days = coalesce(total_paused_days, 0) + v_days
  where id = _group_id;

  -- Décale toutes les échéances des tours non clôturés
  if v_days > 0 then
    update public.turns
      set due_date = due_date + v_days
      where group_id = _group_id and status in ('upcoming', 'collecting');
  end if;

  insert into public.notifications (user_id, kind, title, body, group_id, data)
  select gm.user_id, 'cycle_resumed',
         'Cycle relancé',
         format('Cycle relancé. Échéances décalées de %s jours.', v_days),
         _group_id, jsonb_build_object('days_shifted', v_days)
  from public.group_members gm
  where gm.group_id = _group_id and gm.status = 'active';

  perform public.log_audit(_group_id, 'cycle_resumed', 'group', _group_id,
    jsonb_build_object('days_shifted', v_days));
  return v_days;
end; $$;
grant execute on function public.resume_cycle(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RPC : shift_due_date(_turn_id, _new_date, _reason)
-- ---------------------------------------------------------------------
create or replace function public.shift_due_date(_turn_id uuid, _new_date date, _reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_turn public.turns%rowtype;
  v_old date;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if _new_date is null then raise exception 'INVALID_DATE'; end if;
  select * into v_turn from public.turns where id = _turn_id;
  if not found then raise exception 'TURN_NOT_FOUND'; end if;
  if not (public.is_group_organizer(v_turn.group_id, v_uid)
          or public.has_admin_permission(v_turn.group_id, v_uid, 'can_pause_cycle')) then
    raise exception 'FORBIDDEN';
  end if;
  if v_turn.status not in ('upcoming', 'collecting') then raise exception 'TURN_CLOSED'; end if;

  v_old := v_turn.due_date;
  update public.turns set due_date = _new_date where id = _turn_id;

  insert into public.notifications (user_id, kind, title, body, group_id, data)
  select c.payer_user_id, 'due_date_shifted',
         'Échéance reportée',
         format('L''échéance du tour #%s a été reportée au %s.', v_turn.turn_number, _new_date),
         v_turn.group_id,
         jsonb_build_object('turn_id', _turn_id, 'from', v_old, 'to', _new_date)
  from public.contributions c
  where c.turn_id = _turn_id and c.status <> 'confirmed';

  perform public.log_audit(v_turn.group_id, 'due_date_shifted', 'turn', _turn_id,
    jsonb_build_object('from', v_old, 'to', _new_date, 'reason', _reason));
end; $$;
grant execute on function public.shift_due_date(uuid, date, text) to authenticated;