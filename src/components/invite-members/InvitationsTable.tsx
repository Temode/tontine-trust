import { useMemo, useState } from "react";
import {
  Check,
  Clock,
  Mail,
  MessageSquare,
  MoreHorizontal,
  QrCode,
  Search,
  Send,
  Share2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatRelativeDays } from "@/lib/format";
import type { Invitation, InvitationChannel, InvitationStatus } from "@/lib/types";

const STATUS_VISUAL: Record<InvitationStatus, { label: string; className: string }> = {
  sent: { label: "Envoyé", className: "bg-secondary text-foreground" },
  opened: { label: "Ouvert", className: "bg-primary-50 text-primary" },
  joined: { label: "Rejoint", className: "bg-success/10 text-success" },
  declined: { label: "Refusé", className: "bg-destructive/10 text-destructive" },
  expired: { label: "Expiré", className: "bg-muted text-muted-foreground" },
  queued: { label: "En file", className: "bg-warning/10 text-warning" },
};

const CHANNEL_VISUAL: Record<InvitationChannel, { label: string; Icon: typeof Send }> = {
  sms: { label: "SMS", Icon: MessageSquare },
  email: { label: "E-mail", Icon: Mail },
  link: { label: "Lien", Icon: Share2 },
  qr: { label: "QR Code", Icon: QrCode },
  directory: { label: "Annuaire", Icon: Users },
  manual: { label: "Manuel", Icon: Send },
};

type StatusFilter = "all" | InvitationStatus;

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "Tout" },
  { id: "sent", label: "En attente" },
  { id: "opened", label: "Ouvert" },
  { id: "joined", label: "Rejoint" },
  { id: "declined", label: "Refusé" },
  { id: "expired", label: "Expiré" },
];

interface InvitationsTableProps {
  invitations: Invitation[];
  onResend?: (id: string) => void;
  onCancel?: (id: string) => void;
}

export function InvitationsTable({ invitations, onResend, onCancel }: InvitationsTableProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invitations.filter((inv) => {
      if (filter !== "all" && inv.status !== filter) return false;
      if (!q) return true;
      return (
        inv.recipientName?.toLowerCase().includes(q) ||
        inv.recipientPhone?.toLowerCase().includes(q) ||
        inv.recipientEmail?.toLowerCase().includes(q)
      );
    });
  }, [invitations, filter, query]);

  const handleResend = (id: string) => {
    onResend?.(id);
    toast.success("Invitation relancée", { description: "Un nouveau SMS a été émis." });
  };

  const handleCancel = (id: string) => {
    onCancel?.(id);
    toast("Invitation annulée", { description: "Le lien associé a été révoqué." });
  };

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex flex-col gap-3 border-b border-hairline px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Carnet d'invités</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            {filtered.length} {filtered.length > 1 ? "lignes" : "ligne"} · pipeline de souscription en temps réel
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Rechercher un invité"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, numéro ou e-mail"
            className="h-9 w-full rounded-md border border-hairline bg-secondary/40 pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/15 lg:w-64"
          />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline px-5 py-3 lg:px-6">
        {STATUS_FILTERS.map((s) => {
          const active = filter === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilter(s.id)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm text-muted-foreground">
          Aucune invitation pour ce filtre. Lancez une diffusion via les canaux ci-dessus.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3 lg:px-6">Destinataire</th>
                <th className="px-5 py-3 hidden md:table-cell">Canal</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3 hidden lg:table-cell">Émise</th>
                <th className="px-5 py-3 hidden xl:table-cell">Ouverte</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((inv) => {
                const cv = CHANNEL_VISUAL[inv.channel];
                const sv = STATUS_VISUAL[inv.status];
                const ChannelIcon = cv.Icon;
                const isActive = inv.status === "sent" || inv.status === "opened" || inv.status === "queued";
                return (
                  <tr key={inv.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-5 py-3.5 lg:px-6">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-bold text-foreground">
                          {inv.recipientInitials ?? "??"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {inv.recipientName ?? "Lien anonyme"}
                          </p>
                          <p className="truncate text-[11px] font-mono text-muted-foreground">
                            {inv.recipientPhone ?? inv.recipientEmail ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-secondary/40 px-2 py-0.5 text-[11px] font-medium text-foreground">
                        <ChannelIcon className="h-3 w-3" />
                        {cv.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", sv.className)}>
                        {sv.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden text-muted-foreground lg:table-cell">
                      <span className="text-foreground">{inv.sentOn}</span>
                      <span className="ml-1 text-[11px]">({formatRelativeDays(inv.daysFromToday)})</span>
                    </td>
                    <td className="px-5 py-3.5 hidden text-muted-foreground xl:table-cell">
                      {inv.openedOn ? (
                        <span className="inline-flex items-center gap-1 text-foreground">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {inv.openedOn}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {isActive ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleResend(inv.id)}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-hairline px-2 text-[11px] font-medium text-foreground transition hover:bg-secondary"
                          >
                            <Send className="h-3 w-3" />
                            Relancer
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancel(inv.id)}
                            aria-label="Annuler l'invitation"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : inv.status === "joined" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                          <Check className="h-3 w-3" />
                          Confirmé
                        </span>
                      ) : (
                        <button
                          type="button"
                          aria-label="Plus d'options"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
