-- Test : reprise des emails en échec / figés dans public.email_outbox
begin;

-- 1) échec récupérable (403 domaine) → repris par email_outbox_pop
insert into public.email_outbox (kind, payload, dedupe_key, status, attempts, last_error, next_attempt_at)
values ('notification', '{"to":"a@test.local"}', 'test:retryable', 'failed', 2,
        '403:{"message":"domain is not verified"}', now() - interval '1 minute');

-- 2) échec définitif (422) → jamais repris
insert into public.email_outbox (kind, payload, dedupe_key, status, attempts, last_error, next_attempt_at)
values ('notification', '{"to":"bad"}', 'test:permanent', 'failed', 1,
        '422:{"message":"invalid recipient"}', now() - interval '1 minute');

-- 3) envoi figé depuis > 10 min → repris
insert into public.email_outbox (kind, payload, dedupe_key, status, attempts, locked_at)
values ('notification', '{"to":"c@test.local"}', 'test:stuck', 'processing', 1, now() - interval '30 minutes');

do $$
declare v_keys text[];
begin
  select array_agg(dedupe_key order by dedupe_key)
    into v_keys
    from public.email_outbox_pop(50)
   where dedupe_key like 'test:%';

  if not (v_keys @> array['test:retryable','test:stuck']) then
    raise exception 'échecs récupérables/figés non repris : %', v_keys;
  end if;
  if v_keys @> array['test:permanent'] then
    raise exception 'échec définitif repris à tort';
  end if;
end $$;

-- 4) mark() applique un backoff croissant
select public.email_outbox_mark(id, 'queued', '429:rate limited')
  from public.email_outbox where dedupe_key = 'test:retryable';

do $$
declare v_next timestamptz;
begin
  select next_attempt_at into v_next from public.email_outbox where dedupe_key = 'test:retryable';
  if v_next <= now() then raise exception 'backoff non appliqué'; end if;
end $$;

rollback;
