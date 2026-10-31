-- ============================================================
-- Marketing campaigns engine (SMS + Email)
-- ============================================================

create table if not exists public.marketing_settings (
  id boolean primary key default true check (id),
  global_enabled boolean not null default true,
  sms_unit_cost_gnf integer not null default 100,
  daily_budget_gnf integer not null default 500000,
  monthly_budget_gnf integer not null default 5000000,
  quiet_start_hour integer not null default 8,
  quiet_end_hour integer not null default 20,
  max_sms_per_user_30d integer not null default 2,
  updated_at timestamptz not null default now()
);
grant select on public.marketing_settings to authenticated;
grant all on public.marketing_settings to service_role;
alter table public.marketing_settings enable row level security;
create policy "marketing_settings_admin_all" on public.marketing_settings
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

insert into public.marketing_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text,
  segment text not null,
  trigger_delay_days integer not null default 0,
  repeat_days integer not null default 30,
  sms_enabled boolean not null default true,
  email_enabled boolean not null default true,
  per_user_cap integer not null default 1,
  cap_period_days integer not null default 30,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.marketing_campaigns to authenticated;
grant all on public.marketing_campaigns to service_role;
alter table public.marketing_campaigns enable row level security;
create policy "marketing_campaigns_admin_all" on public.marketing_campaigns
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create table if not exists public.marketing_campaign_contents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  channel text not null check (channel in ('sms','email')),
  subject text,
  body text not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  unique (campaign_id, channel)
);
grant select on public.marketing_campaign_contents to authenticated;
grant all on public.marketing_campaign_contents to service_role;
alter table public.marketing_campaign_contents enable row level security;
create policy "marketing_contents_admin_all" on public.marketing_campaign_contents
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create table if not exists public.marketing_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_code text not null,
  channel text not null check (channel in ('sms','email')),
  user_id uuid not null,
  dedupe_key text not null unique,
  status text not null default 'queued',
  cost_gnf integer not null default 0,
  rendered_body text,
  clicked_at timestamptz,
  converted_at timestamptz,
  conversion_type text,
  created_at timestamptz not null default now()
);
create index if not exists idx_marketing_sends_user on public.marketing_sends(user_id, created_at desc);
create index if not exists idx_marketing_sends_campaign on public.marketing_sends(campaign_code, created_at desc);
grant select on public.marketing_sends to authenticated;
grant all on public.marketing_sends to service_role;
alter table public.marketing_sends enable row level security;
create policy "marketing_sends_admin_read" on public.marketing_sends
  for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

create table if not exists public.marketing_optouts (
  user_id uuid not null,
  channel text not null check (channel in ('sms','email')),
  created_at timestamptz not null default now(),
  primary key (user_id, channel)
);
grant select, insert, delete on public.marketing_optouts to authenticated;
grant all on public.marketing_optouts to service_role;
alter table public.marketing_optouts enable row level security;
create policy "marketing_optouts_own" on public.marketing_optouts
  for all to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

-- ============================================================
-- Rendering helper
-- ============================================================
create or replace function public.render_marketing_template(_tpl text, _vars jsonb)
returns text language plpgsql immutable set search_path = public as $$
declare k text; v text; out text := coalesce(_tpl, '');
begin
  if _vars is null then return out; end if;
  for k, v in select key, coalesce(value #>> '{}', '') from jsonb_each(_vars) loop
    out := replace(out, '{' || k || '}', v);
  end loop;
  return out;
end; $$;

-- ============================================================
-- Core enqueue
-- ============================================================
create or replace function public.enqueue_marketing_message(
  _code text,
  _channel text,
  _user_id uuid,
  _vars jsonb default '{}'::jsonb,
  _dedupe_suffix text default null
)
returns text language plpgsql security definer set search_path = public as $$
declare
  s public.marketing_settings;
  c public.marketing_campaigns;
  ct public.marketing_campaign_contents;
  v_dedupe text;
  v_body text;
  v_subject text;
  v_email text;
  v_name text;
  v_hour int;
  v_spent_day int;
  v_spent_month int;
  v_recent int;
  v_global int;
  v_send_id uuid;
  v_vars jsonb;
begin
  select * into s from public.marketing_settings where id;
  if not found or not s.global_enabled then return 'global_off'; end if;

  select * into c from public.marketing_campaigns where code = _code;
  if not found or not c.is_active then return 'campaign_off'; end if;
  if _channel = 'sms' and not c.sms_enabled then return 'channel_off'; end if;
  if _channel = 'email' and not c.email_enabled then return 'channel_off'; end if;

  if exists (select 1 from public.marketing_optouts where user_id = _user_id and channel = _channel) then
    return 'opted_out';
  end if;

  v_dedupe := 'mkt:' || _code || ':' || _channel || ':' || _user_id::text || ':'
              || coalesce(_dedupe_suffix, to_char(now(), 'YYYY-MM-DD'));
  if exists (select 1 from public.marketing_sends where dedupe_key = v_dedupe) then
    return 'duplicate';
  end if;

  -- Per-campaign cap
  select count(*) into v_recent from public.marketing_sends
   where user_id = _user_id and campaign_code = _code and channel = _channel
     and created_at > now() - make_interval(days => c.cap_period_days);
  if v_recent >= c.per_user_cap then return 'campaign_cap'; end if;

  select subject, body into v_subject, v_body
    from public.marketing_campaign_contents
   where campaign_id = c.id and channel = _channel;
  if v_body is null or length(trim(v_body)) = 0 then return 'no_content'; end if;

  select au.email, coalesce(p.full_name, split_part(au.email, '@', 1))
    into v_email, v_name
    from auth.users au left join public.profiles p on p.id = au.id
   where au.id = _user_id;

  v_vars := coalesce(_vars, '{}'::jsonb)
            || jsonb_build_object('prenom', split_part(coalesce(v_name, ''), ' ', 1));
  v_body := public.render_marketing_template(v_body, v_vars);
  v_subject := public.render_marketing_template(coalesce(v_subject, 'Tontine Digitale'), v_vars);

  if _channel = 'sms' then
    -- Quiet hours (Conakry = UTC)
    v_hour := extract(hour from (now() at time zone 'UTC'))::int;
    if v_hour < s.quiet_start_hour or v_hour >= s.quiet_end_hour then return 'quiet_hours'; end if;

    -- Global per-user marketing SMS cap over 30 days
    select count(*) into v_global from public.marketing_sends
     where user_id = _user_id and channel = 'sms' and created_at > now() - interval '30 days';
    if v_global >= s.max_sms_per_user_30d then return 'user_cap'; end if;

    -- Budget
    select coalesce(sum(cost_gnf), 0) into v_spent_day from public.marketing_sends
     where channel = 'sms' and created_at >= date_trunc('day', now());
    if v_spent_day + s.sms_unit_cost_gnf > s.daily_budget_gnf then return 'budget_day'; end if;
    select coalesce(sum(cost_gnf), 0) into v_spent_month from public.marketing_sends
     where channel = 'sms' and created_at >= date_trunc('month', now());
    if v_spent_month + s.sms_unit_cost_gnf > s.monthly_budget_gnf then return 'budget_month'; end if;

    if not exists (select 1 from public.profiles where id = _user_id and coalesce(phone_number,'') <> '') then
      return 'no_phone';
    end if;

    insert into public.marketing_sends (campaign_code, channel, user_id, dedupe_key, status, cost_gnf, rendered_body)
    values (_code, 'sms', _user_id, v_dedupe, 'queued', s.sms_unit_cost_gnf, v_body)
    returning id into v_send_id;

    insert into public.sms_outbox (kind, payload, dedupe_key)
    values (
      'generic_broadcast',
      jsonb_build_object(
        'sms_kind', 'marketing_' || _code,
        'recipients', jsonb_build_array(_user_id),
        'body', v_body,
        'group_id', null,
        'turn_id', null
      ),
      v_dedupe
    ) on conflict (dedupe_key) do nothing;

    return 'queued';
  else
    if v_email is null or v_email = '' then return 'no_email'; end if;

    insert into public.marketing_sends (campaign_code, channel, user_id, dedupe_key, status, cost_gnf, rendered_body)
    values (_code, 'email', _user_id, v_dedupe, 'queued', 0, v_body)
    returning id into v_send_id;

    insert into public.email_outbox (kind, payload, dedupe_key)
    values (
      'notification',
      jsonb_build_object(
        'to', v_email,
        'subject', v_subject,
        'text', v_body,
        'html', '<div style="font-family:Arial,sans-serif;color:#0F172A;font-size:15px;line-height:1.6">'
                || replace(v_body, E'\n', '<br/>')
                || '<p style="font-size:12px;color:#64748B;margin-top:24px">Tontine Digitale — vous pouvez désactiver ces messages dans vos préférences de notification.</p></div>'
      ),
      v_dedupe
    ) on conflict (dedupe_key) do nothing;

    return 'queued';
  end if;
end; $$;

grant execute on function public.enqueue_marketing_message(text, text, uuid, jsonb, text) to service_role;

-- ============================================================
-- Lifecycle evaluation (daily cron)
-- ============================================================
create or replace function public.enqueue_lifecycle_campaigns()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  r record;
  ch text;
begin
  -- 1) Wallet vide / faible pour utilisateurs actifs
  for r in
    select distinct gm.user_id, coalesce(w.balance_remaining, 0) as bal
      from public.group_members gm
      join public.groups g on g.id = gm.group_id
      left join public.sms_wallets w on w.user_id = gm.user_id
     where gm.status = 'active' and g.status in ('active','open')
  loop
    foreach ch in array array['sms','email'] loop
      if r.bal = 0 then
        if public.enqueue_marketing_message('sms_wallet_empty_relance', ch, r.user_id,
             '{}'::jsonb, to_char(now(), 'IYYY-IW')) = 'queued' then v_count := v_count + 1; end if;
      elsif r.bal < 5 then
        if public.enqueue_marketing_message('sms_wallet_low', ch, r.user_id,
             jsonb_build_object('solde', r.bal), to_char(now(), 'IYYY-IW')) = 'queued' then v_count := v_count + 1; end if;
      end if;
    end loop;
  end loop;

  -- 2) Plan gratuit avec au moins un groupe actif depuis 21 jours
  for r in
    select distinct gm.user_id
      from public.group_members gm
      join public.groups g on g.id = gm.group_id
     where gm.status = 'active'
       and g.status = 'active'
       and g.created_at < now() - interval '21 days'
       and not exists (
         select 1 from public.user_subscriptions us
          where us.user_id = gm.user_id
            and us.status in ('active','trialing')
            and us.plan_code in ('premium','business')
       )
  loop
    foreach ch in array array['sms','email'] loop
      if public.enqueue_marketing_message('sub_savings_value', ch, r.user_id,
           '{}'::jsonb, to_char(now(), 'YYYY-MM')) = 'queued' then v_count := v_count + 1; end if;
    end loop;
  end loop;

  -- 3) Organisateurs gratuits avec 2 groupes ou plus
  for r in
    select gm.user_id
      from public.group_members gm
     where gm.status = 'active' and gm.role = 'organisateur'
     group by gm.user_id
    having count(*) >= 2
  loop
    foreach ch in array array['sms','email'] loop
      if public.enqueue_marketing_message('sub_organizer', ch, r.user_id,
           '{}'::jsonb, to_char(now(), 'YYYY-MM')) = 'queued' then v_count := v_count + 1; end if;
    end loop;
  end loop;

  -- 4) Cycle terminé récemment : proposer une relance
  for r in
    select distinct gm.user_id, g.name as group_name
      from public.cycles cy
      join public.groups g on g.id = cy.group_id
      join public.group_members gm on gm.group_id = g.id and gm.status = 'active'
     where cy.status = 'completed'
       and cy.updated_at between now() - interval '3 days' and now() - interval '1 day'
  loop
    foreach ch in array array['sms','email'] loop
      if public.enqueue_marketing_message('post_cycle_win', ch, r.user_id,
           jsonb_build_object('groupe', r.group_name), to_char(now(), 'YYYY-MM-DD')) = 'queued'
      then v_count := v_count + 1; end if;
    end loop;
  end loop;

  return v_count;
end; $$;

grant execute on function public.enqueue_lifecycle_campaigns() to service_role;

-- ============================================================
-- Admin RPCs
-- ============================================================
create or replace function public.admin_list_marketing_campaigns()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.has_role(auth.uid(), 'super_admin') then raise exception 'FORBIDDEN'; end if;
  select jsonb_agg(x order by x->>'priority', x->>'code') into v from (
    select jsonb_build_object(
      'id', c.id, 'code', c.code, 'label', c.label, 'description', c.description,
      'segment', c.segment, 'trigger_delay_days', c.trigger_delay_days,
      'repeat_days', c.repeat_days, 'sms_enabled', c.sms_enabled, 'email_enabled', c.email_enabled,
      'per_user_cap', c.per_user_cap, 'cap_period_days', c.cap_period_days,
      'priority', c.priority, 'is_active', c.is_active,
      'contents', coalesce((
        select jsonb_object_agg(ct.channel, jsonb_build_object('subject', ct.subject, 'body', ct.body))
          from public.marketing_campaign_contents ct where ct.campaign_id = c.id
      ), '{}'::jsonb),
      'stats', (
        select jsonb_build_object(
          'sent', count(*) filter (where ms.channel is not null),
          'sms', count(*) filter (where ms.channel = 'sms'),
          'email', count(*) filter (where ms.channel = 'email'),
          'clicks', count(*) filter (where ms.clicked_at is not null),
          'conversions', count(*) filter (where ms.converted_at is not null),
          'cost', coalesce(sum(ms.cost_gnf), 0)
        ) from public.marketing_sends ms where ms.campaign_code = c.code
      )
    ) as x
    from public.marketing_campaigns c
  ) t;
  return coalesce(v, '[]'::jsonb);
end; $$;

create or replace function public.admin_upsert_marketing_campaign(_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_role(auth.uid(), 'super_admin') then raise exception 'FORBIDDEN'; end if;
  insert into public.marketing_campaigns as c
    (code, label, description, segment, trigger_delay_days, repeat_days,
     sms_enabled, email_enabled, per_user_cap, cap_period_days, priority, is_active)
  values (
    _payload->>'code',
    coalesce(_payload->>'label', _payload->>'code'),
    _payload->>'description',
    coalesce(_payload->>'segment', 'custom'),
    coalesce((_payload->>'trigger_delay_days')::int, 0),
    coalesce((_payload->>'repeat_days')::int, 30),
    coalesce((_payload->>'sms_enabled')::boolean, true),
    coalesce((_payload->>'email_enabled')::boolean, true),
    coalesce((_payload->>'per_user_cap')::int, 1),
    coalesce((_payload->>'cap_period_days')::int, 30),
    coalesce((_payload->>'priority')::int, 100),
    coalesce((_payload->>'is_active')::boolean, true)
  )
  on conflict (code) do update set
    label = excluded.label,
    description = excluded.description,
    segment = excluded.segment,
    trigger_delay_days = excluded.trigger_delay_days,
    repeat_days = excluded.repeat_days,
    sms_enabled = excluded.sms_enabled,
    email_enabled = excluded.email_enabled,
    per_user_cap = excluded.per_user_cap,
    cap_period_days = excluded.cap_period_days,
    priority = excluded.priority,
    is_active = excluded.is_active,
    updated_at = now()
  returning c.id into v_id;
  return v_id;
end; $$;

create or replace function public.admin_upsert_campaign_content(
  _code text, _channel text, _subject text, _body text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_cid uuid; v_id uuid;
begin
  if not public.has_role(auth.uid(), 'super_admin') then raise exception 'FORBIDDEN'; end if;
  if _channel not in ('sms','email') then raise exception 'BAD_CHANNEL'; end if;
  select id into v_cid from public.marketing_campaigns where code = _code;
  if v_cid is null then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  insert into public.marketing_campaign_contents as ct (campaign_id, channel, subject, body)
  values (v_cid, _channel, _subject, _body)
  on conflict (campaign_id, channel) do update set
    subject = excluded.subject, body = excluded.body,
    version = ct.version + 1, updated_at = now()
  returning ct.id into v_id;
  return v_id;
end; $$;

create or replace function public.admin_toggle_campaign(_code text, _active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then raise exception 'FORBIDDEN'; end if;
  update public.marketing_campaigns set is_active = _active, updated_at = now() where code = _code;
end; $$;

create or replace function public.admin_marketing_settings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.marketing_settings; v_day int; v_month int;
begin
  if not public.has_role(auth.uid(), 'super_admin') then raise exception 'FORBIDDEN'; end if;
  select * into s from public.marketing_settings where id;
  select coalesce(sum(cost_gnf),0) into v_day from public.marketing_sends
    where channel='sms' and created_at >= date_trunc('day', now());
  select coalesce(sum(cost_gnf),0) into v_month from public.marketing_sends
    where channel='sms' and created_at >= date_trunc('month', now());
  return jsonb_build_object(
    'global_enabled', s.global_enabled,
    'sms_unit_cost_gnf', s.sms_unit_cost_gnf,
    'daily_budget_gnf', s.daily_budget_gnf,
    'monthly_budget_gnf', s.monthly_budget_gnf,
    'quiet_start_hour', s.quiet_start_hour,
    'quiet_end_hour', s.quiet_end_hour,
    'max_sms_per_user_30d', s.max_sms_per_user_30d,
    'spent_today', v_day,
    'spent_month', v_month
  );
end; $$;

create or replace function public.admin_update_marketing_settings(_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then raise exception 'FORBIDDEN'; end if;
  update public.marketing_settings set
    global_enabled = coalesce((_payload->>'global_enabled')::boolean, global_enabled),
    sms_unit_cost_gnf = coalesce((_payload->>'sms_unit_cost_gnf')::int, sms_unit_cost_gnf),
    daily_budget_gnf = coalesce((_payload->>'daily_budget_gnf')::int, daily_budget_gnf),
    monthly_budget_gnf = coalesce((_payload->>'monthly_budget_gnf')::int, monthly_budget_gnf),
    quiet_start_hour = coalesce((_payload->>'quiet_start_hour')::int, quiet_start_hour),
    quiet_end_hour = coalesce((_payload->>'quiet_end_hour')::int, quiet_end_hour),
    max_sms_per_user_30d = coalesce((_payload->>'max_sms_per_user_30d')::int, max_sms_per_user_30d),
    updated_at = now()
  where id;
end; $$;

create or replace function public.admin_list_marketing_sends(
  _campaign text default null, _channel text default null, _limit int default 100
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.has_role(auth.uid(), 'super_admin') then raise exception 'FORBIDDEN'; end if;
  select jsonb_agg(x) into v from (
    select jsonb_build_object(
      'id', ms.id, 'campaign_code', ms.campaign_code, 'channel', ms.channel,
      'user_id', ms.user_id, 'full_name', p.full_name, 'status', ms.status,
      'cost_gnf', ms.cost_gnf, 'body', ms.rendered_body,
      'clicked_at', ms.clicked_at, 'converted_at', ms.converted_at,
      'created_at', ms.created_at
    ) as x
    from public.marketing_sends ms
    left join public.profiles p on p.id = ms.user_id
    where (_campaign is null or ms.campaign_code = _campaign)
      and (_channel is null or ms.channel = _channel)
    order by ms.created_at desc
    limit greatest(1, least(_limit, 500))
  ) t;
  return coalesce(v, '[]'::jsonb);
end; $$;

create or replace function public.admin_send_campaign_test(_code text, _channel text)
returns text language plpgsql security definer set search_path = public as $$
declare v_res text;
begin
  if not public.has_role(auth.uid(), 'super_admin') then raise exception 'FORBIDDEN'; end if;
  v_res := public.enqueue_marketing_message(
    _code, _channel, auth.uid(), '{}'::jsonb,
    'test-' || to_char(now(), 'YYYYMMDDHH24MISS'));
  return v_res;
end; $$;

create or replace function public.track_marketing_click(_send_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.marketing_sends set clicked_at = coalesce(clicked_at, now()) where id = _send_id;
end; $$;

grant execute on function public.admin_list_marketing_campaigns() to authenticated;
grant execute on function public.admin_upsert_marketing_campaign(jsonb) to authenticated;
grant execute on function public.admin_upsert_campaign_content(text, text, text, text) to authenticated;
grant execute on function public.admin_toggle_campaign(text, boolean) to authenticated;
grant execute on function public.admin_marketing_settings() to authenticated;
grant execute on function public.admin_update_marketing_settings(jsonb) to authenticated;
grant execute on function public.admin_list_marketing_sends(text, text, int) to authenticated;
grant execute on function public.admin_send_campaign_test(text, text) to authenticated;
grant execute on function public.track_marketing_click(uuid) to anon, authenticated;

-- ============================================================
-- Seed catalogue
-- ============================================================
insert into public.marketing_campaigns (code, label, description, segment, trigger_delay_days, repeat_days, per_user_cap, cap_period_days, priority)
values
  ('sms_missed_event', 'Evenement manque (SMS non envoye)', 'Envoye quand une notification critique n''a pas pu partir en SMS.', 'critical_event_no_sms', 0, 30, 1, 30, 10),
  ('sms_wallet_low', 'Forfait SMS bientot epuise', 'Solde inferieur a 5 SMS.', 'wallet_low', 0, 7, 1, 7, 20),
  ('sms_wallet_empty_relance', 'Forfait SMS vide', 'Membre actif sans forfait SMS.', 'wallet_empty', 14, 30, 1, 30, 30),
  ('sub_savings_value', 'Valeur de l''epargne (Premium)', 'Plan gratuit avec groupe actif depuis 21 jours.', 'free_plan_active', 21, 60, 1, 60, 40),
  ('sub_organizer', 'Organisateur multi-groupes', 'Organisateur gratuit avec au moins 2 groupes.', 'free_organizer', 7, 60, 1, 60, 50),
  ('reactivation', 'Reactivation', 'Aucune connexion depuis 30 jours.', 'inactive_30d', 30, 60, 1, 60, 60),
  ('post_cycle_win', 'Cycle reussi : relancer', 'Cycle termine il y a 2 jours.', 'cycle_completed', 2, 30, 1, 30, 70)
on conflict (code) do nothing;

insert into public.marketing_campaign_contents (campaign_id, channel, subject, body)
select c.id, 'sms', null, v.sms from public.marketing_campaigns c
join (values
  ('sms_missed_event', 'Tontine Digitale: une action importante vous attend dans vos tontines. Activez vos SMS pour ne rien rater: tontinedigitale.com/sms'),
  ('sms_wallet_low', 'Tontine Digitale: il vous reste {solde} SMS. Rechargez maintenant pour rester informe de vos cotisations et versements: tontinedigitale.com/sms'),
  ('sms_wallet_empty_relance', 'Tontine Digitale: sans forfait SMS vous ratez les rappels de cotisation et les demandes de vos groupes. Pack des 5000 GNF: tontinedigitale.com/sms'),
  ('sub_savings_value', 'Tontine Digitale: passez a Premium pour epargner plus vite, suivre vos gains et automatiser vos rappels: tontinedigitale.com/abonnement'),
  ('sub_organizer', 'Tontine Digitale: vous gerez plusieurs tontines. Premium vous donne rappels automatiques et suivi consolide: tontinedigitale.com/abonnement'),
  ('reactivation', 'Tontine Digitale: vos tontines vous attendent. Reprenez votre epargne en 1 minute: tontinedigitale.com'),
  ('post_cycle_win', 'Tontine Digitale: bravo, votre cycle {groupe} est termine. Relancez un nouveau cycle avec vos membres: tontinedigitale.com')
) as v(code, sms) on v.code = c.code
on conflict (campaign_id, channel) do nothing;

insert into public.marketing_campaign_contents (campaign_id, channel, subject, body)
select c.id, 'email', v.subject, v.body from public.marketing_campaigns c
join (values
  ('sms_missed_event', 'Vous risquez de rater des informations importantes',
   E'Bonjour {prenom},\n\nUne action importante vient d''avoir lieu dans l''une de vos tontines. Sans forfait SMS, vous ne recevez ces alertes que par email et dans l''application.\n\nActivez vos SMS pour être prévenu immédiatement : https://tontinedigitale.com/sms\n\nL''équipe Tontine Digitale'),
  ('sms_wallet_low', 'Votre forfait SMS est presque épuisé',
   E'Bonjour {prenom},\n\nIl vous reste {solde} SMS. Rechargez pour continuer à recevoir vos rappels de cotisation et vos confirmations de versement.\n\nRecharger : https://tontinedigitale.com/sms\n\nL''équipe Tontine Digitale'),
  ('sms_wallet_empty_relance', 'Restez informé de vos tontines par SMS',
   E'Bonjour {prenom},\n\nVotre forfait SMS est vide. Les rappels de cotisation, les demandes de démarrage de cycle et les versements ne vous parviennent plus par SMS.\n\nActiver un pack : https://tontinedigitale.com/sms\n\nL''équipe Tontine Digitale'),
  ('sub_savings_value', 'Épargnez plus sereinement avec Premium',
   E'Bonjour {prenom},\n\nVotre tontine tourne. Premium ajoute les rappels automatiques, le suivi consolidé de votre épargne, des groupes plus grands et un score de fiabilité renforcé.\n\nDécouvrir : https://tontinedigitale.com/abonnement\n\nL''équipe Tontine Digitale'),
  ('sub_organizer', 'Gérez toutes vos tontines depuis un seul tableau de bord',
   E'Bonjour {prenom},\n\nVous organisez plusieurs tontines. Premium vous fait gagner du temps : rappels automatiques, relances de cycle, suivi consolidé et export comptable.\n\nDécouvrir : https://tontinedigitale.com/abonnement\n\nL''équipe Tontine Digitale'),
  ('reactivation', 'Vos tontines vous attendent',
   E'Bonjour {prenom},\n\nCela fait un moment que nous ne vous avons pas vu. Reprenez votre épargne en quelques secondes.\n\nSe reconnecter : https://tontinedigitale.com\n\nL''équipe Tontine Digitale'),
  ('post_cycle_win', 'Bravo, votre cycle est terminé',
   E'Bonjour {prenom},\n\nLe cycle de {groupe} vient de se terminer avec succès. C''est le meilleur moment pour relancer un nouveau cycle avec les mêmes membres.\n\nRelancer : https://tontinedigitale.com\n\nL''équipe Tontine Digitale')
) as v(code, subject, body) on v.code = c.code
on conflict (campaign_id, channel) do nothing;

-- ============================================================
-- Cron quotidien 09:00 UTC (Conakry)
-- ============================================================
do $$
declare v_jobid int;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_jobid from cron.job where jobname = 'tontine_lifecycle_campaigns';
    if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
    perform cron.schedule('tontine_lifecycle_campaigns', '0 9 * * *',
      $cron$ select public.enqueue_lifecycle_campaigns(); $cron$);
  end if;
end $$;