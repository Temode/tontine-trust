import { CheckCircle2, Plus, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";

interface PaymentMethodsCardProps {
  methods: PaymentMethod[];
  onAdd?: () => void;
  onSetPrimary?: (id: string) => void;
}

const styles: Record<PaymentMethod["operator"], { swatch: string; text: string; short: string; brand: string }> = {
  orange: { swatch: "bg-orange-500", text: "text-white", short: "OM", brand: "Orange Money" },
  mtn: { swatch: "bg-yellow-400", text: "text-black", short: "MTN", brand: "MTN Mobile Money" },
};

export function PaymentMethodsCard({ methods, onAdd, onSetPrimary }: PaymentMethodsCardProps) {
  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between border-b border-hairline px-5 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Méthodes de paiement</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">Comptes Mobile Money associés</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-md border border-hairline px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </button>
      </header>

      <ul className="divide-y divide-border/60">
        {methods.map((method) => {
          const v = styles[method.operator];
          return (
            <li key={method.id} className="px-5 py-4 lg:px-6">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold", v.swatch, v.text)}>
                  {v.short}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{v.brand}</p>
                    {method.primary && (
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        Primaire
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground num">{method.msisdn}</p>
                </div>
                {method.verified && (
                  <span className="hidden items-center gap-1 text-[11px] font-medium text-success sm:inline-flex">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Vérifié
                  </span>
                )}
              </div>

              {method.balance !== undefined && (
                <div className="mt-3 flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Solde estimé</span>
                  <span className="font-display font-semibold text-foreground num">
                    {formatGNF(method.balance, { withCurrency: true })}
                  </span>
                </div>
              )}

              {!method.primary && (
                <button
                  type="button"
                  onClick={() => onSetPrimary?.(method.id)}
                  className="mt-3 w-full rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  Définir comme primaire
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="flex items-center gap-2 border-t border-hairline bg-secondary/30 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
        <Shield className="h-3.5 w-3.5 text-success" />
        Identifiants chiffrés. Aucun débit n'a lieu sans confirmation explicite.
      </footer>
    </article>
  );
}
