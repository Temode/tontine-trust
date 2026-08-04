import { useQuery } from "@tanstack/react-query";
import { listAuditLog } from "@/lib/api/admin";

export default function AdminAudit() {
  const q = useQuery({ queryKey: ["admin-audit"], queryFn: () => listAuditLog(300) });

  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-slate-400 text-xs uppercase">
          <tr>
            <th className="text-left px-3 py-2">Date</th>
            <th className="text-left px-3 py-2">Action</th>
            <th className="text-left px-3 py-2">Acteur</th>
            <th className="text-left px-3 py-2">Entité</th>
            <th className="text-left px-3 py-2">Métadonnées</th>
          </tr>
        </thead>
        <tbody>
          {q.isLoading && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Chargement…</td></tr>}
          {q.data?.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Aucune entrée</td></tr>}
          {q.data?.map((r) => (
            <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-900/50 align-top">
              <td className="px-3 py-2 text-slate-400 whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString("fr-FR")}</td>
              <td className="px-3 py-2"><span className="font-mono text-xs text-amber-300">{r.action}</span></td>
              <td className="px-3 py-2 text-slate-300 font-mono text-xs">{r.actor_user_id?.slice(0, 8) ?? "—"}</td>
              <td className="px-3 py-2 text-slate-300 text-xs">{r.entity_type} · {r.entity_id?.slice(0, 8) ?? "—"}</td>
              <td className="px-3 py-2 text-slate-400 text-xs font-mono max-w-md truncate">{r.metadata ? JSON.stringify(r.metadata) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}