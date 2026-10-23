import { useQuery } from "@tanstack/react-query";
import { Printer, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { formatGNF } from "@/lib/format";

export interface PaymentReceipt {
  id: string;
  receipt_number: string;
  kind: string;
  label: string;
  amount: number;
  provider: string | null;
  payment_method: string | null;
  hash: string;
  issued_at: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function printReceipt(r: PaymentReceipt) {
  const w = window.open("", "_blank", "width=600,height=800");
  if (!w) return;
  const date = new Date(r.issued_at).toLocaleString("fr-FR");
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu ${esc(r.receipt_number)}</title></head>
<body style="font-family:Arial,sans-serif;max-width:520px;margin:32px auto;color:#0f172a">
<h2 style="color:#0D7377;margin:0">Reçu de paiement</h2><p style="color:#64748b;margin:4px 0 24px">Tontine Digitale</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr><td style="padding:8px 0;color:#64748b">N° de reçu</td><td style="text-align:right;font-weight:bold">${esc(r.receipt_number)}</td></tr>
<tr><td style="padding:8px 0;color:#64748b">Objet</td><td style="text-align:right">${esc(r.label)}</td></tr>
<tr><td style="padding:8px 0;color:#64748b">Moyen</td><td style="text-align:right">${esc(r.payment_method ?? r.provider ?? "—")}</td></tr>
<tr><td style="padding:8px 0;color:#64748b">Date</td><td style="text-align:right">${esc(date)}</td></tr>
<tr><td style="padding:12px 0;border-top:1px solid #e2e8f0;font-weight:bold">Montant</td><td style="text-align:right;border-top:1px solid #e2e8f0;font-size:20px;font-weight:bold;color:#0D7377">${esc(formatGNF(r.amount))}</td></tr>
</table><p style="font-size:11px;color:#94a3b8;word-break:break-all">Empreinte de vérification : ${esc(r.hash)}</p>
<script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

export function PaymentReceiptsSection() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["payment-receipts", "mine"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_receipts")
        .select("id, receipt_number, kind, label, amount, provider, payment_method, hash, issued_at")
        .order("issued_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as PaymentReceipt[];
    },
  });

  return (
    <SectionCard
      title="Reçus de mes paiements"
      subtitle={isLoading ? "Chargement…" : `${data.length} reçu${data.length > 1 ? "s" : ""} · une copie est envoyée par email`}
      bare
    >
      {data.length === 0 && !isLoading ? (
        <p className="px-5 py-6 text-sm text-muted-foreground lg:px-6">
          Aucun paiement pour l'instant. Un reçu est créé automatiquement à chaque paiement confirmé.
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {data.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-3 lg:px-6">
              <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{r.label}</p>
                <p className="text-xs text-muted-foreground">
                  {r.receipt_number} · {new Date(r.issued_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <span className="num text-sm font-semibold">{formatGNF(r.amount)}</span>
              <button
                type="button"
                onClick={() => printReceipt(r)}
                aria-label={`Imprimer le reçu ${r.receipt_number}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-hairline text-muted-foreground hover:text-foreground"
              >
                <Printer className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
