import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const BUCKET = "dispute-exports";

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Convertit un texte multi-ligne en pages PDF A4 lisibles. */
async function buildPdf(sections: { title: string; lines: string[] }[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const PAGE_W = 595.28, PAGE_H = 841.89, MARGIN = 50;
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const writeLine = (text: string, opts?: { size?: number; isBold?: boolean }) => {
    const size = opts?.size ?? 10;
    if (y < MARGIN + size) { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; }
    page.drawText(text.slice(0, 110), {
      x: MARGIN, y, size, font: opts?.isBold ? bold : font, color: rgb(0.05, 0.07, 0.12),
    });
    y -= size + 4;
  };
  // Couverture
  page.drawRectangle({ x: 0, y: PAGE_H - 90, width: PAGE_W, height: 90, color: rgb(0.05, 0.45, 0.46) });
  page.drawText("TONTINE DIGITALE — DOSSIER DE LITIGE CERTIFIE", {
    x: MARGIN, y: PAGE_H - 55, size: 16, font: bold, color: rgb(1, 1, 1),
  });
  page.drawText(`Edité le ${new Date().toLocaleString("fr-FR")}`, {
    x: MARGIN, y: PAGE_H - 75, size: 10, font, color: rgb(0.92, 0.86, 0.4),
  });
  y = PAGE_H - 110;
  for (const s of sections) {
    writeLine("", { size: 6 });
    writeLine(s.title.toUpperCase(), { size: 12, isBold: true });
    page.drawLine({
      start: { x: MARGIN, y: y + 6 }, end: { x: PAGE_W - MARGIN, y: y + 6 },
      thickness: 0.6, color: rgb(0.05, 0.45, 0.46),
    });
    for (const line of s.lines) writeLine(line);
  }
  return await pdf.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({} as { export_id?: string }));
    const exportId = String(body.export_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(exportId)) {
      return new Response(JSON.stringify({ error: "INVALID_EXPORT_ID" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(url, serviceKey);
    const { data: exp } = await admin.from("dispute_exports").select("*").eq("id", exportId).maybeSingle();
    if (!exp) return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Vérification d'accès : organisateur du groupe ou admin
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isOrg } = await admin.rpc("is_group_organizer", { _group_id: exp.group_id, _user_id: user.id });
    if (!isAdmin && !isOrg) {
      return new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.rpc("admin_complete_dispute_export", { _id: exportId, _status: "processing" });

    // 1. Profil + KYC du défaillant
    const { data: profile } = await admin.from("profiles").select("full_name, phone_number, kyc_level, phone_verified_at").eq("id", exp.member_id).maybeSingle();
    const { data: kycDocs } = await admin.from("kyc_documents").select("doc_type, doc_number, status, validated_at").eq("user_id", exp.member_id);
    const { data: group } = await admin.from("groups").select("name, contribution_amount, frequency, created_at").eq("id", exp.group_id).maybeSingle();

    // 2. Ledger
    const { data: ledger } = await admin.from("ledger_entries").select("kind, amount, created_at, ref_id").eq("group_id", exp.group_id).order("created_at", { ascending: true }).limit(200);
    // 3. Reçus + payments
    const { data: receipts } = await admin.from("receipts").select("receipt_no, amount, issued_at").eq("user_id", exp.member_id).limit(50);
    const { data: payments } = await admin.from("payments").select("amount, status, djomy_transaction_id, provider_ref, paid_at").eq("user_id", exp.member_id).limit(100);
    // 4. Contrat signé
    const { data: contract } = await admin.rpc("get_active_contract", { _group_id: exp.group_id });
    const activeContract = Array.isArray(contract) ? contract[0] : contract;
    const { data: sig } = await admin.from("contract_signatures").select("signed_at, ip, user_agent, hash_sha256, otp_ref").eq("contract_id", activeContract?.contract_id).eq("user_id", exp.member_id).maybeSingle();
    // 5. Tours et payout
    const { data: turns } = await admin.from("turns").select("turn_number, due_date, status, paid_at, payout_amount").eq("group_id", exp.group_id).eq("beneficiary_user_id", exp.member_id);
    // 6. Cotisations en défaut
    const { data: defaults } = await admin.from("contributions").select("amount, status, group_id, turn_id, due_date").eq("payer_user_id", exp.member_id).eq("group_id", exp.group_id);
    // 7. SMS rappels
    const { data: smsLog } = await admin.from("sms_logs").select("kind, status, sent_at, body").eq("user_id", exp.member_id).limit(50);

    const sections = [
      { title: "1. Identité du défaillant",
        lines: [
          `Nom: ${profile?.full_name ?? "—"}`,
          `Téléphone vérifié: ${profile?.phone_number ?? "—"} (le ${profile?.phone_verified_at ?? "—"})`,
          `Palier KYC: ${profile?.kyc_level ?? 0}`,
          ...(kycDocs ?? []).map((d) => `Pièce: ${d.doc_type} ${d.doc_number ?? ""} — ${d.status}${d.validated_at ? ` (validée ${d.validated_at})` : ""}`),
        ],
      },
      { title: "2. Groupe",
        lines: [
          `Nom: ${group?.name ?? "—"}`,
          `Cotisation: ${group?.contribution_amount ?? 0} GNF (${group?.frequency ?? ""})`,
          `Créé le: ${group?.created_at ?? "—"}`,
          `Motif du litige: ${exp.reason}`,
        ],
      },
      { title: "3. Historique du grand livre",
        lines: (ledger ?? []).map((e) => `${e.created_at}  ${e.kind.padEnd(20)}  ${e.amount} GNF`),
      },
      { title: "4. Reçus & paiements Mobile Money",
        lines: [
          ...(receipts ?? []).map((r) => `Reçu #${r.receipt_no} — ${r.amount} GNF — ${r.issued_at}`),
          ...(payments ?? []).map((p) => `Paiement ${p.status} — ${p.amount} GNF — ref ${p.djomy_transaction_id ?? p.provider_ref ?? "—"} (${p.paid_at ?? "n/a"})`),
        ],
      },
      { title: "5. Contrat numérique signé",
        lines: activeContract ? [
          `Contrat version ${activeContract.version} (publié ${activeContract.published_at})`,
          sig ? `Signé le ${sig.signed_at} depuis IP ${sig.ip ?? "—"} — hash ${sig.hash_sha256.slice(0, 16)}… (OTP ${sig.otp_ref ?? "—"})` : "PAS DE SIGNATURE ENREGISTREE",
          "",
          ...activeContract.body_md.split("\n"),
        ] : ["Aucun contrat actif trouvé."],
      },
      { title: "6. Versements de cagnotte reçus",
        lines: (turns ?? []).map((t) => `Tour #${t.turn_number} — échéance ${t.due_date} — ${t.status}${t.paid_at ? ` — payé le ${t.paid_at}` : ""} — montant ${t.payout_amount} GNF`),
      },
      { title: "7. Preuve du défaut & rappels envoyés",
        lines: [
          ...(defaults ?? []).filter((d) => d.status === "pending").map((d) => `Cotisation IMPAYEE — ${d.amount} GNF — due ${d.due_date}`),
          "—",
          ...(smsLog ?? []).map((s) => `SMS ${s.kind} (${s.status}) ${s.sent_at}: ${(s.body ?? "").slice(0, 80)}`),
        ],
      },
    ];

    const bytes = await buildPdf(sections);
    const hash = await sha256Hex(bytes);
    const objectKey = `${exp.group_id}/${exp.id}.pdf`;

    const { error: upErr } = await admin.storage.from(BUCKET)
      .upload(objectKey, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw upErr;

    const { data: signed, error: signErr } = await admin.storage.from(BUCKET)
      .createSignedUrl(objectKey, 24 * 3600); // 24 h
    if (signErr) throw signErr;

    await admin.rpc("admin_complete_dispute_export", {
      _id: exportId,
      _status: "ready",
      _pdf_path: objectKey,
      _sha256: hash,
      _signed_url: signed.signedUrl,
      _expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });

    return new Response(JSON.stringify({
      ok: true, export_id: exportId, sha256: hash,
      signed_url: signed.signedUrl, expires_in: 24 * 3600,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[generate-dispute-pdf]", e);
    try {
      const admin = createClient(url, serviceKey);
      const body = await req.clone().json().catch(() => ({}));
      if (body?.export_id) {
        await admin.rpc("admin_complete_dispute_export", { _id: body.export_id, _status: "failed", _error: String((e as Error).message ?? e) });
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: "INTERNAL", detail: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});