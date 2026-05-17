import { Clock, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { MonthlyStatement } from "@/lib/types";

interface StatementsCardProps {
  statements: MonthlyStatement[];
}

export function StatementsCard({ statements }: StatementsCardProps) {
  const handleDownload = (s: MonthlyStatement) => {
    if (s.status === "pending") {
      toast("Relevé en cours de constitution", {
        description: "Le relevé du mois en cours sera disponible le 1er du mois suivant.",
      });
      return;
    }
    toast.success("Relevé téléchargé", {
      description: `Statement ${s.month} · format PDF (mock).`,
    });
  };

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Relevés mensuels</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Synthèse certifiée pour l'archivage et la fiscalité
          </p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-success/10 px-2 py-1 text-[11px] font-medium text-success sm:inline-flex">
          <ShieldDot />
          Certifié
        </span>
      </header>

      <ul className="divide-y divide-border/50">
        {statements.map((s) => {
          const net = s.net;
          const netSign = net >= 0 ? "+" : "−";
          const isPending = s.status === "pending";

          return (
            <li key={s.id} className="px-5 py-4 lg:px-6">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border",
                    isPending ? "border-hairline bg-secondary text-muted-foreground" : "border-primary-100 bg-primary-50 text-primary",
                  )}
                >
                  <FileText className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{s.month}</p>
                    {isPending ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                        <Clock className="h-3 w-3" />
                        En cours
                      </span>
                    ) : (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-success">
                        Prêt
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.range} · {s.operations} {s.operations > 1 ? "opérations" : "opération"}
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <Stat label="Entrées" value={`+${formatGNF(s.inflow, { compact: true })}`} valueClass="text-success" />
                    <Stat label="Sorties" value={`−${formatGNF(s.outflow, { compact: true })}`} />
                    <Stat
                      label="Net"
                      value={`${netSign}${formatGNF(Math.abs(net), { compact: true })}`}
                      valueClass={net >= 0 ? "text-success" : "text-destructive"}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDownload(s)}
                disabled={isPending}
                className={cn(
                  "mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition",
                  isPending
                    ? "cursor-not-allowed border border-hairline text-muted-foreground"
                    : "border border-hairline text-foreground hover:bg-secondary",
                )}
              >
                <Download className="h-3.5 w-3.5" />
                {isPending ? "Disponible le 1er du mois prochain" : "Télécharger"}
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-md bg-secondary/40 px-2 py-1.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-display text-xs font-bold num", valueClass ?? "text-foreground")}>{value}</p>
    </div>
  );
}

function ShieldDot() {
  return <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />;
}
