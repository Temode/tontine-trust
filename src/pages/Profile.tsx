import { LogOut, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/TopBar";
import { ReliabilityCard } from "@/components/dashboard/ReliabilityCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { useAuth } from "@/hooks/useAuth";
import {
  getMyReliability,
  listMyLateContributions,
  recomputeMyReliability,
} from "@/lib/api/reliability";
import { formatGNF } from "@/lib/format";

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: reliability } = useQuery({
    queryKey: ["reliability", "mine"],
    queryFn: getMyReliability,
  });
  const { data: lates = [] } = useQuery({
    queryKey: ["reliability", "lates"],
    queryFn: listMyLateContributions,
  });
  const recompute = useMutation({
    mutationFn: recomputeMyReliability,
    onSuccess: () => {
      toast.success("Score mis à jour");
      qc.invalidateQueries({ queryKey: ["reliability"] });
    },
    onError: (e: Error) => toast.error("Recalcul impossible", { description: e.message }),
  });

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Utilisateur";
  const phone = (user?.user_metadata?.phone_number as string | undefined) ?? "—";
  const email = user?.email ?? "—";
  const initials = fullName
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Vous êtes déconnecté.");
    navigate("/auth", { replace: true });
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Mon profil"
        subtitle="Vos informations personnelles et votre fiabilité."
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <article className="flex items-center gap-4 rounded-xl border border-hairline bg-card p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
            {initials || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold text-foreground">{fullName}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
            <p className="truncate text-xs text-muted-foreground">{phone}</p>
          </div>
        </article>

        <ReliabilityCard
          score={reliability?.score ?? 0}
          tier={reliability?.tier ?? "nouveau"}
          onTime={{
            current: reliability?.total_on_time ?? 0,
            total: reliability?.total_paid ?? 0,
          }}
          late={reliability?.total_late ?? 0}
          avgDelay={reliability?.avg_delay_days ?? 0}
          memberSince={
            user?.created_at
              ? new Date(user.created_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
              : "—"
          }
        />

        <button
          type="button"
          onClick={() => recompute.mutate()}
          disabled={recompute.isPending}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-hairline bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${recompute.isPending ? "animate-spin" : ""}`} />
          {recompute.isPending ? "Recalcul…" : "Recalculer mon score"}
        </button>

        {lates.length > 0 && (
          <SectionCard title="Historique des retards" subtitle={`${lates.length} cotisation${lates.length > 1 ? "s" : ""} en retard`} bare>
            <ul className="divide-y divide-border/60">
              {lates.map((l) => (
                <li key={l.contribution_id} className="flex items-center gap-3 px-5 py-3 lg:px-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{l.group_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Tour #{l.turn_number} · échéance {new Date(l.due_date).toLocaleDateString("fr-FR")} ·{" "}
                      <span className="font-semibold text-destructive">+{l.delay_days} j</span>
                    </p>
                  </div>
                  <p className="font-display text-sm font-semibold text-foreground num">
                    {formatGNF(l.amount)} GNF
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-hairline bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}