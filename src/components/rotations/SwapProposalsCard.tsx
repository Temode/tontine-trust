import { useState } from "react";
import { ArrowRightLeft, Check, Clock, Inbox, Send, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SwapProposal, SwapStatus } from "@/lib/types";

const statusVisual: Record<SwapStatus, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-warning/10 text-warning" },
  accepted: { label: "Accepté", className: "bg-success/10 text-success" },
  declined: { label: "Refusé", className: "bg-destructive/10 text-destructive" },
  expired: { label: "Expiré", className: "bg-muted text-muted-foreground" },
};

interface SwapProposalsCardProps {
  proposals: SwapProposal[];
}

export function SwapProposalsCard({ proposals }: SwapProposalsCardProps) {
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const [items, setItems] = useState(proposals);

  const filtered = items.filter((p) => p.direction === tab);

  const handleAccept = (id: string) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, status: "accepted" } : p)));
    toast.success("Échange accepté", {
      description: "Vos cycles seront mis à jour dès la prochaine échéance.",
    });
  };

  const handleDecline = (id: string) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, status: "declined" } : p)));
    toast("Proposition refusée", { description: "Le demandeur a été notifié." });
  };

  const handleCancel = (id: string) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, status: "expired" } : p)));
    toast("Demande annulée", { description: "Votre proposition a été retirée." });
  };

  const counts = {
    incoming: items.filter((p) => p.direction === "incoming").length,
    outgoing: items.filter((p) => p.direction === "outgoing").length,
  };

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Échanges de tours</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Demandes d'échange entre membres de vos groupes
          </p>
        </div>
        <button
          type="button"
          className="hidden items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:inline-flex"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Proposer un échange
        </button>
      </header>

      <div className="flex items-center gap-1 border-b border-hairline px-5 pt-3 lg:px-6">
        <Tab
          active={tab === "incoming"}
          icon={<Inbox className="h-3.5 w-3.5" />}
          label="Reçues"
          count={counts.incoming}
          onClick={() => setTab("incoming")}
        />
        <Tab
          active={tab === "outgoing"}
          icon={<Send className="h-3.5 w-3.5" />}
          label="Envoyées"
          count={counts.outgoing}
          onClick={() => setTab("outgoing")}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm text-muted-foreground">
          Aucune proposition {tab === "incoming" ? "reçue" : "envoyée"}.
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {filtered.map((p) => (
            <li key={p.id} className="px-5 py-4 lg:px-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                  {p.counterpartyInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{p.counterparty}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", statusVisual[p.status].className)}>
                      {statusVisual[p.status].label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.groupName} · proposé le {p.proposedOn}
                    {p.status === "pending" && p.expiresIn > 0 && (
                      <>
                        {" "}·{" "}
                        <span className="inline-flex items-center gap-1 text-warning">
                          <Clock className="h-3 w-3" />
                          expire dans {p.expiresIn} {p.expiresIn > 1 ? "jours" : "jour"}
                        </span>
                      </>
                    )}
                  </p>

                  <div className="mt-3 flex items-center gap-3 rounded-md bg-secondary/40 px-3 py-2">
                    <SwapBadge label="Tour" value={`#${p.theirTurn}`} sublabel={tab === "incoming" ? p.counterparty : "Vous"} />
                    <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                    <SwapBadge label="Tour" value={`#${p.yourTurn}`} sublabel={tab === "incoming" ? "Vous" : p.counterparty} />
                  </div>

                  {p.message && p.message !== "—" && (
                    <p className="mt-3 rounded-md border-l-2 border-primary-100 bg-primary-50/40 px-3 py-2 text-xs text-foreground">
                      « {p.message} »
                    </p>
                  )}
                </div>
              </div>

              {p.status === "pending" && (
                <div className="mt-3 flex items-center justify-end gap-2">
                  {tab === "incoming" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDecline(p.id)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                        Refuser
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAccept(p.id)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Accepter
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCancel(p.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                      Annuler
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Tab({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] font-semibold",
          active ? "bg-primary-50 text-primary" : "bg-secondary text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function SwapBadge({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-sm font-bold text-foreground num">{value}</p>
      <p className="truncate text-[10px] text-muted-foreground">{sublabel}</p>
    </div>
  );
}
