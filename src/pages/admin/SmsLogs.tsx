import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { listSmsLogs, type SmsLog } from "@/lib/api/smsLogs";
import { Search, RefreshCw, ExternalLink, User, ShieldAlert, ShieldCheck, Pause, Play, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const STATUS_TONE: Record<SmsLog["status"], string> = {
  sent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/30 bg-red-500/10 text-red-300",
  skipped: "border-slate-700 bg-slate-800 text-slate-400",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

const STATUS_LABEL: Record<SmsLog["status"], string> = {
  sent: "Envoyé",
  failed: "Échec",
  skipped: "Ignoré",
  pending: "En attente",
};

const KINDS = [
  { value: "all", label: "Tous les types" },
  { value: "manual_admin_test", label: "Test admin" },
  { value: "payment_confirmed", label: "Paiement confirmé" },
  { value: "turn_upcoming_j2", label: "Tour J-2" },
  { value: "contribution_due_j1", label: "Cotisation J-1" },
  { value: "preview_j2", label: "Aperçu cron J-2" },
  { value: "preview_j1", label: "Aperçu cron J-1" },
];

export default function AdminSmsLogs() {
  const [status, setStatus] = useState<SmsLog["status"] | "all">("all");
  const [kind, setKind] = useState<string>("all");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const control = useQuery({
    queryKey: ["admin-sms-control"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sms-control", { method: "GET" });
      if (error) throw error;
      return data as { paused: boolean; min_balance: number; max_per_run: number; balance: number | null };
    },
    refetchInterval: 30_000,
  });

  const togglePause = useMutation({
    mutationFn: async (paused: boolean) => {
      const { data, error } = await supabase.functions.invoke("sms-control", {
        method: "POST",
        body: { paused },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-sms-control"] }),
  });

  // Compteur de la file sms_outbox (doctrine Paxefy : 1 ligne = 1 SMS à envoyer)
  const outbox = useQuery({
    queryKey: ["admin-sms-outbox"],
    queryFn: async () => {
      const counts = await Promise.all(
        (["queued", "processing", "failed"] as const).map(async (s) => {
          const { count } = await (supabase as any)
            .from("sms_outbox")
            .select("id", { head: true, count: "exact" })
            .eq("status", s);
          return [s, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(counts) as Record<"queued" | "processing" | "failed", number>;
    },
    refetchInterval: 30_000,
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-sms-logs", status, kind, search],
    queryFn: () => listSmsLogs({ status, kind, search, limit: 200 }),
  });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Journal SMS</h1>
          <p className="text-sm text-slate-400 mt-1">
            200 dernières tentatives d'envoi (manuel, paiements, rappels cron).
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-sm hover:bg-slate-700"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Rafraîchir
        </button>
      </header>

      {/* Carte État SMS : kill-switch + solde Nimba */}
      {control.data && (() => {
        const c = control.data;
        const low = c.balance !== null && c.balance < c.min_balance;
        return (
          <div className={`rounded-xl border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3
            ${c.paused ? "border-amber-500/40 bg-amber-500/5"
              : low ? "border-red-500/40 bg-red-500/5"
              : "border-emerald-500/30 bg-emerald-500/5"}`}>
            <div className="flex items-center gap-3">
              {c.paused ? <ShieldAlert className="h-5 w-5 text-amber-400" />
                : low ? <ShieldAlert className="h-5 w-5 text-red-400" />
                : <ShieldCheck className="h-5 w-5 text-emerald-400" />}
              <div>
                <div className="text-sm font-medium text-white">
                  {c.paused ? "Envois SMS suspendus (kill-switch actif)"
                    : low ? "Solde Nimba sous le seuil — envois bloqués"
                    : "Envois SMS opérationnels"}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Solde Nimba : <span className={low ? "text-red-300 font-medium" : "text-slate-200"}>
                    {c.balance === null ? "—" : c.balance}
                  </span>
                  {" "}· Seuil min : {c.min_balance}
                  {" "}· Plafond/exécution : {c.max_per_run}
                </div>
              </div>
            </div>
            <button
              onClick={() => togglePause.mutate(!c.paused)}
              disabled={togglePause.isPending}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border
                ${c.paused
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"}`}
            >
              {c.paused ? <><Play className="h-4 w-4" /> Reprendre les envois</>
                        : <><Pause className="h-4 w-4" /> Mettre en pause</>}
            </button>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            placeholder="Rechercher (numéro, contenu)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-md pl-10 pr-3 py-2 text-sm text-white placeholder-slate-600"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
        >
          <option value="all">Tous les statuts</option>
          <option value="sent">Envoyé</option>
          <option value="failed">Échec</option>
          <option value="skipped">Ignoré</option>
          <option value="pending">En attente</option>
        </select>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-slate-400">Chargement…</p>}
      {error && <p className="text-red-400">Erreur : {(error as Error).message}</p>}

      {data && (
        <div className="rounded-lg border border-slate-800 overflow-hidden bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Statut</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Destinataire</th>
                <th className="text-left px-4 py-2">Contexte</th>
                <th className="text-left px-4 py-2">Message</th>
                <th className="text-left px-4 py-2">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Aucune entrée pour ces filtres.
                  </td>
                </tr>
              )}
              {data.map((row) => (
                <tr key={row.id} className="border-t border-slate-800 align-top">
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                    {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: fr })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full border text-xs ${STATUS_TONE[row.status]}`}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{row.kind}</td>
                  <td className="px-4 py-3 font-mono text-slate-200 whitespace-nowrap">
                    {row.recipient_normalized ?? row.recipient}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col gap-1.5">
                      {row.group ? (
                        <Link
                          to={`/groupes/${row.group.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-medium"
                          title={row.group.name}
                        >
                          <ExternalLink className="h-3 w-3" /> Voir la tontine
                        </Link>
                      ) : (
                        <span className="text-slate-600 text-xs">— tontine</span>
                      )}
                      {row.user_id ? (
                        <Link
                          to={`/admin/utilisateurs?focus=${row.user_id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs"
                          title={row.profile?.full_name ?? row.user_id}
                        >
                          <User className="h-3 w-3" /> Voir le membre
                        </Link>
                      ) : (
                        <span className="text-slate-600 text-xs">— membre</span>
                      )}
                      {(row.group?.name || row.profile?.full_name) && (
                        <span className="text-[10px] text-slate-500 truncate max-w-[180px]">
                          {[row.group?.name, row.profile?.full_name].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 max-w-md">
                    <span className="line-clamp-2">{row.body}</span>
                  </td>
                  <td className="px-4 py-3 text-red-300 max-w-xs">
                    {row.error ? <span className="line-clamp-2">{row.error}</span> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}