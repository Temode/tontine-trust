import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listAdminUsers, adminSetUserRole, adminSuspendUser, type AppRole } from "@/lib/api/admin";
import { Shield, ShieldOff, UserX, UserCheck } from "lucide-react";

const ALL_ROLES: AppRole[] = ["super_admin", "admin", "organisateur", "participant"];

export default function AdminUsers() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const [search, setSearch] = useState("");
  const [committed, setCommitted] = useState("");

  const q = useQuery({ queryKey: ["admin-users", committed], queryFn: () => listAdminUsers(committed) });

  const rows = useMemo(() => {
    if (!focusId || !q.data) return q.data ?? [];
    return q.data.filter((u: any) => u.id === focusId);
  }, [q.data, focusId]);

  const roleM = useMutation({
    mutationFn: ({ id, role, grant }: { id: string; role: AppRole; grant: boolean }) =>
      adminSetUserRole(id, role, grant),
    onSuccess: () => { toast.success("Rôle mis à jour"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  const suspendM = useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) => adminSuspendUser(id, suspend),
    onSuccess: (_d, v) => { toast.success(v.suspend ? "Compte suspendu" : "Compte réactivé"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      {focusId && (
        <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2 text-sm">
          <span className="text-amber-200">
            Filtré sur l'utilisateur <code className="text-amber-300">{focusId}</code>
          </span>
          <Link to="/admin/utilisateurs" className="text-amber-300 hover:text-amber-200 underline text-xs">
            Retirer le filtre
          </Link>
        </div>
      )}
      <form
        className="flex gap-2 max-w-xl"
        onSubmit={(e) => { e.preventDefault(); setCommitted(search); }}
      >
        <Input
          placeholder="Rechercher email, nom, téléphone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-900 border-slate-700 text-white"
        />
        <Button type="submit" className="bg-amber-500 text-slate-900 hover:bg-amber-400">Rechercher</Button>
      </form>

      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Utilisateur</th>
              <th className="text-left px-3 py-2">Rôles</th>
              <th className="text-left px-3 py-2">Groupes</th>
              <th className="text-left px-3 py-2">Fiabilité</th>
              <th className="text-left px-3 py-2">État</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Chargement…</td></tr>}
            {rows.length === 0 && !q.isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  {focusId ? `Aucun utilisateur avec l'id ${focusId.slice(0, 8)}…` : "Aucun utilisateur"}
                </td>
              </tr>
            )}
            {rows.map((u) => {
              const roles = u.roles ?? [];
              const suspended = !!u.suspended_at;
              return (
                <tr
                  key={u.id}
                  className={`border-t border-slate-800 hover:bg-slate-900/50 ${u.id === focusId ? "bg-amber-500/5 ring-1 ring-amber-500/30" : ""}`}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-white">{u.full_name}</div>
                    <div className="text-xs text-slate-400">{u.email ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {roles.length === 0 && <span className="text-slate-500 text-xs">—</span>}
                      {roles.map((r) => (
                        <span key={r} className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">{r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{u.groups_count}</td>
                  <td className="px-3 py-2 text-slate-300">{u.reliability_score}/100</td>
                  <td className="px-3 py-2">
                    {suspended
                      ? <span className="text-xs text-red-400">Suspendu</span>
                      : <span className="text-xs text-emerald-400">Actif</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {ALL_ROLES.map((r) => {
                        const has = roles.includes(r);
                        return (
                          <Button
                            key={r}
                            size="sm"
                            variant="outline"
                            className={`h-7 px-2 text-[11px] border-slate-700 ${has ? "bg-amber-500/10 text-amber-300" : "bg-transparent text-slate-300"} hover:bg-slate-800`}
                            onClick={() => roleM.mutate({ id: u.id, role: r, grant: !has })}
                            disabled={roleM.isPending}
                            title={has ? `Retirer ${r}` : `Attribuer ${r}`}
                          >
                            {has ? <ShieldOff className="h-3 w-3 mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
                            {r}
                          </Button>
                        );
                      })}
                      <Button
                        size="sm"
                        variant="outline"
                        className={`h-7 px-2 text-[11px] border-slate-700 ${suspended ? "text-emerald-300" : "text-red-300"} hover:bg-slate-800`}
                        onClick={() => suspendM.mutate({ id: u.id, suspend: !suspended })}
                        disabled={suspendM.isPending}
                      >
                        {suspended ? <UserCheck className="h-3 w-3 mr-1" /> : <UserX className="h-3 w-3 mr-1" />}
                        {suspended ? "Réactiver" : "Suspendre"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}