import { useQuery } from "@tanstack/react-query";
import { fetchPlatformKpis } from "@/lib/api/admin";
import { Users, UserPlus, Layers, Activity, TrendingUp, AlertTriangle, Trash2, Star } from "lucide-react";

function Kpi({ label, value, icon: Icon, tone = "default" }: { label: string; value: string | number; icon: React.ElementType; tone?: "default" | "warn" | "danger" }) {
  const toneClass =
    tone === "danger" ? "border-red-500/30 bg-red-500/5" :
    tone === "warn" ? "border-amber-500/30 bg-amber-500/5" :
    "border-slate-800 bg-slate-900";
  return (
    <div className={`rounded-lg border ${toneClass} p-4`}>
      <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider">
        <span>{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

export default function AdminOverview() {
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-kpis"], queryFn: fetchPlatformKpis });

  if (isLoading) return <p className="text-slate-400">Chargement…</p>;
  if (error) return <p className="text-red-400">Erreur : {(error as Error).message}</p>;
  if (!data) return null;

  const fmt = new Intl.NumberFormat("fr-FR");
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Utilisateurs" value={fmt.format(data.users_total)} icon={Users} />
        <Kpi label="Nouveaux (7j)" value={fmt.format(data.users_new_7d)} icon={UserPlus} />
        <Kpi label="Groupes actifs" value={fmt.format(data.groups_active)} icon={Layers} />
        <Kpi label="Groupes (total)" value={fmt.format(data.groups_total)} icon={Layers} />
        <Kpi label="Cycles en cours" value={fmt.format(data.cycles_open)} icon={Activity} />
        <Kpi label="Volume 30j (XOF)" value={fmt.format(data.volume_30d)} icon={TrendingUp} />
        <Kpi label="Échecs paiement (7j)" value={fmt.format(data.payment_failures_7d)} icon={AlertTriangle} tone={data.payment_failures_7d > 0 ? "warn" : "default"} />
        <Kpi label="Suppressions ouvertes" value={fmt.format(data.deletion_requests_open)} icon={Trash2} tone={data.deletion_requests_open > 0 ? "warn" : "default"} />
        <Kpi label="Fiabilité moyenne" value={`${data.reliability_avg}/100`} icon={Star} />
      </div>
      <p className="text-xs text-slate-500">Données rafraîchies à chaque chargement.</p>
    </div>
  );
}