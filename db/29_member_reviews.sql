-- =====================================================================
-- Tontine Digital — P2.5 : avis post-cycle entre membres
-- À exécuter APRÈS db/28_turn_bids_auction.sql
-- Idempotent.
-- =====================================================================

do $$ begin
  alter type public.notification_kind add value if not exists 'review_received';
end $$;

insert into public.notification_preferences (user_id, notif_type, channel, enabled)
select p.id, 'review_received'::public.notification_kind, c.channel, true
from public.profiles p
cross join (values ('in_app'::public.notification_channel),
                   ('email'::public.notification_channel)) c(channel)
on conflict (user_id, notif_type, channel) do nothing;

create table if not exists public.member_reviews (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  reviewed_user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (cycle_id, reviewer_user_id, reviewed_user_id),
  check (reviewer_user_id <> reviewed_user_id)
);

create index if not exists member_reviews_reviewed_idx
  on public.member_reviews (reviewed_user_id);
create index if not exists member_reviews_group_idx
  on public.member_reviews (group_id);

grant select on public.member_reviews to authenticated;
grant all on public.member_reviews to service_role;

alter table public.member_reviews enable row level security;

drop policy if exists "reviews_select_group_members" on public.member_reviews;
create policy "reviews_select_group_members" on public.member_reviews
  for select to authenticated
  using (
    public.is_group_member(group_id, auth.uid())
    or public.is_group_organizer(group_id, auth.uid())
    or reviewed_user_id = auth.uid()
    or reviewer_user_id = auth.uid()
  );

drop policy if exists "reviews_no_direct_write" on public.member_reviews;
create policy "reviews_no_direct_write" on public.member_reviews
  for insert to authenticated with check (false);

-- RPC submit_review
create or replace function public.submit_review(
  _group_id uuid,
  _reviewed_user_id uuid,
  _rating int,
  _comment text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_group public.groups%rowtype;
  v_cycle_id uuid;
  v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if _rating < 1 or _rating > 5 then raise exception 'INVALID_RATING'; end if;
  if v_user = _reviewed_user_id then raise exception 'SELF_REVIEW_FORBIDDEN'; end if;

  select * into v_group from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if v_group.status <> 'completed' then raise exception 'CYCLE_NOT_COMPLETED'; end if;

  -- Dernier cycle du groupe
  select id into v_cycle_id from public.cycles
    where group_id = _group_id
    order by cycle_number desc
    limit 1;
  if v_cycle_id is null then raise exception 'NO_CYCLE'; end if;

  -- Reviewer et reviewed doivent avoir participé au cycle (au moins un tour ou contribution)
  if not exists (
    select 1 from public.turns t
      where t.cycle_id = v_cycle_id
        and t.beneficiary_user_id in (v_user, _reviewed_user_id)
    union
    select 1 from public.contributions c
      join public.turns t2 on t2.id = c.turn_id
      where t2.cycle_id = v_cycle_id
        and c.payer_user_id in (v_user, _reviewed_user_id)
  ) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  insert into public.member_reviews
    (group_id, cycle_id, reviewer_user_id, reviewed_user_id, rating, comment)
  values
    (_group_id, v_cycle_id, v_user, _reviewed_user_id, _rating, nullif(trim(coalesce(_comment,'')), ''))
  returning id into v_id;

  if public.should_notify(_reviewed_user_id, 'review_received', 'in_app') then
    perform public.notify(
      _reviewed_user_id, 'review_received',
      'Nouvel avis reçu',
      'Un membre vous a attribué ' || _rating || '/5 dans ' || coalesce(v_group.name,'votre groupe') || '.',
      _group_id, null, null,
      jsonb_build_object('rating', _rating)
    );
  end if;

  perform public.log_audit(
    _group_id, 'review.submit', 'member_review', v_id,
    jsonb_build_object('reviewed_user_id', _reviewed_user_id, 'rating', _rating)
  );

  return v_id;
end; $$;

grant execute on function public.submit_review(uuid, uuid, int, text) to authenticated;

-- Vues d'agrégation
create or replace view public.member_review_summary
with (security_invoker = true) as
select
  reviewed_user_id as user_id,
  group_id,
  round(avg(rating)::numeric, 2) as avg_rating,
  count(*)::int as reviews_count
from public.member_reviews
group by reviewed_user_id, group_id;

grant select on public.member_review_summary to authenticated;

create or replace view public.member_review_global
with (security_invoker = true) as
select
  reviewed_user_id as user_id,
  round(avg(rating)::numeric, 2) as avg_rating,
  count(*)::int as reviews_count
from public.member_reviews
group by reviewed_user_id;

grant select on public.member_review_global to authenticated;

-- Vue listant les avis donnés par l'utilisateur (pour savoir qui reste à noter)
create or replace view public.my_reviews_given
with (security_invoker = true) as
select id, group_id, cycle_id, reviewed_user_id, rating, comment, created_at
from public.member_reviews
where reviewer_user_id = auth.uid();

grant select on public.my_reviews_given to authenticated;