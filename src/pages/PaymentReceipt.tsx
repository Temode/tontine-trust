import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer, ShieldCheck, Receipt as ReceiptIcon } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { supabase } from "@/integrations/supabase/client";
import { formatGNF } from "@/lib/format";

interface PaymentReceiptRow {
  id: string;
  amount: number;
  status: string;
  provider: string;
  payment_method: string | null;
  djomy_transaction_id: string | null;
  initiated_at: string | null;
  settled_at: string | null;
  payer_phone: string | null;
  group_name: string;
  turn_number: number | null;
  due_date: string | null;
  beneficiary_name: string | null;
}

async function fetchPaymentReceipt(id: string): Promise<PaymentReceiptRow | null> {
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, amount, status, provider, payment_method, djomy_transaction_id, initiated_at, settled_at, payer_phone, groups(name), contributions(turns(turn_number, due_date))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const d = data as any;
  return {
    id: d.id,
    amount: Number(d.amount),
    status: d.status,
    provider: d.provider,
    payment_method: d.payment_method,
    djomy_transaction_id: d.djomy_transaction_id,
    initiated_at: d.initiated_at,
    settled_at: d.settled_at,
    payer_phone: d.payer_phone,
    group_name: d.groups?.name ?? "—",
    turn_number: d.contributions?.turns?.turn_number ?? null,
    due_date: d.contributions?.turns?.due_date ?? null,
    beneficiary_name: null,
  };
}

function providerLabel(p: string | null, method: string | null): string {
  const m = (method ?? "").toUpperCase();
  if (m === "OM") return "Orange Money";
  if (m === "MOMO") return "MTN Mobile Money";
  if (m === "CARD") return "Carte bancaire";
  switch (p) {
    case "orange_money": return "Orange Money";
    case "mtn_money": return "MTN Mobile Money";
    case "cash": return "Espèces";
    case "simulation": return "Simulation";
    default: return p ?? "—";
  }
}

export default function PaymentReceipt() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["payment-receipt", paymentId],
    queryFn: () => fetchPaymentReceipt(paymentId!),
    enabled: !!paymentId,
  });

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <TopBar title="Preuve de paiement" subtitle="Chargement…" />
        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="h-64 animate-pulse rounded-xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="animate-fade-in">
        <TopBar title="Preuve de paiement" />
        <div className="mx-auto max-w-md px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">Paiement introuvable.</p>
          <Link to="/cotisations" className="mt-4 inline-block text-sm font-semibold text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded">
            Retour à mes cotisations
          </Link>
        </div>
      </div>
    );
  }

  const issued = new Date(data.settled_at ?? data.initiated_at ?? Date.now()).toLocaleString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const ref = data.djomy_transaction_id ?? data.id.slice(0, 8).toUpperCase();
  const succeeded = data.status === "succeeded";

  return (
    <div className="animate-fade-in">
      <TopBar title="Preuve de paiement" subtitle="Document numérique de votre cotisation" />
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-6 lg:px-8 lg:py-8">
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Link
            to="/cotisations"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-hairline px-3 text-sm font-medium text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" /> Mes cotisations
          </Link>
          <div className="flex gap-2">
            <Link
              to="/recus"
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-hairline px-3 text-sm font-medium text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <ReceiptIcon className="h-4 w-4" /> Tous mes reçus
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Printer className="h-4 w-4" /> Télécharger / Imprimer
            </button>
          </div>
        </div>

        <article className="rounded-xl border border-hairline bg-card p-6 shadow-sm print:border-0 print:shadow-none">
          <header className="flex items-start justify-between border-b border-hairline pb-4">
            <div>
              <p className="font-display text-lg font-bold text-foreground">
                Tontine <span className="text-primary">Digitale</span>
              </p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Preuve de cotisation
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Référence</p>
              <p className="font-mono text-xs font-semibold text-foreground">{ref}</p>
            </div>
          </header>

          <div className={`my-5 rounded-lg p-5 text-center ${succeeded ? "bg-success/10" : "bg-secondary/60"}`}>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Montant payé</p>
            <p className="mt-1 font-display text-3xl font-bold text-foreground num tabular-nums">
              {formatGNF(data.amount)}
              <span className="ml-2 text-base font-medium text-muted-foreground">GNF</span>
            </p>
            <p className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${succeeded ? "text-success" : "text-muted-foreground"}`}>
              <ShieldCheck className="h-3.5 w-3.5" />
              {succeeded ? "Paiement confirmé" : `Statut : ${data.status}`}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Tontine" value={data.group_name} />
            <Field label="Tour" value={data.turn_number ? `#${data.turn_number}` : "—"} />
            <Field label="Échéance" value={data.due_date ? new Date(data.due_date).toLocaleDateString("fr-FR") : "—"} />
            <Field label="Bénéficiaire" value={data.beneficiary_name ?? "—"} />
            <Field label="Moyen de paiement" value={providerLabel(data.provider, data.payment_method)} />
            <Field label="Numéro payeur" value={data.payer_phone ?? "—"} />
            <Field label="Date" value={issued} />
            <Field label="Statut" value={data.status} />
          </dl>

          <footer className="mt-6 border-t border-hairline pt-4 text-[11px] text-muted-foreground">
            <p className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Document généré automatiquement par Tontine Digitale.
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground break-words">{value}</dd>
    </div>
  );
}