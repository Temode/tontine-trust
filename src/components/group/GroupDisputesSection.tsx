import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, Scale, X } from "lucide-react";
import { listGroupDisputes, resolveDispute, type GroupDisputeRow, type DisputeStatus } from "@/lib/api/disputes";
import { canUserReportDefaulter } from "@/lib/api/defaulters";
import { useAuth } from "@/hooks/useAuth";
import { formatGNF } from "@/lib/format";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_CLS: Record<DisputeStatus, string> = {
  open: "bg-amber-500/15 text-amber-700",
  under_review: "bg-primary/15 text-primary",
  accepted: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  resolved: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<DisputeStatus, string> = {
  open: "Ouverte",
  under_review: "En revue",
  accepted: "Acceptée",
  rejected: "Rejetée",
  resolved: "Résolue",
};

export function GroupDisputesSection({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const permQ = useQuery({
    queryKey: ["can-report-defaulter", groupId, user?.id],
    queryFn: () => canUserReportDefaulter(groupId, user!.id),
    enabled: !!user?.id,
  });
  const q = useQuery({
    queryKey: ["group-disputes", groupId],
    queryFn: () => listGroupDisputes(groupId),
    enabled: !!permQ.data,
  });
  const [resolving, setResolving] = useState<GroupDisputeRow | null>(null);

  if (!permQ.data) return null;
  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-hairline bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des contestations…
      </div>
    );
  }
  if (!q.data || q.data.length === 0) return null;

  return (
    <>
      <article className="overflow-hidden rounded-xl border border-primary/30 bg-primary/[0.03]">
        <header className="flex items-center gap-2 border-b border-primary/15 bg-primary/[0.06] px-4 py-3">
          <Scale className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold text-primary">
            Contestations de membres ({q.data.length})
          </h3>
        </header>
        <ul className="divide-y divide-primary/10">
          {q.data.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {d.raised_by_name ?? "Membre"}
                  </p>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_CLS[d.status])}>
                    {STATUS_LABEL[d.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tour #{d.turn_number} · {formatGNF(d.amount)} GNF · {new Date(d.created_at).toLocaleDateString("fr-FR")}
                </p>
                <p className="mt-1.5 line-clamp-2 text-xs text-foreground/80">{d.reason}</p>
                {d.evidence_url && (
                  <a
                    href={d.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded"
                  >
                    Voir la preuve <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {d.organizer_response && (
                  <p className="mt-1.5 rounded border border-hairline bg-card p-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Votre réponse :</span> {d.organizer_response}
                  </p>
                )}
              </div>
              {(d.status === "open" || d.status === "under_review") && (
                <button
                  type="button"
                  onClick={() => setResolving(d)}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Traiter
                </button>
              )}
            </li>
          ))}
        </ul>
      </article>
      {resolving && (
        <ResolveDisputeDialog
          dispute={resolving}
          onClose={() => setResolving(null)}
          groupId={groupId}
        />
      )}
    </>
  );
}

function ResolveDisputeDialog({
  dispute, onClose, groupId,
}: { dispute: GroupDisputeRow; onClose: () => void; groupId: string }) {
  const qc = useQueryClient();
  const [response, setResponse] = useState(dispute.organizer_response ?? "");
  const [pending, setPending] = useState<DisputeStatus | null>(null);

  const m = useMutation({
    mutationFn: (status: Exclude<DisputeStatus, "open">) =>
      resolveDispute({ disputeId: dispute.id, status, response: response.trim() || undefined }),
    onSuccess: () => {
      toast.success("Contestation mise à jour");
      qc.invalidateQueries({ queryKey: ["group-disputes", groupId] });
      onClose();
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
    onSettled: () => setPending(null),
  });

  const act = (status: Exclude<DisputeStatus, "open">) => {
    setPending(status);
    m.mutate(status);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Répondre à la contestation
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-hairline bg-secondary/30 p-3 text-sm">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Motif du membre</p>
            <p className="mt-1 text-foreground">{dispute.reason}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="resp" className="text-sm font-medium">Votre réponse (visible par le membre)</label>
            <Textarea
              id="resp"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={4}
              placeholder="Justification de votre décision…"
            />
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose} disabled={m.isPending}>Fermer</Button>
          <Button variant="secondary" onClick={() => act("under_review")} disabled={m.isPending}>
            {pending === "under_review" && <Loader2 className="h-4 w-4 animate-spin" />}
            Mettre en revue
          </Button>
          <Button variant="destructive" onClick={() => act("rejected")} disabled={m.isPending}>
            {pending === "rejected" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Rejeter
          </Button>
          <Button onClick={() => act("accepted")} disabled={m.isPending}>
            {pending === "accepted" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Accepter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}