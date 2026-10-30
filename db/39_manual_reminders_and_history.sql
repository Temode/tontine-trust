-- =====================================================================
-- Phase C5 — Rappels manuels + vue d'historique des paiements
-- Idempotent.
-- =====================================================================

do $$ begin
  create type public.reminder_channel as enum ('in_app', 'sms', 'whatsapp', 'email');
exception when duplicate_object then null; end $$;

create table if not exists public.manual_reminders_log (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  sender_id    uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  channel      public.reminder_channel not null,
  message      text,
  created_at   timestamptz not null default now()
);
create index if not exists mrl_pair_idx on public.manual_reminders_log(sender_id, recipient_id, created_at desc);
create index if not exists mrl_group_idx on public.manual_reminders_log(group_id, created_at desc);

grant select on public.manual_reminders_log to authenticated;
grant all on public.manual_reminders_log to service_role;

alter table public.manual_reminders_log enable row level security;
drop policy if exists mrl_select on public.manual_reminders_log;
create policy mrl_select on public.manual_reminders_log for select to authenticated
  using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or public.is_group_organizer(group_id, auth.uid())
  );

-- ---------------------------------------------------------------------
-- RPC : send_manual_reminder
-- ---------------------------------------------------------------------
create or replace function public.send_manual_reminder(
  _member_id uuid,
  _channel   public.reminder_channel,
  _message   text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_member public.group_members%rowtype;
  v_recent int;
  v_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if not (public.is_group_organizer(v_member.group_id, v_uid)
          or public.has_admin_permission(v_member.group_id, v_uid, 'can_send_announcements')) then
    raise exception 'FORBIDDEN';
  end if;

  select count(*) into v_recent from public.manual_reminders_log
   where sender_id = v_uid and recipient_id = v_member.user_id
     and created_at > now() - interval '24 hours';
  if v_recent > 0 then raise exception 'RATE_LIMITED' using hint = '1 rappel / 24h par membre'; end if;

  insert into public.manual_reminders_log (group_id, sender_id, recipient_id, channel, message)
  values (v_member.group_id, v_uid, v_member.user_id, _channel, _message)
  returning id into v_id;

  insert into public.notifications (user_id, kind, title, body, group_id, data)
  values (v_member.user_id, 'manual_reminder',
    'Rappel de l''organisateur',
    coalesce(_message, 'Pensez à régler votre cotisation.'),
    v_member.group_id, jsonb_build_object('channel', _channel, 'reminder_id', v_id));

  perform public.log_audit(v_member.group_id, 'manual_reminder_sent',
    'group_member', _member_id,
    jsonb_build_object('channel', _channel, 'recipient', v_member.user_id));
  return v_id;
end; $$;
grant execute on function public.send_manual_reminder(uuid, public.reminder_channel, text) to authenticated;

-- ---------------------------------------------------------------------
-- Vue : historique paiements par groupe
-- ---------------------------------------------------------------------
create or replace view public.group_payments_history
with (security_invoker = true) as
select
  c.id              as contribution_id,
  c.group_id,
  c.turn_id,
  t.turn_number,
  t.due_date,
  c.payer_user_id,
  p.full_name       as payer_name,
  c.amount,
  c.penalty_amount,
  c.status          as contribution_status,
  c.provider,
  c.reference,
  c.confirmed_at,
  c.confirmed_by,
  cp.full_name      as confirmed_by_name
from public.contributions c
join public.turns t on t.id = c.turn_id
left join public.profiles p  on p.id = c.payer_user_id
left join public.profiles cp on cp.id = c.confirmed_by
where public.is_group_member(c.group_id, auth.uid());

grant select on public.group_payments_history to authenticated;