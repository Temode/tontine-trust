import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff, History, Loader2, Plus, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/dashboard/SectionCard";
import {
  createInvitation,
  listGroupInvitations,
  revokeInvitation,
} from "@/lib/api/invitations";
import type { DbInvitation } from "@/lib/api/types";

type Status = "valide" | "expire" | "epuise" | "revoque";

function computeStatus(inv: DbInvitation): Status {
  if (inv.status === "revoked") return "revoque";
  if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) return "expire";
  if (inv.max_uses != null && inv.uses_count >= inv.max_uses) return "epuise";
  return "valide";
}

const STATUS_VISUAL: Record<Status, { label: string; cls: string }> = {
  valide: { label: "Valide", cls: "bg-success/10 text-success border-success/20" },
  expire: { label: "Expiré", cls: "bg-muted text-muted-foreground border-hairline" },
  epuise: { label: "Épuisé", cls: "bg-accent-50 text-accent-700 border-accent-200" },
  revoque: { label: "Révoqué", cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

function maskCode(code: string): string {
  return code.replace(/[A-Z0-9]/g, (c, i) => (i < 2 ? c : "•"));
}

interface Props {
  groupId: string;
  canManage: boolean;
}

export function InvitationsHistoryPanel({ groupId, canManage }: Props) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["invitations", groupId],
    queryFn: () => listGroupInvitations(groupId),
    enabled: !!groupId,
    staleTime: 30_000,
  });
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [data],
  );

  const createM = useMutation({
    mutationFn: () => createInvitation({ groupId }),
    onSuccess: () => {
      toast.success("Nouveau code généré");
      qc.invalidateQueries({ queryKey: ["invitations", groupId] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const revokeM = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => {
      toast.success("Code révoqué");
      qc.invalidateQueries({ queryKey: ["invitations", groupId] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const handleCopy = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(id);
      toast.success("Code copié");
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800);
    } catch {
      toast.error("Copie impossible");
    }
  };

  return (
    <SectionCard
      title="Codes d'invitation"
      subtitle={isLoading ? "Chargement…" : `${sorted.length} code${sorted.length > 1 ? "s" : ""} généré${sorted.length > 1 ? "s" : ""}`}
      bare
    >
      {canManage && (
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3 lg:px-6">
          <p className="text-xs text-muted-foreground">
            L'historique liste tous les codes générés pour cette tontine, avec leur statut et leur usage.
          </p>
          <button
            type="button"
            disabled={createM.isPending}
            onClick={() => createM.mutate()}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-60"
          >
            {createM.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Nouveau code
          </button>
        </div>
      )}

      {isLoading ? (
        <ul className="divide-y divide-border/60">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="px-5 py-4 lg:px-6">
              <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
              <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-secondary/70" />
            </li>
          ))}
        </ul>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-10 text-center lg:px-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary">
            <History className="h-5 w-5" />
          </div>
          <p className="mt-3 font-display text-sm font-semibold text-foreground">
            Aucun code généré pour le moment
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Les codes générés pour inviter de nouveaux membres apparaîtront ici.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {sorted.map((inv) => {
            const status = computeStatus(inv);
            const visible = !!showAll[inv.id];
            const displayed = visible ? inv.code : maskCode(inv.code);
            const usage =
              inv.max_uses != null ? `${inv.uses_count} / ${inv.max_uses}` : `${inv.uses_count} / ∞`;
            const createdLabel = new Date(inv.created_at).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
            const expiresLabel = inv.expires_at
              ? new Date(inv.expires_at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "Sans limite";
            return (
              <li
                key={inv.id}
                className="flex flex-wrap items-center gap-3 px-5 py-4 lg:px-6"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="font-display text-sm font-bold tracking-[0.18em] text-foreground num">
                    {displayed}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setShowAll((m) => ({ ...m, [inv.id]: !m[inv.id] }))
                    }
                    aria-label={visible ? "Masquer le code" : "Afficher le code"}
                    className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    {visible ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(inv.id, inv.code)}
                    aria-label="Copier le code"
                    className={cn(
                      "rounded-md p-1 transition",
                      copied === inv.id
                        ? "bg-success/10 text-success"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {copied === inv.id ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                    STATUS_VISUAL[status].cls,
                  )}
                >
                  {STATUS_VISUAL[status].label}
                </span>

                <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:w-auto sm:basis-auto">
                  <span>
                    Créé&nbsp;: <span className="text-foreground num">{createdLabel}</span>
                  </span>
                  <span>
                    Expire&nbsp;: <span className="text-foreground num">{expiresLabel}</span>
                  </span>
                  <span>
                    Usage&nbsp;: <span className="text-foreground num">{usage}</span>
                  </span>
                </div>

                {canManage && status === "valide" && (
                  <button
                    type="button"
                    disabled={revokeM.isPending}
                    onClick={() => {
                      if (window.confirm("Révoquer ce code ? Il ne sera plus utilisable.")) {
                        revokeM.mutate(inv.id);
                      }
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-hairline px-2.5 text-[11px] font-medium text-muted-foreground transition hover:text-destructive disabled:opacity-50"
                  >
                    <ShieldOff className="h-3.5 w-3.5" />
                    Révoquer
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}