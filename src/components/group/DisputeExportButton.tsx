import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileWarning, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  getDisputeExport,
  requestDisputeExport,
  type DisputeExportRow,
} from "@/lib/api/disputeExports";

interface DisputeExportButtonProps {
  groupId: string;
  memberId: string;
  memberName: string;
}

/**
 * Bouton « Export de litige » + dialog motif. Lance la génération PDF,
 * affiche l'état et propose le téléchargement signé 24 h.
 */
export function DisputeExportButton({ groupId, memberId, memberName }: DisputeExportButtonProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [exportId, setExportId] = useState<string | null>(null);

  const statusQ = useQuery({
    queryKey: ["dispute-export", exportId],
    queryFn: () => (exportId ? getDisputeExport(exportId) : Promise.resolve(null)),
    enabled: !!exportId,
    refetchInterval: (data) => {
      const row = data as unknown as DisputeExportRow | null;
      return row && (row.status === "ready" || row.status === "failed") ? false : 3000;
    },
  });

  const create = useMutation({
    mutationFn: () => requestDisputeExport(groupId, memberId, reason.trim()),
    onSuccess: (id) => {
      toast.success("Export en cours de génération");
      setExportId(id);
      qc.invalidateQueries({ queryKey: ["dispute-exports", groupId] });
    },
    onError: (e) => toast.error("Demande impossible", { description: (e as Error).message }),
  });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-destructive/40 bg-card px-2 text-xs font-semibold text-destructive hover:bg-destructive/10">
        <FileWarning className="h-3.5 w-3.5" /> Export litige
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-background p-5 shadow-xl">
            <header className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Export de litige — {memberName}</h3>
              <button type="button" onClick={() => { setOpen(false); setExportId(null); setReason(""); }} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </header>
            {!exportId ? (
              <>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Motif (≥ 20 caractères)</label>
                <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-card p-2 text-sm"
                  placeholder="Ex. Non-paiement des cotisations 3 et 4 après mises en demeure SMS du 12/06 et 18/06." />
                <button type="button" disabled={reason.trim().length < 20 || create.isPending}
                  onClick={() => create.mutate()}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-destructive text-sm font-semibold text-destructive-foreground disabled:opacity-50">
                  {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileWarning className="h-4 w-4" />}
                  Demander l'export certifié
                </button>
              </>
            ) : (
              <ExportStatus row={statusQ.data ?? null} loading={statusQ.isLoading} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ExportStatus({ row, loading }: { row: DisputeExportRow | null; loading: boolean }) {
  if (loading || !row) return <p className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Préparation…</p>;
  if (row.status === "queued" || row.status === "processing") {
    return <p className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Génération en cours ({row.status})…</p>;
  }
  if (row.status === "failed") {
    return <p className="text-sm text-destructive">Échec : {row.error_message ?? "erreur inconnue"}</p>;
  }
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold text-emerald-700">Dossier prêt.</p>
      <p className="text-xs text-muted-foreground">SHA-256 : <span className="font-mono">{row.sha256?.slice(0, 32)}…</span></p>
      <p className="text-xs text-muted-foreground">URL valide jusqu'au {row.expires_at ? new Date(row.expires_at).toLocaleString("fr-FR") : "—"}</p>
      <a href={row.signed_url ?? "#"} target="_blank" rel="noreferrer"
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground">
        <Download className="h-4 w-4" /> Télécharger le PDF certifié
      </a>
    </div>
  );
}