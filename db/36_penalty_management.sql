-- =====================================================================
-- Phase C2 — Gestion des pénalités (waive / adjust)
-- Les pénalités vivent sur public.contributions.penalty_amount (db/17).
-- Prérequis : db/35a (notification_kind), db/33 (has_admin_permission).
-- Idempotent.
-- =====================================================================

alter table public.contributions
  add column if not exists penalty_waived_at timestamptz,
  add column if not exists penalty_waived_by uuid references auth.users(id),
  add column if not exists penalty_waive_reason text,
  add column if not exists penalty_adjusted_from bigint,
  add column if not exists penalty_adjusted_by uuid references auth.users(id),
  add column if not exists penalty_adjusted_at timestamptz,
  add column if not exists penalty_adjust_reason text;

-- ---------------------------------------------------------------------
-- RPC : waive_penalty(_contribution_id, _reason)
-- ---------------------------------------------------------------------
create or replace function public.waive_penalty(_contribution_id uuid, _reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_c public.contributions%rowtype;
  v_old bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_c from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;
  if not public.has_admin_permission(v_c.group_id, v_uid, 'can_waive_penalty') then
    raise exception 'FORBIDDEN';
  end if;
  if coalesce(v_c.penalty_amount, 0) = 0 then raise exception 'NO_PENALTY'; end if;

  v_old := v_c.penalty_amount;
  update public.contributions set
    penalty_amount = 0,
    penalty_waived_at = now(),
    penalty_waived_by = v_uid,
    penalty_waive_reason = _reason
  where id = _contribution_id;

  insert into public.notifications (user_id, kind, title, body, group_id, data)
  values (v_c.payer_user_id, 'penalty_waived',
    'Pénalité annulée',
    coalesce(_reason, 'Un administrateur a annulé votre pénalité de retard.'),
    v_c.group_id, jsonb_build_object('contribution_id', _contribution_id, 'amount', v_old));

  perform public.log_audit(
    v_c.group_id, 'penalty_waived', 'contribution', _contribution_id,
    jsonb_build_object('amount', v_old, 'reason', _reason)
  );
end; $$;
grant execute on function public.waive_penalty(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- RPC : adjust_penalty(_contribution_id, _new_amount, _reason)
-- ---------------------------------------------------------------------
create or replace function public.adjust_penalty(
  _contribution_id uuid, _new_amount bigint, _reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_c public.contributions%rowtype;
  v_old bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if _new_amount is null or _new_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into v_c from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;
  if not public.has_admin_permission(v_c.group_id, v_uid, 'can_waive_penalty') then
    raise exception 'FORBIDDEN';
  end if;

  v_old := coalesce(v_c.penalty_amount, 0);
  update public.contributions set
    penalty_amount = _new_amount,
    penalty_adjusted_from = v_old,
    penalty_adjusted_by = v_uid,
    penalty_adjusted_at = now(),
    penalty_adjust_reason = _reason
  where id = _contribution_id;

  insert into public.notifications (user_id, kind, title, body, group_id, data)
  values (v_c.payer_user_id, 'penalty_adjusted',
    'Pénalité ajustée',
    coalesce(_reason, 'Le montant de votre pénalité a été ajusté.'),
    v_c.group_id,
    jsonb_build_object('contribution_id', _contribution_id, 'from', v_old, 'to', _new_amount));

  perform public.log_audit(
    v_c.group_id, 'penalty_adjusted', 'contribution', _contribution_id,
    jsonb_build_object('from', v_old, 'to', _new_amount, 'reason', _reason)
  );
end; $$;
grant execute on function public.adjust_penalty(uuid, bigint, text) to authenticated;