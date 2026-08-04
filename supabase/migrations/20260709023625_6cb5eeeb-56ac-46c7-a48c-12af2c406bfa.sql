
CREATE TABLE public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

GRANT ALL ON public.email_outbox TO service_role;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
-- Table interne : aucune policy pour anon/authenticated (service_role bypasse RLS).

CREATE INDEX idx_email_outbox_queued ON public.email_outbox(created_at) WHERE status = 'queued';

CREATE OR REPLACE FUNCTION public.email_outbox_pop(_limit integer DEFAULT 20)
RETURNS SETOF public.email_outbox
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  with cte as (
    select id from public.email_outbox
     where status = 'queued'
     order by created_at
     limit greatest(_limit, 1)
     for update skip locked
  )
  update public.email_outbox o
     set status = 'processing',
         attempts = attempts + 1
    from cte
   where o.id = cte.id
  returning o.*;
$$;

CREATE OR REPLACE FUNCTION public.email_outbox_mark(_id uuid, _status text, _error text DEFAULT NULL)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  update public.email_outbox
     set status = _status,
         last_error = _error,
         processed_at = now()
   where id = _id;
$$;

CREATE OR REPLACE FUNCTION public.email_outbox_recent_sent_count(_minutes integer DEFAULT 1)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select count(*)::int
    from public.email_outbox
   where status = 'sent'
     and processed_at >= now() - make_interval(mins => greatest(_minutes, 1));
$$;

CREATE OR REPLACE FUNCTION public.email_outbox_try_lock()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  select pg_try_advisory_lock(8731298731298732);
$$;

CREATE OR REPLACE FUNCTION public.email_outbox_unlock()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  select pg_advisory_unlock(8731298731298732);
$$;
