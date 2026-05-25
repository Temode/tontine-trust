import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, UserPlus, Users, Calendar as CalendarIcon, Sparkles } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { GroupRow } from "@/components/dashboard/GroupRow";
import { ReliabilityCard } from "@/components/dashboard/ReliabilityCard";
import { useAuth } from "@/hooks/useAuth";
import { listMyGroups } from "@/lib/api/groups";
import { overviewToTontine } from "@/lib/api/types";

function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="rounded-xl border border-hairline bg-card p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-primary">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-foreground num">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </article>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["groups", "mine"],
    queryFn: listMyGroups,
  });

  const groups = useMemo(() => rows.map(overviewToTontine), [rows]);
  const activeCount = groups.filter((g) => g.status !== "completed").length;
  const preview = groups.slice(0, 5);

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "";

  return (
    <div className="animate-fade-in">
      <TopBar
        title={firstName ? `Bonjour, ${firstName}` : "Tableau de bord"}
        subtitle="Suivez vos tontines et organisez vos cotisations en toute simplicité."
        primaryAction={{
          label: "Créer un groupe",
          onClick: () => navigate("/nouveau"),
          icon: <Plus className="h-4 w-4" />,
        }}
        secondaryAction={{
          label: "Rejoindre",
          onClick: () => navigate("/rejoindre"),
          icon: <UserPlus className="h-4 w-4" />,
        }}
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        {/* KPI strip */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiTile
            icon={Users}
            label="Groupes actifs"
            value={String(activeCount)}
            hint={`${groups.length} au total`}
          />
          <KpiTile
            icon={CalendarIcon}
            label="Prochain tour"
            value="—"
            hint="Disponible bientôt"
          />
          <KpiTile
            icon={Sparkles}
            label="Score de fiabilité"
            value="100%"
            hint="Aucun retard"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            title="Mes groupes"
            subtitle={isLoading ? "Chargement…" : `${groups.length} groupe${groups.length > 1 ? "s" : ""}`}
            action={groups.length > 0 ? { label: "Voir tout", onClick: () => navigate("/groupes") } : undefined}
            bare
          >
            {isLoading ? (
              <p className="px-5 py-6 text-sm text-muted-foreground lg:px-6">Chargement…</p>
            ) : preview.length === 0 ? (
              <div className="px-5 py-10 text-center lg:px-6">
                <p className="text-sm text-muted-foreground">Vous n'avez encore aucun groupe.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate("/nouveau")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700"
                  >
                    <Plus className="h-4 w-4" /> Créer un groupe
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/rejoindre")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline bg-card px-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
                  >
                    <UserPlus className="h-4 w-4" /> Rejoindre avec un code
                  </button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {preview.map((g) => (
                  <li key={g.id}>
                    <GroupRow group={g} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <ReliabilityCard
            score={100}
            onTime={{ current: 0, total: 0 }}
            late={0}
            memberSince="—"
          />
        </div>
      </div>
    </div>
  );
}
