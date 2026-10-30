import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, Flag, Loader2 } from "lucide-react";
import { listGroupDefaulters, canUserReportDefaulter, type GroupDefaulterRow } from "@/lib/api/defaulters";
import { formatGNF } from "@/lib/format";
import { ReportDefaulterDialog } from "./ReportDefaulterDialog";
import { useAuth } from "@/hooks/useAuth";
import { DisputeExportButton } from "./DisputeExportButton";
import { useQuery as useQueryPerm } from "@tanstack/react-query";
import { getGroup } from "@/lib/api/groups";

export function GroupDefaultersSection({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const groupQ = useQueryPerm({ queryKey: ["group", groupId], queryFn: () => getGroup(groupId) });
  const isOrganizer = !!user && (groupQ.data?.created_by === user.id || (groupQ.data?.co_organizers ?? []).includes(user.id));
  const q = useQuery({
    queryKey: ["group-defaulters", groupId],
    queryFn: () => listGroupDefaulters(groupId),
  });
  const permQ = useQuery({
    queryKey: ["can-report-defaulter", groupId, user?.id],
    queryFn: () => canUserReportDefaulter(groupId, user!.id),
    enabled: !!user?.id,
  });
  const [reporting, setReporting] = useState<GroupDefaulterRow | null>(null);

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-hairline bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Vérification des retards…
      </div>
    );
  }
  if (!q.data || q.data.length === 0) return null;

  return (
    <>
      <article className="overflow-hidden rounded-xl border border-destructive/40 bg-destructive/5">
        <header className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-4 py-3">
          <AlertOctagon className="h-4 w-4 text-destructive" />
          <h3 className="font-display text-sm font-bold text-destructive">
            Cotisations en défaut ({q.data.length})
          </h3>
        </header>
        <ul className="divide-y divide-destructive/15">
          {q.data.map((d) => (
            <li key={d.contribution_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {d.payer_name ?? "Membre"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Tour #{d.turn_number} · échéance {new Date(d.due_date).toLocaleDateString("fr-FR")} ·{" "}
                  <span className="font-semibold text-destructive">{d.default_days} j de retard</span>
                </p>
              </div>
              <p className="font-display text-sm font-bold text-foreground num">
                {formatGNF(d.amount)} <span className="text-xs text-muted-foreground">GNF</span>
              </p>
              {d.has_open_report ? (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                  Signalé à Tontine
                </span>
              ) : permQ.data ? (
                <button
                  type="button"
                  onClick={() => setReporting(d)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-destructive/40 bg-card px-2 text-xs font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                >
                  <Flag className="h-3.5 w-3.5" />
                  Signaler à Tontine
                </button>
              ) : null}
              {isOrganizer && (
                <DisputeExportButton
                  groupId={groupId}
                  memberId={d.payer_user_id}
                  memberName={d.payer_name ?? "Membre"}
                />
              )}
            </li>
          ))}
        </ul>
      </article>
      {reporting && (
        <ReportDefaulterDialog
          open={!!reporting}
          onOpenChange={(o) => !o && setReporting(null)}
          contributionId={reporting.contribution_id}
          payerName={reporting.payer_name ?? "le membre"}
          groupId={groupId}
        />
      )}
    </>
  );
}