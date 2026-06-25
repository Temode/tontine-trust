
-- 1) enum values for new notifications
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'payment_pause_request_created';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'payment_pause_request_approved';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'payment_pause_request_rejected';
