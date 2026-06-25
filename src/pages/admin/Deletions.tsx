import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listAdminQueue, adminDecideDeletion } from "@/lib/api/deletion";

export default function AdminDeletions() {
  const qc = useQueryClient();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const q = useQuery({ queryKey: ["admin-deletion-queue"], queryFn: listAdminQueue });

  const decideM = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      adminDecideDeletion(id, approve, reason),
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Suppression approuvée" : "Demande refusée");
      qc.invalidateQueries({ queryKey: ["admin-deletion-queue"] });
    },
    onError: (e: Error) => toast.error("Impossible", { description: e.message }),
  });

  if (q.isLoading) return <p className="text-slate-400">Chargement…</p>;
  if (q.data?.length === 0)
    return <p className="text-slate-400">Aucune demande en attente.</p>;

  return (
    <div className="space-y-4 max-w-4xl">
      {q.data?.map((r) => (
        <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">{r.group_name}</h3>
              <p className="text-xs text-slate-500">Demandée le {new Date(r.created_at).toLocaleString("fr-FR")}</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div><strong className="text-emerald-300">{r.yes_votes}</strong> oui · <strong className="text-red-300">{r.no_votes}</strong> non</div>
              <div>{r.active_members} membres actifs</div>
            </div>
          </div>
          <div className="text-sm text-slate-300">
            <div><span className="text-slate-500">Organisateur :</span> {r.requester_name ?? "—"}</div>
            <div><span className="text-slate-500">Motif :</span> {r.reason}</div>
            <div className="text-xs text-slate-500 mt-1">{Intl.NumberFormat("fr-FR").format(r.contribution_amount)} XOF · {r.frequency} · {r.max_members} places</div>
          </div>
          <Textarea
            placeholder="Motif de décision (optionnel)"
            value={reasons[r.id] ?? ""}
            onChange={(e) => setReasons((s) => ({ ...s, [r.id]: e.target.value }))}
            rows={2}
            className="bg-slate-950 border-slate-700 text-slate-100"
          />
          <div className="flex gap-2">
            <Button
              className="bg-red-600 hover:bg-red-500 text-white"
              onClick={() => decideM.mutate({ id: r.id, approve: true, reason: reasons[r.id] })}
              disabled={decideM.isPending}
            >
              Approuver la suppression
            </Button>
            <Button
              variant="outline"
              className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"
              onClick={() => decideM.mutate({ id: r.id, approve: false, reason: reasons[r.id] })}
              disabled={decideM.isPending}
            >
              Refuser
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}