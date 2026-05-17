import { AlertTriangle, Plus, RefreshCcw, ShieldCheck, Unlink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { MobileMoneyConnection, MobileMoneyOperator } from "@/lib/types";

const STATUS_VISUAL = {
  active: { label: "Synchronisé", className: "bg-success/10 text-success", dot: "bg-success" },
  needs_reauth: { label: "Reconnexion requise", className: "bg-warning/10 text-warning", dot: "bg-warning" },
  suspended: { label: "Suspendu", className: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
} as const;

const OPERATOR_VISUAL: Record<MobileMoneyOperator, { swatch: string; text: string; short: string }> = {
  orange: { swatch: "bg-orange-500", text: "text-white", short: "OM" },
  mtn: { swatch: "bg-yellow-400", text: "text-black", short: "MTN" },
};

interface MobileMoneySectionProps {
  connections: MobileMoneyConnection[];
}

export function MobileMoneySection({ connections: initial }: MobileMoneySectionProps) {
  const [connections, setConnections] = useState(initial);

  const handleToggleAuto = (id: string) => {
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, autoDebit: !c.autoDebit } : c)),
    );
    const c = connections.find((x) => x.id === id);
    toast(c?.autoDebit ? "Débit automatique désactivé" : "Débit automatique activé", {
      description: "Modification appliquée instantanément aux prochaines échéances.",
    });
  };

  const handleReauth = (id: string) => {
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "active", lastSyncedOn: "À l'instant" } : c)),
    );
    toast.success("Connexion renouvelée", { description: "OTP validé · jeton signé pour 90 jours." });
  };

  const handleUnlink = (id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
    toast("Méthode déconnectée", {
      description: "Les prélèvements futurs s'effectueront sur votre méthode primaire restante.",
    });
  };

  return (
    <div className="space-y-6">
      <article className="rounded-xl border border-hairline bg-card">
        <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
          <div>
            <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Connexions Mobile Money</h2>
            <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
              Comptes opérateurs habilités à débiter votre compte Tontine Digital
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              toast("Ajout d'une nouvelle connexion", {
                description: "Le flux OAuth opérateur sera disponible dans la prochaine livraison.",
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary"
          >
            <Plus className="h-3.5 w-3.5" />
            Connecter
          </button>
        </header>

        {connections.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            Aucune connexion Mobile Money. Connectez Orange Money ou MTN pour activer les prélèvements automatiques.
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {connections.map((c) => {
              const op = OPERATOR_VISUAL[c.operator];
              const sv = STATUS_VISUAL[c.status];
              return (
                <li key={c.id} className="px-5 py-5 lg:px-6">
                  <div className="flex items-start gap-4">
                    <span
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-sm font-bold",
                        op.swatch,
                        op.text,
                      )}
                    >
                      {op.short}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{c.label}</p>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            sv.className,
                          )}
                        >
                          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", sv.dot)} />
                          {sv.label}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{c.msisdn}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Connecté le {c.connectedOn} · dernier sync {c.lastSyncedOn}
                      </p>

                      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                        <Metric label="Plafond journalier" value={`${formatGNF(c.dailyCap)} GNF`} />
                        <Metric label="Plafond mensuel" value={`${formatGNF(c.monthlyCap)} GNF`} />
                        <Metric label="Débit automatique" value={c.autoDebit ? "Activé" : "Désactivé"} />
                      </dl>

                      {c.status === "needs_reauth" && (
                        <p className="mt-3 inline-flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-warning">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            Le jeton OTP a expiré. Reconnectez-vous pour réactiver les prélèvements
                            automatiques sur ce compte.
                          </span>
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleAuto(c.id)}
                          className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition",
                            c.autoDebit
                              ? "border-success/30 bg-success/5 text-success hover:bg-success/10"
                              : "border-hairline text-foreground hover:bg-secondary",
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn("h-1.5 w-1.5 rounded-full", c.autoDebit ? "bg-success" : "bg-muted-foreground/60")}
                          />
                          Débit automatique · {c.autoDebit ? "ON" : "OFF"}
                        </button>
                        {c.status === "needs_reauth" && (
                          <button
                            type="button"
                            onClick={() => handleReauth(c.id)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            Reconnecter
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleUnlink(c.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        >
                          <Unlink className="h-3.5 w-3.5" />
                          Déconnecter
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="flex items-center gap-2 border-t border-hairline bg-secondary/30 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Tokens OAuth chiffrés · révocables à tout moment · aucun débit hors confirmation explicite
        </footer>
      </article>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-hairline bg-card px-2.5 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-display text-xs font-bold text-foreground num">{value}</dd>
    </div>
  );
}
