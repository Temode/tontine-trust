import { ArrowUpRight, Check, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { BillingInvoice, Subscription } from "@/lib/types";

const TIER_LABEL = {
  standard: "Standard",
  premium: "Premium",
  enterprise: "Enterprise",
} as const;

interface SubscriptionSectionProps {
  subscription: Subscription;
  invoices: BillingInvoice[];
}

export function SubscriptionSection({ subscription, invoices }: SubscriptionSectionProps) {
  const handleDownload = (inv: BillingInvoice) => {
    toast.success("Facture téléchargée", { description: `${inv.number} · PDF signé.` });
  };

  const handleUpgrade = () => {
    toast("Mise à niveau Enterprise", {
      description: "Un agent commercial vous contactera sous 24h pour finaliser le contrat.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Plan hero */}
      <article className="relative overflow-hidden rounded-xl border border-hairline bg-card">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent-50 blur-3xl" />
        </div>

        <div className="relative grid grid-cols-1 gap-6 px-5 py-6 lg:grid-cols-[1.4fr_1fr] lg:items-start lg:px-7 lg:py-7">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Plan en cours
            </p>
            <h2 className="mt-2 inline-flex items-center gap-2 font-display text-2xl font-bold text-foreground lg:text-3xl">
              Tontine Digital · {TIER_LABEL[subscription.tier]}
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
                Actif
              </span>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Renouvellement automatique le{" "}
              <span className="font-medium text-foreground">{subscription.renewalDate}</span> · prélèvement
              de{" "}
              <span className="font-display font-semibold text-foreground num">
                {formatGNF(subscription.priceMonthly, { withCurrency: true })}
              </span>{" "}
              sur Orange Money.
            </p>

            <ul className="mt-5 space-y-2 text-sm">
              {subscription.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.5} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <aside className="rounded-lg border border-hairline bg-secondary/40 p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Mise à niveau
            </p>
            <h3 className="mt-2 font-display text-base font-bold text-foreground">
              Tontine Digital · Enterprise
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Plafonds illimités, co-organisateurs notarisés, accès aux émissions premium et SLA dédié.
            </p>
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <li className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-accent-700" />
                Volume mensuel non plafonné
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-accent-700" />
                API illimitée + accès registre temps réel
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-accent-700" />
                Conformité BCG accompagnée
              </li>
            </ul>
            <button
              type="button"
              onClick={handleUpgrade}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
            >
              Demander une démo
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </aside>
        </div>
      </article>

      {/* Usage of plan */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-5 py-4 lg:px-6">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Consommation du plan</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Utilisation par rapport aux quotas inclus dans votre abonnement
          </p>
        </header>

        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-3">
          <UsageBar
            label="Groupes organisateur"
            value={subscription.usage.groupsCreated.current}
            cap={subscription.usage.groupsCreated.cap}
            unit="count"
          />
          <UsageBar
            label="Invitations émises (30 j)"
            value={subscription.usage.membersInvited.current}
            cap={subscription.usage.membersInvited.cap}
            unit="count"
          />
          <UsageBar
            label="Volume mensuel"
            value={subscription.usage.monthlyVolume.current}
            cap={subscription.usage.monthlyVolume.cap}
            unit="currency"
          />
        </div>
      </article>

      {/* Billing history */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-5 py-4 lg:px-6">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Historique de facturation</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Factures certifiées · téléchargeables au format PDF signé
          </p>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3 lg:px-6">Numéro</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Montant</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3 text-right">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {invoices.map((inv) => (
                <tr key={inv.id} className="transition-colors hover:bg-secondary/30">
                  <td className="px-5 py-3.5 font-mono text-xs text-foreground lg:px-6">{inv.number}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{inv.date}</td>
                  <td className="px-5 py-3.5 text-right font-display font-semibold num text-foreground">
                    {formatGNF(inv.amount, { withCurrency: true })}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        inv.status === "paid"
                          ? "bg-success/10 text-success"
                          : inv.status === "pending"
                          ? "bg-warning/10 text-warning"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {inv.status === "paid" ? "Payée" : inv.status === "pending" ? "En attente" : "Échec"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDownload(inv)}
                      aria-label={`Télécharger ${inv.number}`}
                      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

function UsageBar({
  label,
  value,
  cap,
  unit,
}: {
  label: string;
  value: number;
  cap: number;
  unit: "count" | "currency";
}) {
  const rate = Math.min(100, Math.round((value / cap) * 100));
  const tone = rate >= 90 ? "bg-warning" : rate >= 70 ? "bg-accent-500" : "bg-primary";

  const fmt = (n: number) => (unit === "currency" ? `${formatGNF(n, { compact: n >= 1_000_000 })} GNF` : String(n));

  return (
    <section className="bg-card px-5 py-4 lg:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-base font-bold text-foreground num">
        {fmt(value)} <span className="text-xs font-medium text-muted-foreground">/ {fmt(cap)}</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${rate}%` }} />
      </div>
      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        Utilisé <span className="num text-foreground">{rate}%</span>
      </p>
    </section>
  );
}
