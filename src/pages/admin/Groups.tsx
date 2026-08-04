import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listAdminGroups, adminForceGroupStatus } from "@/lib/api/admin";
import { Pause, Play, Archive } from "lucide-react";

function StatusBadge({ status, deleted, archived, paused }: { status: string; deleted: boolean; archived: boolean; paused: boolean }) {
  let cls = "bg-slate-800 text-slate-300";
  let label = status;
  if (deleted) { cls = "bg-red-500/15 text-red-300 border border-red-500/30"; label = "supprimé"; }
  else if (archived) { cls = "bg-slate-700/40 text-slate-300"; label = "archivé"; }
  else if (paused) { cls = "bg-amber-500/15 text-amber-300 border border-amber-500/30"; label = "en pause"; }
  else if (status === "active") { cls = "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"; }
  return <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${cls}`}>{label}</span>;
}

export default function AdminGroups() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [committed, setCommitted] = useState("");

  const q = useQuery({ queryKey: ["admin-groups", committed], queryFn: () => listAdminGroups(committed) });

  const actM = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "pause" | "resume" | "archive" }) =>
      adminForceGroupStatus(id, action),
    onSuccess: () => { toast.success("Action effectuée"); qc.invalidateQueries({ queryKey: ["admin-groups"] }); },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <form className="flex gap-2 max-w-xl" onSubmit={(e) => { e.preventDefault(); setCommitted(search); }}>
        <Input placeholder="Rechercher un groupe…" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-slate-900 border-slate-700 text-white" />
        <Button type="submit" className="bg-amber-500 text-slate-900 hover:bg-amber-400">Rechercher</Button>
      </form>

      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Groupe</th>
              <th className="text-left px-3 py-2">Organisateur</th>
              <th className="text-left px-3 py-2">Membres</th>
              <th className="text-left px-3 py-2">Cotisation</th>
              <th className="text-left px-3 py-2">Volume</th>
              <th className="text-left px-3 py-2">État</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Chargement…</td></tr>}
            {q.data?.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Aucun groupe</td></tr>}
            {q.data?.map((g) => (
              <tr key={g.id} className="border-t border-slate-800 hover:bg-slate-900/50">
                <td className="px-3 py-2">
                  <div className="font-medium text-white">{g.name}</div>
                  <div className="text-xs text-slate-500">{g.frequency} · {g.max_members} places</div>
                </td>
                <td className="px-3 py-2 text-slate-300">{g.organizer_name ?? "—"}</td>
                <td className="px-3 py-2 text-slate-300">{g.members_count}</td>
                <td className="px-3 py-2 text-slate-300">{Intl.NumberFormat("fr-FR").format(g.contribution_amount)} XOF</td>
                <td className="px-3 py-2 text-slate-300">{Intl.NumberFormat("fr-FR").format(g.volume_total)} XOF</td>
                <td className="px-3 py-2">
                  <StatusBadge status={g.status} deleted={!!g.deleted_at} archived={!!g.archived_at} paused={!!g.paused_at} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    {g.paused_at ? (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] border-slate-700 text-emerald-300 hover:bg-slate-800" disabled={actM.isPending} onClick={() => actM.mutate({ id: g.id, action: "resume" })}>
                        <Play className="h-3 w-3 mr-1" />Reprendre
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] border-slate-700 text-amber-300 hover:bg-slate-800" disabled={actM.isPending || !!g.deleted_at || !!g.archived_at} onClick={() => actM.mutate({ id: g.id, action: "pause" })}>
                        <Pause className="h-3 w-3 mr-1" />Pause
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] border-slate-700 text-slate-300 hover:bg-slate-800" disabled={actM.isPending || !!g.archived_at || !!g.deleted_at} onClick={() => actM.mutate({ id: g.id, action: "archive" })}>
                      <Archive className="h-3 w-3 mr-1" />Archiver
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}