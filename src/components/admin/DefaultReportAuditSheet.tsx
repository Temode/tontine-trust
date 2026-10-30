import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertOctagon, FileText, History, Loader2, ShieldAlert, ShieldCheck, UserCog,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  addReportInternalNote,
  getDefaultReportAudit,
  type DefaultReportAuditEntry,
  type DefaulterReportEnriched,
} from "@/lib/api/defaulters";
import { cn } from "@/lib/utils";

const ACTION_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  contribution_defaulted: { label: "Bascule en défaut", icon: AlertOctagon, cls: "text-destructive" },
  defaulter_reported: { label: "Signalement créé", icon: ShieldAlert, cls: "text-destructive" },
  defaulter_report_updated: { label: "Statut mis à jour", icon: UserCog, cls: "text-amber-500" },
  defaulter_note_added: { label: "Note interne ajoutée", icon: FileText, cls: "text-slate-400" },
  dispute_raised: { label: "Contestation membre", icon: ShieldAlert, cls: "text-primary" },
  dispute_resolved: { label: "Contestation résolue", icon: ShieldCheck, cls: "text-success" },
  dispute_accepted: { label: "Contestation acceptée", icon: ShieldCheck, cls: "text-success" },
  dispute_rejected: { label: "Contestation rejetée", icon: ShieldCheck, cls: "text-destructive" },
  dispute_under_review: { label: "Contestation en revue", icon: ShieldAlert, cls: "text-amber-500" },
};

interface Props {
  report: DefaulterReportEnriched | null;
  onClose: () => void;
}

export function DefaultReportAuditSheet({ report, onClose }: Props) {
  const open = !!report;
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const auditQ = useQuery<DefaultReportAuditEntry[]>({
    queryKey: ["report-audit", report?.id],
    queryFn: () => getDefaultReportAudit(report!.id),
    enabled: open,
  });

  const noteM = useMutation({
    mutationFn: () => addReportInternalNote(report!.id, note.trim()),
    onSuccess: () => {
      toast.success("Note ajoutée au dossier");
      setNote("");
      qc.invalidateQueries({ queryKey: ["report-audit", report?.id] });
      qc.invalidateQueries({ queryKey: ["admin-defaulter-reports"] });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-amber-400" />
            Journal du dossier
          </SheetTitle>
          <SheetDescription>
            Historique complet : qui a signalé, qui a mis à jour le statut, dates et notes internes.
          </SheetDescription>
        </SheetHeader>

        {report && (
          <div className="mt-4 rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs">
            <p className="font-semibold text-white">{report.reported_user_name ?? "Membre"}</p>
            <p className="mt-0.5 text-slate-400">
              {report.group_name} · tour #{report.turn_number ?? "—"} · {report.default_days ?? 0} j de retard
            </p>
          </div>
        )}

        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Chronologie
          </h3>
          {auditQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : !auditQ.data || auditQ.data.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune entrée d'audit.</p>
          ) : (
            <ol className="relative space-y-3 border-l border-slate-800 pl-4">
              {auditQ.data.map((e) => {
                const meta = ACTION_META[e.action] ?? {
                  label: e.action, icon: FileText, cls: "text-slate-400",
                };
                const Icon = meta.icon;
                const status = (e.metadata as any)?.status;
                const note = (e.metadata as any)?.note;
                return (
                  <li key={e.id} className="relative">
                    <span className={cn(
                      "absolute -left-[22px] flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 ring-2 ring-slate-800",
                      meta.cls,
                    )}>
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                    <p className="text-sm font-semibold text-white">{meta.label}</p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(e.created_at).toLocaleString("fr-FR")}
                      {" · "}
                      <span className="text-slate-300">{e.actor_name ?? "Système"}</span>
                      {e.actor_role && e.actor_role !== "member" && (
                        <span className="ml-1 rounded bg-amber-500/15 px-1 text-[10px] font-semibold uppercase text-amber-400">
                          {e.actor_role}
                        </span>
                      )}
                    </p>
                    {status && (
                      <p className="mt-1 text-[11px] text-slate-300">
                        Statut : <span className="font-mono font-semibold">{status}</span>
                      </p>
                    )}
                    {note && (
                      <p className="mt-1 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px] text-slate-200">
                        {note}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="mt-6 space-y-2 rounded-md border border-slate-800 bg-slate-900/40 p-3">
          <label htmlFor="audit-note" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Ajouter une note interne (sans changer le statut)
          </label>
          <Textarea
            id="audit-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Ex : appel passé à 14h32, le membre s'engage à payer demain."
          />
          <Button
            size="sm"
            onClick={() => noteM.mutate()}
            disabled={noteM.isPending || note.trim().length < 3}
          >
            {noteM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Ajouter la note
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}