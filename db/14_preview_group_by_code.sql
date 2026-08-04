-- =====================================================================
-- Aperçu lecture seule d'un groupe depuis un code d'invitation.
-- Utilisé par le JoinFlow pour afficher le contrat avant adhésion.
-- Aucun effet de bord (pas d'incrément, pas de rate-limit).
-- =====================================================================

create or replace function public.preview_group_by_code(_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations%rowtype;
  v_group public.groups%rowtype;
  v_count int;
  v_organizer text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_invitation from public.invitations where code = _code;
  if not found then
    raise exception 'INVITATION_NOT_FOUND';
  end if;
  if v_invitation.status <> 'pending' then
    raise exception 'INVITATION_INACTIVE';
  end if;
  if v_invitation.expires_at is not null and v_invitation.expires_at < now() then
    raise exception 'INVITATION_EXPIRED';
  end if;

  select * into v_group from public.groups where id = v_invitation.group_id;

  select count(*) into v_count from public.group_members
    where group_id = v_group.id and status = 'active';

  select coalesce(p.full_name, 'Organisateur') into v_organizer
    from public.profiles p where p.id = v_group.created_by;

  return jsonb_build_object(
    'name', v_group.name,
    'description', v_group.description,
    'category', v_group.category,
    'contribution_amount', v_group.contribution_amount,
    'frequency', v_group.frequency,
    'max_members', v_group.max_members,
    'members_count', v_count,
    'visibility', v_group.visibility,
    'organizer_name', v_organizer
  );
end; $$;

grant execute on function public.preview_group_by_code(text) to authenticated;