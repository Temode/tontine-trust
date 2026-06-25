import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertOctagon, Bell, Check, ChevronRight, Scale, ShieldAlert, Inbox,
} from "lucide-react";
import { getUserDefaultHistory, type UserDefaultHistoryRow } from "@/lib/api/disputes";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatGNF } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DisputeDialog } from "./DisputeDialog";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  defaulted: { label: "En défaut", cls: "bg-destructive text-destructive-foreground" },
  confirmed: { label: "Régularisée", cls: "bg-success/15 text-success" },
  pending: { label: "En attente", cls: "bg-muted text-foreground" },
  submitted: { label: "Soumise", cls: "bg-amber-500/15 text-amber-600" },
  rejected: { label: "Rejetée", cls: "bg-destructive/15 text-destructive" },
};

const DISPUTE_LABEL: Record<string, string> = {
  open: "Contestation ouverte",
  under_review: "Contestation en revue",
  accepted: "Contestation acceptée",
  rejected: "Contestation rejetée",
  resolved: "Contestation résolue",
};

const REPORT_LABEL: Record<string, string> = {
  open: "Signalé à Tontine",
  in_review: "En traitement Tontine",
  legal_action: "Procédure judiciaire",
  resolved: "Signalement résolu",
  dismissed: "Signalement rejeté",
};

export function DefaultHistorySection() {
  const navigate = useNavigate();
  const q = useQuery<UserDefaultHistoryRow[]>({
    queryKey: ["user-default-history"],
    queryFn: getUserDefaultHistory,
  });
  const [disputing, setDisputing] = useState<UserDefaultHistoryRow | null>(null);

  const rows = q.data ?? [];

  return (
    <SectionCard
      title="Historique des défauts"
      subtitle={
        q.isLoading
          ? "Chargement…"
          : rows.length === 0
            ? "Aucun défaut enregistré — bravo pour votre régularité."
            : `${rows.length} échéance${rows.length > 1 ? "s" : ""} concernée${rows.length > 1 ? "s" : ""}`
      }
      bare
    >
      {q.isLoading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-secondary" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Aucun défaut"
          description="Toutes vos cotisations ont été honorées dans les délais."
        />
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((r) => {
            const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
            const canDispute = r.status === "defaulted" && !r.dispute_status;
            return (
              <li
                key={r.contribution_id}
                className="flex flex-wrap items-start gap-3 px-5 py-3.5 transition focus-within:bg-secondary/40 hover:bg-secondary/30 lg:px-6"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                    r.status === "defaulted" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
                  )}
                >
                  {r.status === "defaulted" ? <AlertOctagon className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{r.group_name}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", badge.cls)}>
                      {badge.label}
                    </span>
                    {r.dispute_status && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        <Scale className="h-3 w-3" />
                        {DISPUTE_LABEL[r.dispute_status]}
                      </span>
                    )}
                    {r.report_status && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        <ShieldAlert className="h-3 w-3" />
                        {REPORT_LABEL[r.report_status]}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tour #{r.turn_number} · échéance{" "}
                    {new Date(r.due_date).toLocaleDateString("fr-FR")}
                    {r.defaulted_at && (
                      <>
                        {" · bascule en défaut le "}
                        <span className="font-semibold text-destructive">
                          {new Date(r.defaulted_at).toLocaleDateString("fr-FR")}
                        </span>
                      </>
                    )}
                    {r.paid_at && (
                      <>
                        {" · payée le "}
                        <span className="font-semibold text-success">
                          {new Date(r.paid_at).toLocaleDateString("fr-FR")}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Bell className="h-3 w-3" />
                    {r.notifications_count} notification{r.notifications_count > 1 ? "s" : ""} envoyée{r.notifications_count > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="ml-auto flex flex-col items-end gap-1.5">
                  <p className="font-display text-sm font-bold text-foreground num">
                    {formatGNF(r.amount)} <span className="text-xs text-muted-foreground">GNF</span>
                  </p>
                  <div className="flex gap-1.5">
                    {canDispute && (
                      <button
                        type="button"
                        onClick={() => setDisputing(r)}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/40 bg-card px-2 text-[11px] font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Scale className="h-3 w-3" />
                        Contester
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(`/groupes/${r.group_id}`)}
                      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Voir le groupe
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {disputing && (
        <DisputeDialog
          open={!!disputing}
          onOpenChange={(o) => !o && setDisputing(null)}
          contributionId={disputing.contribution_id}
          groupName={disputing.group_name}
        />
      )}
    </SectionCard>
  );
}