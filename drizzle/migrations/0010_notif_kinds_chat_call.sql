ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'chat_message';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'call_incoming';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'call_missed';