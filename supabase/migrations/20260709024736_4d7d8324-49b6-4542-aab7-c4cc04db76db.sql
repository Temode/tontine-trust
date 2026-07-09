
-- Trigger d'enqueue: chaque notification -> email si l'utilisateur l'autorise
CREATE OR REPLACE FUNCTION public.enqueue_email_for_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_name text;
  v_email_enabled boolean;
  v_subject text;
  v_link text;
  v_html text;
  v_text text;
  v_body text;
BEGIN
  -- Récupérer email + nom
  SELECT au.email, coalesce(p.full_name, split_part(au.email, '@', 1))
    INTO v_email, v_name
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
   WHERE au.id = NEW.user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  -- Préférence email pour ce type de notif (défaut = activé)
  SELECT enabled INTO v_email_enabled
    FROM public.notification_preferences
   WHERE user_id = NEW.user_id
     AND notif_type = NEW.kind
     AND channel = 'email';

  IF v_email_enabled IS NOT NULL AND v_email_enabled = false THEN
    RETURN NEW;
  END IF;

  v_body := coalesce(NEW.body, '');
  v_subject := NEW.title;
  v_link := CASE
    WHEN NEW.link IS NULL OR NEW.link = '' THEN 'https://tontinedigitale.com'
    WHEN NEW.link LIKE 'http%' THEN NEW.link
    ELSE 'https://tontinedigitale.com' || NEW.link
  END;

  v_text := 'Bonjour ' || v_name || E',\n\n' || v_subject ||
            CASE WHEN v_body <> '' THEN E'\n\n' || v_body ELSE '' END ||
            E'\n\nOuvrir dans l''app : ' || v_link ||
            E'\n\n— L''équipe Tontine Digitale';

  v_html := format($html$
<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>%s</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 12px;"><tr><td align="center">
<table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFF;border-radius:12px;border-top:4px solid #0D7377;box-shadow:0 1px 3px rgba(15,23,42,.06);">
<tr><td style="padding:28px 28px 8px 28px;">
<div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:#0D7377;text-transform:uppercase;">Tontine Digitale</div>
<h1 style="margin:8px 0 0 0;font-size:20px;line-height:1.35;color:#0F172A;">%s</h1>
</td></tr>
<tr><td style="padding:12px 28px 8px 28px;font-size:15px;line-height:1.6;color:#0F172A;">
<p>Bonjour %s,</p>%s
</td></tr>
<tr><td align="center" style="padding:24px 0 8px 0;"><a href="%s" style="background:#0D7377;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">Ouvrir dans l'app</a></td></tr>
<tr><td style="padding:24px 28px 28px 28px;border-top:1px solid #E2E8F0;font-size:12px;color:#475569;">
L'équipe Tontine Digitale — <a href="mailto:support@tontinedigitale.com" style="color:#0D7377;text-decoration:none;">support@tontinedigitale.com</a>
</td></tr>
</table></td></tr></table></body></html>$html$,
    v_subject,
    v_subject,
    v_name,
    CASE WHEN v_body <> '' THEN '<p>' || replace(v_body, E'\n', '<br>') || '</p>' ELSE '' END,
    v_link
  );

  INSERT INTO public.email_outbox (kind, payload, dedupe_key)
  VALUES (
    'notification',
    jsonb_build_object(
      'to', v_email,
      'subject', v_subject,
      'html', v_html,
      'text', v_text,
      'notification_id', NEW.id,
      'notification_kind', NEW.kind::text,
      'user_id', NEW.user_id
    ),
    'notif:' || NEW.id::text
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la création d'une notification si l'enqueue email échoue
  RAISE WARNING 'enqueue_email_for_notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_enqueue_email ON public.notifications;
CREATE TRIGGER notifications_enqueue_email
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.enqueue_email_for_notification();

-- Planification du worker email toutes les minutes
DO $$
DECLARE v_jobid int;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'tontine_consume_email_outbox';
    IF v_jobid IS NOT NULL THEN
      PERFORM cron.unschedule(v_jobid);
    END IF;
    PERFORM cron.schedule(
      'tontine_consume_email_outbox',
      '* * * * *',
      $cmd$
        SELECT net.http_post(
          url := 'https://oljyzmannzejtsbfpzxp.supabase.co/functions/v1/consume-email-outbox',
          headers := jsonb_build_object('Content-Type','application/json'),
          body := '{}'::jsonb
        );
      $cmd$
    );
  END IF;
END $$;
