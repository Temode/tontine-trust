
create extension if not exists pgcrypto with schema extensions;

do $$
declare r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'append_ledger',
        'release_payout',
        'record_mock_payment',
        'join_group_with_code',
        'apply_djomy_webhook'
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, extensions',
      r.nspname, r.proname, r.args
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
