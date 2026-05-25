import { useQuery } from "@tanstack/react-query";
import { FileCheck2, Printer, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { TopBar } from "@/components/layout/TopBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { formatGNF } from "@/lib/format";
import { getReceiptById, listMyReceipts, type DbReceipt } from "@/lib/api/payouts";

export default function Receipts() {
  const { id } = useParams<{ id?: string }>();
  if (id) return <ReceiptDetail id={id} />;
  return <ReceiptList />;
}

function ReceiptList() {
  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["receipts", "mine"],
    queryFn: listMyReceipts,
  });

  return (
    <div className="animate-fade-in">
      <TopBar title="Reçus" subtitle="Vos reçus de versement émis par la tontine." />
      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <SectionCard title="Mes reçus" subtitle={isLoading ? "Chargement…" : `${receipts.length} reçu${receipts.length > 1 ? "s" : ""}`} bare>
          {isLoading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground lg:px-6">Chargement…</p>
          ) : receipts.length === 0 ? (
            <div className="px-5 py-10 text-center lg:px-6">
              <p className="text-sm text-muted-foreground">
                Aucun reçu pour le moment. Ils apparaîtront dès qu'un versement vous sera attribué.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {receipts.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3.5 lg:px-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-50 text-accent-700">
                    <FileCheck2 className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{r.receipt_number}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.group_name} · Tour #{r.turn_number} ·{" "}
                      {new Date(r.issued_at).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                  <p className="font-display text-sm font-bold text-foreground num">
                    {formatGNF(r.amount)} GNF
                  </p>
                  <Link
                    to={`/recus/${r.id}`}
                    className="ml-3 inline-flex h-9 items-center rounded-md border border-hairline px-3 text-xs font-medium text-foreground transition hover:bg-secondary"
                  >
                    Voir
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function ReceiptDetail({ id }: { id: string }) {
  const { data: receipt, isLoading } = useQuery({
    queryKey: ["receipts", id],
    queryFn: () => getReceiptById(id),
  });

  if (isLoading) {
    return <div className="px-6 py-12 text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!receipt) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">Reçu introuvable.</p>
        <Link to="/recus" className="mt-4 inline-block text-sm font-semibold text-primary underline">
          Retour aux reçus
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <TopBar title={`Reçu ${receipt.receipt_number}`} subtitle="Document numérique vérifiable" />
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-6 lg:px-8 lg:py-8">
        <div className="flex justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700"
          >
            <Printer className="h-4 w-4" />
            Imprimer / PDF
          </button>
        </div>

        <ReceiptCard receipt={receipt} />
      </div>
    </div>
  );
}

export function ReceiptCard({ receipt }: { receipt: DbReceipt }) {
  const dt = new Date(receipt.issued_at).toLocaleString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return (
    <article className="rounded-xl border border-hairline bg-card p-6 shadow-sm print:border-0 print:shadow-none">
      <header className="flex items-start justify-between border-b border-hairline pb-4">
        <div>
          <p className="font-display text-lg font-bold text-foreground">
            Tontine <span className="text-primary">Digital</span>
          </p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Reçu de versement
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">N° de reçu</p>
          <p className="font-display text-sm font-bold text-foreground num">{receipt.receipt_number}</p>
        </div>
      </header>

      <div className="my-5 rounded-lg bg-accent-50/60 p-5 text-center">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Montant versé</p>
        <p className="mt-1 font-display text-3xl font-bold text-foreground num">
          {formatGNF(receipt.amount)}
          <span className="ml-2 text-base font-medium text-muted-foreground">GNF</span>
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Field label="Bénéficiaire" value={receipt.beneficiary_name ?? "—"} />
        <Field label="Groupe" value={receipt.group_name} />
        <Field label="Tour" value={`#${receipt.turn_number}`} />
        <Field label="Moyen" value={providerLabel(receipt.provider)} />
        <Field label="Émis par" value={receipt.issued_by_name ?? "—"} />
        <Field label="Date d'émission" value={dt} />
      </dl>

      <footer className="mt-6 border-t border-hairline pt-4">
        <p className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Empreinte de vérification (SHA-256)
        </p>
        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{receipt.hash}</p>
      </footer>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

function providerLabel(p: string): string {
  switch (p) {
    case "orange_money": return "Orange Money";
    case "mtn_money": return "MTN Mobile Money";
    case "cash": return "Espèces";
    case "simulation": return "Simulation (sandbox)";
    default: return p;
  }
}