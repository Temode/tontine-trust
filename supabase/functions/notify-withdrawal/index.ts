/**
 * notify-withdrawal — envoie email + SMS pour les événements retrait global.
 *   POST { event: "submitted"|"completed"|"rejected", id: uuid }
 *
 * - submitted: notifie l'utilisateur + tous les admins (role='admin'|'super_admin').
 * - completed: notifie uniquement l'utilisateur.
 * - rejected: notifie uniquement l'utilisateur avec le motif.
 *
 * Utilise Nimba pour les SMS, Resend (gateway Lovable) pour les emails.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendMessageBg } from "../_shared/nimbasms.ts";
import { EMAIL_FROM, EMAIL_REPLY_TO } from "../_shared/emailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (p: unknown, s = 200) =>
  new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

function fmtGNF(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")} GNF`;
}

const CHANNEL_LABEL: Record<string, string> = {
  mobile_money_om: "Orange Money",
  mobile_money_momo: "MTN MoMo",
  card: "Carte bancaire",
  bank_transfer: "Virement bancaire",
};

async function sendEmail(to: string[], subject: string, html: string): Promise<void> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    console.warn("[notify-withdrawal] email not configured, skipping");
    return;
  }
  const recipients = to.filter((x) => /.+@.+\..+/.test(x));
  if (recipients.length === 0) return;
  try {
    const resp = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: recipients,
        subject,
        html,
        reply_to: EMAIL_REPLY_TO,
      }),
    });
    if (!resp.ok) {
      console.error(`[notify-withdrawal] email ${resp.status}: ${await resp.text()}`);
    }
  } catch (e) {
    console.error("[notify-withdrawal] email exception", e);
  }
}

function wrapEmail(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f6f6;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e5e7eb">
      <h1 style="color:#0D7377;font-size:20px;margin:0 0 16px">${title}</h1>
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#6b7280;font-size:12px;margin:0">Tontine Digitale — cet email est automatique.</p>
    </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { event?: string; id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const event = body.event;
  const id = body.id;
  if (!event || !id) return json({ error: "event_and_id_required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Charge la demande + profil utilisateur
  const { data: wr, error: wrErr } = await supabase
    .from("user_withdrawal_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (wrErr || !wr) return json({ error: "withdrawal_not_found" }, 404);

  const { data: userAuth } = await supabase.auth.admin.getUserById(wr.user_id);
  const userEmail = userAuth?.user?.email ?? null;
  const { data: profile } = await supabase.from("profiles")
    .select("full_name, phone_number").eq("id", wr.user_id).maybeSingle();

  const amountLabel = fmtGNF(Number(wr.amount));
  const methodLabel = CHANNEL_LABEL[wr.payment_method] ?? wr.payment_method;
  const firstName = (profile?.full_name ?? "").split(/\s+/)[0] || "";

  if (event === "submitted") {
    // ── Utilisateur ────────────────────────────────────────
    const userSms =
      `Bonjour ${firstName}, votre demande de retrait de ${amountLabel} a bien ete prise en compte. ` +
      `Vos fonds seront transferes sous 48h maximum sur ${methodLabel}. Tontine Digitale.`;
    if (profile?.phone_number) {
      sendMessageBg({
        to: profile.phone_number, body: userSms,
        logContext: { kind: "withdrawal_submitted", triggeredBy: wr.user_id, userId: wr.user_id },
      });
    }
    if (userEmail) {
      await sendEmail([userEmail], "Demande de retrait reçue",
        wrapEmail("Demande de retrait reçue",
          `<p>Bonjour ${firstName || ""},</p>
           <p>Votre demande de retrait de <strong>${amountLabel}</strong> a bien été prise en compte.</p>
           <p>Vos fonds seront transférés <strong>sous 48h maximum</strong> sur votre <strong>${methodLabel}</strong>.</p>
           <p>Merci pour votre confiance.</p>`));
    }

    // ── Admins ─────────────────────────────────────────────
    const { data: adminRoles } = await supabase
      .from("user_roles").select("user_id").in("role", ["admin", "super_admin"]);
    const adminIds = (adminRoles ?? []).map((r) => r.user_id);
    if (adminIds.length > 0) {
      const { data: adminProfiles } = await supabase.from("profiles")
        .select("id, full_name, phone_number").in("id", adminIds);
      const adminEmails: string[] = [];
      for (const a of adminIds) {
        const { data: u } = await supabase.auth.admin.getUserById(a);
        if (u?.user?.email) adminEmails.push(u.user.email);
      }
      const adminSms =
        `Nouvelle demande de retrait en attente : ${amountLabel} via ${methodLabel}. ` +
        `Rendez-vous sur le backoffice pour la traiter. Tontine Digitale.`;
      for (const ap of adminProfiles ?? []) {
        if (ap.phone_number) {
          sendMessageBg({
            to: ap.phone_number, body: adminSms,
            logContext: { kind: "withdrawal_admin_alert", triggeredBy: wr.user_id, userId: ap.id },
          });
        }
      }
      if (adminEmails.length > 0) {
        await sendEmail(adminEmails, "Nouvelle demande de retrait en attente",
          wrapEmail("Nouvelle demande de retrait",
            `<p>Une nouvelle demande de retrait est en attente :</p>
             <ul>
               <li>Utilisateur : <strong>${profile?.full_name ?? wr.user_id}</strong></li>
               <li>Montant : <strong>${amountLabel}</strong></li>
               <li>Moyen de paiement : <strong>${methodLabel}</strong></li>
             </ul>
             <p><a href="https://tontinedigitale.com/admin/retraits" style="color:#0D7377;font-weight:bold">Traiter la demande dans le backoffice →</a></p>`));
      }
    }
  } else if (event === "completed") {
    const sms =
      `Bonjour ${firstName}, votre retrait de ${amountLabel} a ete traite avec succes. ` +
      `Les fonds ont ete deposes sur ${methodLabel}. Merci de votre confiance ! Tontine Digitale.`;
    if (profile?.phone_number) {
      sendMessageBg({
        to: profile.phone_number, body: sms,
        logContext: { kind: "withdrawal_completed", triggeredBy: wr.user_id, userId: wr.user_id },
      });
    }
    if (userEmail) {
      await sendEmail([userEmail], "Retrait traité avec succès",
        wrapEmail("Retrait traité avec succès",
          `<p>Bonjour ${firstName || ""},</p>
           <p>Votre retrait de <strong>${amountLabel}</strong> a été traité avec succès.</p>
           <p>Les fonds ont été déposés sur votre <strong>${methodLabel}</strong>.</p>
           <p>Merci de votre confiance !</p>`));
    }
  } else if (event === "rejected") {
    const reason = wr.rejection_reason ?? "Non spécifié";
    const sms =
      `Bonjour ${firstName}, votre demande de retrait de ${amountLabel} a ete rejetee. ` +
      `Motif : ${reason}. Contactez le support pour plus d'informations. Tontine Digitale.`;
    if (profile?.phone_number) {
      sendMessageBg({
        to: profile.phone_number, body: sms,
        logContext: { kind: "withdrawal_rejected", triggeredBy: wr.user_id, userId: wr.user_id },
      });
    }
    if (userEmail) {
      await sendEmail([userEmail], "Demande de retrait rejetée",
        wrapEmail("Demande de retrait rejetée",
          `<p>Bonjour ${firstName || ""},</p>
           <p>Votre demande de retrait de <strong>${amountLabel}</strong> a été rejetée.</p>
           <p><strong>Motif :</strong> ${reason}</p>
           <p>Le montant a été rendu disponible dans votre solde. Contactez le support pour toute question.</p>`));
    }
  } else {
    return json({ error: "unknown_event" }, 400);
  }

  return json({ success: true });
});