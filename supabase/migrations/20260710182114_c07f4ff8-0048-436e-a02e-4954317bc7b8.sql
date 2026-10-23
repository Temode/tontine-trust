
-- ============================================================================
-- M1 : Fondations v2 (abonnements, SMS payants, solo, international, business)
-- ============================================================================

-- Enums -----------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.subscription_plan_code AS ENUM ('free','premium','business');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active','trialing','past_due','cancelled','pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.group_kind AS ENUM ('collective','solo','business');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.solo_mode AS ENUM ('project','working_capital');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sms_order_status AS ENUM ('pending','paid','credited','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sms_ledger_reason AS ENUM ('purchase','consumption','admin_adjust','plan_grant','refund');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.referral_status AS ENUM ('pending','active','expired','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper updated_at trigger fn ------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============================================================================
-- 1. subscription_plans (+ history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  code           public.subscription_plan_code PRIMARY KEY,
  label          text NOT NULL,
  base_price     integer NOT NULL DEFAULT 0,           -- GNF
  sms_included   integer NOT NULL DEFAULT 0,
  limits         jsonb   NOT NULL DEFAULT '{}'::jsonb, -- {max_groups, max_members_per_group, max_solo, max_international, features:[]}
  tiers          jsonb   NOT NULL DEFAULT '{}'::jsonb, -- Premium modulable : paliers + prix additionnels
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable by all" ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "plans writable by super_admin" ON public.subscription_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.subscription_plan_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code     public.subscription_plan_code NOT NULL,
  changed_by    uuid REFERENCES auth.users(id),
  snapshot      jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plan_history TO authenticated;
GRANT ALL  ON public.subscription_plan_history TO service_role;
ALTER TABLE public.subscription_plan_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan history super admin" ON public.subscription_plan_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- ============================================================================
-- 2. user_subscriptions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code          public.subscription_plan_code NOT NULL DEFAULT 'free',
  tier_options       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {max_groups:5, max_members:15, solo:1, intl:3}
  price_monthly      integer NOT NULL DEFAULT 0,
  status             public.subscription_status NOT NULL DEFAULT 'active',
  current_period_end timestamptz,
  djomy_ref          text,
  cancelled_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_subs_active_uniq
  ON public.user_subscriptions(user_id) WHERE status IN ('active','trialing','past_due');
GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT ALL  ON public.user_subscriptions TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own subscription" ON public.user_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_user_subs_updated BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. sms_pricing
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sms_pricing (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_price     integer NOT NULL,                      -- GNF / SMS
  packs          jsonb   NOT NULL DEFAULT '[]'::jsonb,  -- [{id, qty, price, label}]
  effective_from timestamptz NOT NULL DEFAULT now(),
  is_active      boolean NOT NULL DEFAULT true,
  created_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sms_pricing TO anon, authenticated;
GRANT ALL  ON public.sms_pricing TO service_role;
ALTER TABLE public.sms_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms pricing readable" ON public.sms_pricing FOR SELECT USING (true);
CREATE POLICY "sms pricing writable super_admin" ON public.sms_pricing FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ============================================================================
-- 4. sms_wallets + sms_orders + sms_ledger
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sms_wallets (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_remaining integer NOT NULL DEFAULT 0,
  total_purchased   integer NOT NULL DEFAULT 0,
  total_consumed    integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sms_wallets TO authenticated;
GRANT ALL  ON public.sms_wallets TO service_role;
ALTER TABLE public.sms_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet owner reads" ON public.sms_wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_sms_wallet_updated BEFORE UPDATE ON public.sms_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.sms_orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id     uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  pack_id      text,
  qty          integer NOT NULL,
  unit_price   integer NOT NULL,
  amount       integer NOT NULL,
  status       public.sms_order_status NOT NULL DEFAULT 'pending',
  djomy_ref    text,
  admin_note   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sms_orders_user_idx  ON public.sms_orders(user_id);
CREATE INDEX IF NOT EXISTS sms_orders_status_idx ON public.sms_orders(status);
GRANT SELECT, INSERT ON public.sms_orders TO authenticated;
GRANT ALL  ON public.sms_orders TO service_role;
ALTER TABLE public.sms_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order owner reads"   ON public.sms_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "order owner inserts" ON public.sms_orders FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_sms_orders_updated BEFORE UPDATE ON public.sms_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.sms_ledger (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta      integer NOT NULL,     -- + purchase / - consumption
  reason     public.sms_ledger_reason NOT NULL,
  ref_id     uuid,                 -- order_id, notification_id, etc.
  metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sms_ledger_user_idx ON public.sms_ledger(user_id, created_at DESC);
GRANT SELECT ON public.sms_ledger TO authenticated;
GRANT ALL  ON public.sms_ledger TO service_role;
ALTER TABLE public.sms_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger owner reads" ON public.sms_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- ============================================================================
-- 5. Extensions groups + cycles
-- ============================================================================
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS kind public.group_kind NOT NULL DEFAULT 'collective',
  ADD COLUMN IF NOT EXISTS solo_mode public.solo_mode,
  ADD COLUMN IF NOT EXISTS solo_lock_until timestamptz,
  ADD COLUMN IF NOT EXISTS is_international boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coordinator_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS coordinator_commission_percent numeric(5,2) NOT NULL DEFAULT 0
    CHECK (coordinator_commission_percent >= 0 AND coordinator_commission_percent <= 100);

ALTER TABLE public.cycles
  ADD COLUMN IF NOT EXISTS awaiting_renewal boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.cycle_renewal_votes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id   uuid NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreed     boolean NOT NULL,
  voted_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.cycle_renewal_votes TO authenticated;
GRANT ALL  ON public.cycle_renewal_votes TO service_role;
ALTER TABLE public.cycle_renewal_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "renewal vote owner rw" ON public.cycle_renewal_votes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "renewal vote super admin read" ON public.cycle_renewal_votes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- ============================================================================
-- 6. Referrals + earnings
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code      text NOT NULL,
  commission_percent numeric(5,2) NOT NULL DEFAULT 10,
  status             public.referral_status NOT NULL DEFAULT 'pending',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_id)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals(referrer_id);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL  ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrer or referred read" ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_referrals_updated BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  period          text NOT NULL,          -- YYYY-MM
  amount          integer NOT NULL,
  paid            boolean NOT NULL DEFAULT false,
  paid_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_earnings_ref_idx ON public.referral_earnings(referrer_id, period);
GRANT SELECT ON public.referral_earnings TO authenticated;
GRANT ALL  ON public.referral_earnings TO service_role;
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "earning owner reads" ON public.referral_earnings FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- ============================================================================
-- 7. Seed plans + tarif SMS par défaut
-- ============================================================================
INSERT INTO public.subscription_plans (code, label, base_price, sms_included, limits, tiers) VALUES
  ('free', 'Free', 0, 0,
   '{"max_groups":2,"max_members_per_group":5,"max_solo":0,"max_international":0,"channels":["email","in_app"],"international_readonly":true}'::jsonb,
   '{}'::jsonb),
  ('premium', 'Premium', 5000, 100,
   '{"max_groups":8,"max_members_per_group":20,"max_solo":1,"max_international":6,"channels":["email","in_app","sms"]}'::jsonb,
   '{"min_price":5000,"max_price":20000,"options":[
      {"key":"max_groups","label":"Groupes actifs","min":2,"max":8,"price_step":1500,"base":2},
      {"key":"max_members_per_group","label":"Membres par groupe","min":5,"max":20,"price_step":500,"base":5},
      {"key":"max_solo","label":"Tontines Solo","min":0,"max":1,"price_step":2000,"base":0},
      {"key":"max_international","label":"Tontines Internationales","min":0,"max":6,"price_step":800,"base":0}
    ]}'::jsonb),
  ('business', 'Business', 50000, 200,
   '{"max_groups":-1,"max_members_per_group":-1,"max_solo":-1,"max_international":-1,"channels":["email","in_app","sms"],"features":["coordinator","affiliation"]}'::jsonb,
   '{}'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sms_pricing (unit_price, packs, is_active)
SELECT 150,
       '[{"id":"p50","qty":50,"price":7000,"label":"Pack 50 SMS"},
         {"id":"p200","qty":200,"price":25000,"label":"Pack 200 SMS"},
         {"id":"p500","qty":500,"price":55000,"label":"Pack 500 SMS"}]'::jsonb,
       true
WHERE NOT EXISTS (SELECT 1 FROM public.sms_pricing WHERE is_active);
