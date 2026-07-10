ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'sms_wallet_credited';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'sms_order_paid';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'sms_order_failed';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'sms_order_cancelled';