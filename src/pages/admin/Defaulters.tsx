import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listTontineAlerts, type TontineAlert } from "@/lib/api/integrity";
import {
  AlertOctagon,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Scale,
  Loader2,
  ExternalLink,
  History,
} from "lucide-react";
import { toast } from "sonner";
import {
  listAllDefaulterReports,
  updateDefaulterReport,
  type DefaulterReportEnriched,
} from "@/lib/api/defaulters";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { DefaultReportAuditSheet } from "@/components/admin/DefaultReportAuditSheet";

type StatusFilter = "all" | "open" | "in_review" | "legal_action" | "resolved" | "dismissed";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "open", label: "Ouverts" },
  { key: "in_review", label: "En traitement" },
  { key: "legal_action", label: "Procédure" },
  { key: "resolved", label: "Résolus" },
  { key: "dismissed", label: "Rejetés" },
  { key: "all", label: "Tous" },
];

const STATUS_STYLES: Record<string, string> = {
  open: "bg-destructive/15 text-destructive",
  in_review: "bg-amber-500/15 text-amber-600",
  legal_action: "bg-purple-500/15 text-purple-400",
  resolved: "bg-emerald-500/15 text-emerald-400",
  dismissed: "bg-slate-500/15 text-slate-400",
};

export default function AdminDefaulters() {
  const [filter, setFilter] = useState<StatusFilter>("open");
  const [selected, setSelected] = useState<DefaulterReportEnriched | null>(null);
  const [auditing, setAuditing] = useState<DefaulterReportEnriched | null>(null);
  const qc = useQueryClient();

  const lateAlertsQ = useQuery({
    queryKey: ["admin-late-alerts"],
    queryFn: async () => {
      const all = await listTontineAlerts(false);
      return all.filter((a) => a.code === "late_contribution");
    },
    refetchInterval: 60_000,
  });

  const relaunchM = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("enqueue_late_payment_alerts");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`${n ?? 0} relance(s) envoyée(s)`);
      qc.invalidateQueries({ queryKey: ["admin-late-alerts"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const q = useQuery({
    queryKey: ["admin-defaulter-reports"],
    queryFn: listAllDefaulterReports,
  });

  const rows = useMemo(() => {
    const all = q.data ?? [];
    const filtered = filter === "all" ? all : all.filter((r) => r.status === filter);
    // tri criticité : montant × jours
    return [...filtered].sort((a, b) => {
      const crit = (r: DefaulterReportEnriched) =>
        (r.contribution_amount ?? 0) * (r.default_days ?? 1);
      return crit(b) - crit(a);
    });
  }, [q.data, filter]);

  const counters = useMemo(() => {
    const all = q.data ?? [];
    return {
      open: all.filter((r) => r.status === "open").length,
      in_review: all.filter((r) => r.status === "in_review").length,
      legal_action: all.filter((r) => r.status === "legal_action").length,
    };
  }, [q.data]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-amber-300">
            Défaillants
          </h1>
          <p className="text-sm text-slate-400">
            Signalements officiels nécessitant l'intervention de l'équipe Tontine.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <KpiPill icon={<AlertOctagon className="h-3.5 w-3.5" />} label="Ouverts" value={counters.open} tone="destructive" />
          <KpiPill icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Traitement" value={counters.in_review} tone="amber" />
          <KpiPill icon={<Scale className="h-3.5 w-3.5" />} label="Procédure" value={counters.legal_action} tone="purple" />
        </div>
      </header>

      <div className="flex flex-wrap gap-1 rounded-md border border-slate-800 bg-slate-900/40 p-1">
        {STATUS_TABS.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              aria-pressed={active}
              onClick={() => setFilter(t.key)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                active ? "bg-amber-400/15 text-amber-300" : "text-slate-400 hover:text-white",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Membre</th>
              <th className="px-3 py-2 text-left">Groupe</th>
              <th className="px-3 py-2 text-right">Montant</th>
              <th className="px-3 py-2 text-center">Retard</th>
              <th className="px-3 py-2 text-center">KYC</th>
              <th className="px-3 py-2 text-left">Statut</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Chargement…</td></tr>
            )}
            {!q.isLoading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Aucun signalement</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-900/50">
                <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold text-white">{r.reported_user_name ?? "—"}</div>
                  {r.reported_user_phone && (
                    <div className="text-[11px] text-slate-400 font-mono">{r.reported_user_phone}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link to={`/admin/groupes`} className="text-amber-300 hover:underline inline-flex items-center gap-1">
                    {r.group_name ?? "—"} <ExternalLink className="h-3 w-3" />
                  </Link>
                </td>
                <td className="px-3 py-2 text-right font-mono text-white">
                  {r.contribution_amount?.toLocaleString("fr-FR") ?? "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[11px] font-semibold text-destructive">
                    {r.default_days ?? "—"} j
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <KycBadge status={r.kyc_status} />
                </td>
                <td className="px-3 py-2">
                  <span className={cn("rounded px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLES[r.status])}>
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {r.reported_user_phone && (
                    <a
                      href={`tel:${r.reported_user_phone}`}
                      className="mr-1 inline-flex h-7 items-center gap-1 rounded border border-slate-700 px-2 text-xs text-emerald-400 hover:bg-slate-800"
                    >
                      <Phone className="h-3 w-3" /> Appeler
                    </a>
                  )}
                  <button
                    onClick={() => setAuditing(r)}
                    className="mr-1 inline-flex h-7 items-center gap-1 rounded border border-slate-700 px-2 text-xs text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    title="Voir le journal d'audit"
                  >
                    <History className="h-3 w-3" /> Audit
                  </button>
                  <button
                    onClick={() => setSelected(r)}
                    className="inline-flex h-7 items-center gap-1 rounded bg-amber-400 px-2 text-xs font-semibold text-slate-900 hover:bg-amber-300"
                  >
                    Traiter
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <ReportDetailDialog report={selected} onClose={() => setSelected(null)} />
      )}

      <DefaultReportAuditSheet report={auditing} onClose={() => setAuditing(null)} />
    </div>
  );
}

function KpiPill({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "destructive" | "amber" | "purple" }) {
  const map = {
    destructive: "border-destructive/40 bg-destructive/10 text-destructive",
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    purple: "border-purple-500/40 bg-purple-500/10 text-purple-400",
  };
  return (
    <div className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1.5", map[tone])}>
      {icon}
      <span className="font-semibold">{value}</span>
      <span className="text-[10px] uppercase tracking-wider opacity-70">{label}</span>
    </div>
  );
}

function KycBadge({ status }: { status: string | null }) {
  const s = status ?? "none";
  const styles: Record<string, string> = {
    verified: "bg-emerald-500/15 text-emerald-400",
    pending: "bg-amber-500/15 text-amber-400",
    rejected: "bg-destructive/15 text-destructive",
    none: "bg-slate-700/40 text-slate-400",
  };
  const labels: Record<string, string> = {
    verified: "✓ Vérifié",
    pending: "En cours",
    rejected: "Rejeté",
    none: "Non KYC",
  };
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", styles[s])}>
      {labels[s]}
    </span>
  );
}

function ReportDetailDialog({ report, onClose }: { report: DefaulterReportEnriched; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(report.status);
  const [notes, setNotes] = useState(report.internal_notes ?? "");
  const [resolution, setResolution] = useState(report.resolution_note ?? "");

  const m = useMutation({
    mutationFn: () => updateDefaulterReport({
      reportId: report.id,
      status,
      internalNotes: notes,
      resolutionNote: resolution,
    }),
    onSuccess: () => {
      toast.success("Signalement mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-defaulter-reports"] });
      onClose();
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Signalement · {report.reported_user_name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Groupe" value={report.group_name ?? "—"} />
          <Field label="Téléphone" value={report.reported_user_phone ?? "—"} mono />
          <Field label="Tour" value={report.turn_number ? `#${report.turn_number}` : "—"} />
          <Field label="Échéance" value={report.due_date ? new Date(report.due_date).toLocaleDateString("fr-FR") : "—"} />
          <Field label="Montant" value={report.contribution_amount != null ? `${report.contribution_amount.toLocaleString("fr-FR")} GNF` : "—"} />
          <Field label="Retard" value={`${report.default_days ?? 0} j`} />
          <Field label="KYC" value={report.kyc_status ?? "none"} />
          <Field label="Signalé par" value={report.reported_by_name ?? "—"} />
        </div>

        {report.reason && (
          <div className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Motif organisateur</p>
            <p className="mt-1 text-sm text-slate-200">{report.reason}</p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Statut</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            >
              <option value="open">Ouvert</option>
              <option value="in_review">En traitement</option>
              <option value="legal_action">Procédure judiciaire</option>
              <option value="resolved">Résolu</option>
              <option value="dismissed">Rejeté</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notes internes (équipe Tontine)</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Appel passé, réponse du membre, prochaine action…" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Message de résolution (visible par l'organisateur et le membre)</label>
            <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn("mt-0.5 text-sm font-semibold text-white", mono && "font-mono")}>{value}</p>
    </div>
  );
}