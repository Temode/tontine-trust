import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { listSmsLogs, type SmsLog } from "@/lib/api/smsLogs";
import { Search, RefreshCw } from "lucide-react";

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
];

export default function AdminSmsLogs() {
  const [status, setStatus] = useState<SmsLog["status"] | "all">("all");
  const [kind, setKind] = useState<string>("all");
  const [search, setSearch] = useState("");

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
                <th className="text-left px-4 py-2">Message</th>
                <th className="text-left px-4 py-2">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
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