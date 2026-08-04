-- ============================================================
-- 49_sms_coverage_audit.sql — Couverture SMS étendue
-- ============================================================

-- Ajout enum kinds manquants
do $$ begin
  alter type public.notification_kind add value if not exists 'withdrawal_requested';
end $$;
do $$ begin
  alter type public.notification_kind add value if not exists 'withdrawal_processing';
end $$;
do $$ begin
  alter type public.notification_kind add value if not exists 'withdrawal_paid';
end $$;
do $$ begin
  alter type public.notification_kind add value if not exists 'withdrawal_failed';
end $$;
do $$ begin
  alter type public.notification_kind add value if not exists 'withdrawal_cancelled';
end $$;

-- ------------------------------------------------------------
-- Helper : formate un montant GNF avec espace insécable
-- ------------------------------------------------------------
create or replace function public.fmt_gnf(_n numeric)
returns text language sql immutable as $$
  select regexp_replace(round(coalesce(_n,0))::text, '\B(?=(\d{3})+(?!\d))', E'\u00A0', 'g') || ' GNF'
$$;

-- ------------------------------------------------------------
-- Helper : enqueue un SMS générique (kind/body/recipients)
-- ------------------------------------------------------------
create or replace function public.enqueue_generic_sms(
  _sms_kind text,
  _recipients uuid[],
  _body text,
  _group_id uuid default null,
  _turn_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_clean uuid[];
begin
  v_clean := array(select distinct x from unnest(_recipients) x where x is not null);
  if v_clean is null or array_length(v_clean,1) is null then return; end if;
  perform public.enqueue_tontine_sms(
    'generic_broadcast',
    jsonb_build_object(
      'sms_kind', _sms_kind,
      'recipients', to_jsonb(v_clean),
      'body', _body,
      'group_id', _group_id,
      'turn_id', _turn_id
    )
  );
end; $$;

revoke all on function public.enqueue_generic_sms(text, uuid[], text, uuid, uuid) from public;
grant execute on function public.enqueue_generic_sms(text, uuid[], text, uuid, uuid) to service_role;

-- ============================================================
-- 1. Retraits
-- ============================================================
create or replace function public.trg_sms_withdrawal()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_admins uuid[];
  v_amount text := public.fmt_gnf(new.amount);
  v_method text := coalesce(new.method::text,'');
begin
  if (tg_op = 'INSERT') then
    -- SMS demandeur
    perform public.enqueue_generic_sms(
      'withdrawal_requested',
      array[new.user_id],
      'Tontine Digitale : votre demande de retrait de ' || v_amount || ' (' || v_method
        || ') a ete enregistree. Ref ' || substr(new.id::text,1,8) || '. Vous serez notifie a chaque etape.',
      new.group_id
    );
    -- SMS super-admins
    v_admins := array(select user_id from public.user_roles where role = 'super_admin');
    perform public.enqueue_generic_sms(
      'withdrawal_requested',
      v_admins,
      'Tontine Digitale : nouvelle demande de retrait de ' || v_amount || ' (' || v_method
        || ') a valider. Ref ' || substr(new.id::text,1,8) || '. Ouvrez le back-office.',
      new.group_id
    );
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    if new.status::text = 'processing' then
      perform public.enqueue_generic_sms(
        'withdrawal_processing',
        array[new.user_id],
        'Tontine Digitale : votre retrait de ' || v_amount || ' est en cours de traitement. Ref '
          || substr(new.id::text,1,8) || '.',
        new.group_id
      );
    elsif new.status::text = 'paid' then
      perform public.enqueue_generic_sms(
        'withdrawal_paid',
        array[new.user_id],
        'Tontine Digitale : votre retrait de ' || v_amount || ' (' || v_method
          || ') a ete verse avec succes. Ref ' || substr(new.id::text,1,8) || '.',
        new.group_id
      );
    elsif new.status::text = 'failed' then
      perform public.enqueue_generic_sms(
        'withdrawal_failed',
        array[new.user_id],
        'Tontine Digitale : votre retrait de ' || v_amount || ' a echoue. ' ||
          coalesce(nullif(new.notes,''), 'Contactez le support.') || ' Ref ' || substr(new.id::text,1,8) || '.',
        new.group_id
      );
    elsif new.status::text = 'cancelled' then
      perform public.enqueue_generic_sms(
        'withdrawal_cancelled',
        array[new.user_id],
        'Tontine Digitale : votre demande de retrait de ' || v_amount || ' a ete annulee. Ref '
          || substr(new.id::text,1,8) || '.',
        new.group_id
      );
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists sms_withdrawal_lifecycle on public.withdrawal_requests;
create trigger sms_withdrawal_lifecycle
  after insert or update of status on public.withdrawal_requests
  for each row execute function public.trg_sms_withdrawal();

-- ============================================================
-- 2. Validations / refus de paiement par admin
-- ============================================================
create or replace function public.trg_sms_payment_admin_decision()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_amount text := public.fmt_gnf(new.amount);
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status::text = 'confirmed' and old.status::text in ('pending','processing','submitted') then
      perform public.enqueue_generic_sms(
        'payment_confirmed_by_admin',
        array[new.user_id],
        'Tontine Digitale : votre paiement de ' || v_amount || ' a ete valide par un administrateur. Merci.',
        new.group_id
      );
    elsif new.status::text = 'rejected' then
      perform public.enqueue_generic_sms(
        'payment_rejected_by_admin',
        array[new.user_id],
        'Tontine Digitale : votre paiement de ' || v_amount || ' a ete refuse. ' ||
          coalesce(nullif(new.error_message,''), 'Verifiez les informations et reessayez.'),
        new.group_id
      );
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists sms_payment_admin_decision on public.payments;
create trigger sms_payment_admin_decision
  after update of status on public.payments
  for each row execute function public.trg_sms_payment_admin_decision();

-- ============================================================
-- 3. Cycle : démarrage
-- ============================================================
create or replace function public.trg_sms_cycle_started()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_members uuid[];
  v_gname text;
begin
  select name into v_gname from public.groups where id = new.group_id;
  v_members := array(
    select user_id from public.group_members
     where group_id = new.group_id and status = 'active'
  );
  perform public.enqueue_generic_sms(
    'cycle_started',
    v_members,
    'Tontine Digitale : un nouveau cycle de la tontine "' || coalesce(v_gname,'') || '" demarre (cycle #'
      || new.cycle_number || '). Preparez votre premiere cotisation.',
    new.group_id
  );
  return new;
end; $$;

drop trigger if exists sms_cycle_started on public.cycles;
create trigger sms_cycle_started
  after insert on public.cycles
  for each row execute function public.trg_sms_cycle_started();

-- ============================================================
-- 4. Groupe : pause / reprise
-- ============================================================
create or replace function public.trg_sms_group_pause_resume()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_members uuid[];
begin
  if old.paused_at is null and new.paused_at is not null then
    v_members := array(select user_id from public.group_members where group_id = new.id and status = 'active');
    perform public.enqueue_generic_sms(
      'cycle_paused',
      v_members,
      'Tontine Digitale : le groupe "' || new.name || '" est mis en pause. ' ||
        coalesce(nullif(new.paused_reason,''), 'Les cotisations sont suspendues jusqu''a reprise.'),
      new.id
    );
  elsif old.paused_at is not null and new.paused_at is null then
    v_members := array(select user_id from public.group_members where group_id = new.id and status = 'active');
    perform public.enqueue_generic_sms(
      'cycle_resumed',
      v_members,
      'Tontine Digitale : le groupe "' || new.name || '" reprend ses activites. Les cotisations redemarrent.',
      new.id
    );
  end if;
  return new;
end; $$;

drop trigger if exists sms_group_pause_resume on public.groups;
create trigger sms_group_pause_resume
  after update of paused_at on public.groups
  for each row execute function public.trg_sms_group_pause_resume();

-- ============================================================
-- 5. Membres : suspendu / réactivé / exclu
-- ============================================================
create or replace function public.trg_sms_member_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_gname text;
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    select name into v_gname from public.groups where id = new.group_id;
    if new.status::text = 'suspended' then
      perform public.enqueue_generic_sms(
        'member_suspended',
        array[new.user_id],
        'Tontine Digitale : votre compte est suspendu dans le groupe "' || coalesce(v_gname,'') || '". ' ||
          coalesce(nullif(new.suspended_reason,''), 'Contactez l''organisateur.'),
        new.group_id
      );
    elsif new.status::text = 'active' and old.status::text = 'suspended' then
      perform public.enqueue_generic_sms(
        'member_reactivated',
        array[new.user_id],
        'Tontine Digitale : votre compte a ete reactive dans le groupe "' || coalesce(v_gname,'') || '".',
        new.group_id
      );
    elsif new.status::text in ('removed','kicked') then
      perform public.enqueue_generic_sms(
        'member_kicked',
        array[new.user_id],
        'Tontine Digitale : vous avez ete retire du groupe "' || coalesce(v_gname,'') || '". ' ||
          coalesce(nullif(new.removed_reason,''), ''),
        new.group_id
      );
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists sms_member_status on public.group_members;
create trigger sms_member_status
  after update of status on public.group_members
  for each row execute function public.trg_sms_member_status();

-- ============================================================
-- 6. Demande de pause de paiement : décision
-- ============================================================
create or replace function public.trg_sms_pause_request_decision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status::text = 'approved' then
      perform public.enqueue_generic_sms(
        'payment_pause_request_approved',
        array[new.requested_by],
        'Tontine Digitale : votre demande de pause de paiement a ete acceptee. ' ||
          coalesce(nullif(new.decision_reason,''), ''),
        new.group_id
      );
    elsif new.status::text = 'rejected' then
      perform public.enqueue_generic_sms(
        'payment_pause_request_rejected',
        array[new.requested_by],
        'Tontine Digitale : votre demande de pause a ete refusee. ' ||
          coalesce(nullif(new.decision_reason,''), 'Contactez l''organisateur.'),
        new.group_id
      );
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists sms_pause_request_decision on public.payment_pause_requests;
create trigger sms_pause_request_decision
  after update of status on public.payment_pause_requests
  for each row execute function public.trg_sms_pause_request_decision();

-- ============================================================
-- 7. Litiges
-- ============================================================
create or replace function public.trg_sms_dispute()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_organizer uuid;
begin
  select created_by into v_organizer from public.groups where id = new.group_id;
  if tg_op = 'INSERT' then
    perform public.enqueue_generic_sms(
      'dispute_raised',
      array[v_organizer],
      'Tontine Digitale : un nouveau litige a ete declare sur une cotisation. Ouvrez l''application pour repondre.',
      new.group_id
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'resolved' then
    perform public.enqueue_generic_sms(
      'dispute_resolved',
      array[new.raised_by],
      'Tontine Digitale : votre litige a ete resolu. ' || coalesce(nullif(new.organizer_response,''),''),
      new.group_id
    );
  end if;
  return new;
end; $$;

drop trigger if exists sms_dispute on public.contribution_disputes;
create trigger sms_dispute
  after insert or update of status on public.contribution_disputes
  for each row execute function public.trg_sms_dispute();

-- ============================================================
-- 8. Signalement défaut
-- ============================================================
create or replace function public.trg_sms_default_report()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_gname text;
begin
  select name into v_gname from public.groups where id = new.group_id;
  if tg_op = 'INSERT' then
    perform public.enqueue_generic_sms(
      'defaulter_reported',
      array[new.reported_user_id],
      'Tontine Digitale : un signalement de defaut vous concerne dans le groupe "' || coalesce(v_gname,'') ||
        '". Regularisez rapidement pour eviter la procedure.',
      new.group_id
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('resolved','dismissed') then
    perform public.enqueue_generic_sms(
      'defaulter_report_resolved',
      array[new.reported_user_id],
      'Tontine Digitale : le signalement vous concernant dans "' || coalesce(v_gname,'') || '" est cloture.',
      new.group_id
    );
  end if;
  return new;
end; $$;

drop trigger if exists sms_default_report on public.member_default_reports;
create trigger sms_default_report
  after insert or update of status on public.member_default_reports
  for each row execute function public.trg_sms_default_report();

-- ============================================================
-- 9. Suppression de groupe
-- ============================================================
create or replace function public.trg_sms_group_deletion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_members uuid[];
  v_gname text;
begin
  select name into v_gname from public.groups where id = new.group_id;
  v_members := array(select user_id from public.group_members where group_id = new.group_id and status = 'active');
  if tg_op = 'INSERT' then
    perform public.enqueue_generic_sms(
      'group_deletion_requested',
      v_members,
      'Tontine Digitale : une demande de suppression du groupe "' || coalesce(v_gname,'') ||
        '" a ete lancee. Votez depuis l''application avant la date limite.',
      new.group_id
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status::text = 'pending_admin' then
      perform public.enqueue_generic_sms(
        'group_deletion_pending_admin',
        v_members,
        'Tontine Digitale : la suppression de "' || coalesce(v_gname,'') ||
          '" est soumise a validation de la plateforme.',
        new.group_id
      );
    elsif new.status::text = 'approved' then
      perform public.enqueue_generic_sms(
        'group_deletion_approved',
        v_members,
        'Tontine Digitale : la suppression du groupe "' || coalesce(v_gname,'') || '" a ete validee.',
        new.group_id
      );
    elsif new.status::text in ('refused','rejected') then
      perform public.enqueue_generic_sms(
        'group_deletion_refused',
        v_members,
        'Tontine Digitale : la suppression du groupe "' || coalesce(v_gname,'') || '" a ete refusee. ' ||
          coalesce(nullif(new.admin_decision_reason,''), ''),
        new.group_id
      );
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists sms_group_deletion on public.group_deletion_requests;
create trigger sms_group_deletion
  after insert or update of status on public.group_deletion_requests
  for each row execute function public.trg_sms_group_deletion();

-- ============================================================
-- 10. Préférences par défaut : SMS ON pour les types critiques
-- ============================================================
create or replace function public.seed_notification_preferences(_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  k public.notification_kind;
  email_default boolean;
  sms_default boolean;
  sms_critical text[] := array[
    'contribution_late','contribution_confirmed','contribution_due',
    'payout_released','payout_hold_extended',
    'turn_paid','turn_started','cycle_started','cycle_paused','cycle_resumed',
    'cycle_completed','due_date_shifted',
    'withdrawal_requested','withdrawal_processing','withdrawal_paid',
    'withdrawal_failed','withdrawal_cancelled',
    'payment_confirmed_by_admin','payment_rejected_by_admin',
    'penalty_adjusted','penalty_waived',
    'member_suspended','member_kicked','member_reactivated',
    'ownership_transferred',
    'payment_pause_request_approved','payment_pause_request_rejected',
    'dispute_raised','dispute_resolved',
    'defaulter_reported','defaulter_report_resolved',
    'group_deletion_requested','group_deletion_pending_admin',
    'group_deletion_approved','group_deletion_refused'
  ];
begin
  for k in select unnest(enum_range(null::public.notification_kind)) loop
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'in_app', true)
    on conflict do nothing;
    email_default := (k::text <> 'system');
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'email', email_default)
    on conflict do nothing;
    sms_default := (k::text = ANY (sms_critical));
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'sms', sms_default)
    on conflict do nothing;
  end loop;
end; $$;

-- Helper should_notify : défaut SMS = true pour les types critiques
create or replace function public.should_notify(
  _user_id uuid,
  _type public.notification_kind,
  _channel public.notification_channel
) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select enabled from public.notification_preferences
      where user_id = _user_id and notif_type = _type and channel = _channel),
    case
      when _channel = 'sms' and _type::text = ANY (array[
        'contribution_late','contribution_confirmed','contribution_due',
        'payout_released','payout_hold_extended',
        'turn_paid','turn_started','cycle_started','cycle_paused','cycle_resumed',
        'cycle_completed','due_date_shifted',
        'withdrawal_requested','withdrawal_processing','withdrawal_paid',
        'withdrawal_failed','withdrawal_cancelled',
        'payment_confirmed_by_admin','payment_rejected_by_admin',
        'penalty_adjusted','penalty_waived',
        'member_suspended','member_kicked','member_reactivated',
        'ownership_transferred',
        'payment_pause_request_approved','payment_pause_request_rejected',
        'dispute_raised','dispute_resolved',
        'defaulter_reported','defaulter_report_resolved',
        'group_deletion_requested','group_deletion_pending_admin',
        'group_deletion_approved','group_deletion_refused'
      ]) then true
      when _channel = 'sms' then false
      else true
    end
  );
$$;
