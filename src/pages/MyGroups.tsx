import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { EmptyState } from "@/components/groups/EmptyState";
import { GroupsGrid } from "@/components/groups/GroupsGrid";
import { GroupsKpiStrip } from "@/components/groups/GroupsKpiStrip";
import { GroupsTable } from "@/components/groups/GroupsTable";
import { GroupsToolbar } from "@/components/groups/GroupsToolbar";
import type { GroupsFilter, SortDir, SortKey, ViewMode } from "@/components/groups/types";
import { getPortfolioStats } from "@/lib/mock-data";
import { listMyGroups } from "@/lib/api/groups";
import { listMyApplications, cancelMyApplication } from "@/lib/api/groups";
import { overviewToTontine } from "@/lib/api/types";
import { ApplicationsList } from "@/components/join-group/ApplicationsList";
import { useQueryClient } from "@tanstack/react-query";
import type { TontineGroup } from "@/lib/types";
import { toast } from "sonner";

const STATUS_DEFAULT_DIRS: Record<SortKey, SortDir> = {
  name: "asc",
  members: "desc",
  contribution: "desc",
  totalCollected: "desc",
  progress: "desc",
  deadline: "asc",
  score: "desc",
};

function compareGroups(a: TontineGroup, b: TontineGroup, sort: SortKey, dir: SortDir): number {
  const factor = dir === "asc" ? 1 : -1;
  switch (sort) {
    case "name":
      return a.name.localeCompare(b.name, "fr") * factor;
    case "members":
      return (a.members - b.members) * factor;
    case "contribution":
      return (a.contribution - b.contribution) * factor;
    case "totalCollected":
      return (a.totalCollected - b.totalCollected) * factor;
    case "progress":
      return (a.progress - b.progress) * factor;
    case "score":
      return (a.averageScore - b.averageScore) * factor;
    case "deadline": {
      const ad = a.daysToDeadline ?? Number.POSITIVE_INFINITY;
      const bd = b.daysToDeadline ?? Number.POSITIVE_INFINITY;
      return (ad - bd) * factor;
    }
    default:
      return 0;
  }
}

function toCsv(groups: TontineGroup[]): string {
  const headers = [
    "Nom",
    "Statut",
    "Rôle",
    "Membres",
    "Fréquence",
    "Cotisation (GNF)",
    "Cagnotte (GNF)",
    "Progression (%)",
    "Bénéficiaire actuel",
    "Prochaine échéance",
    "Score moyen (%)",
  ];
  const rows = groups.map((g) =>
    [
      g.name,
      g.status,
      g.role,
      g.members,
      g.frequency,
      g.contribution,
      g.totalCollected,
      g.progress,
      g.currentTurn,
      g.nextPaymentDate,
      g.averageScore,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

export default function MyGroups() {
  const navigate = useNavigate();
  const portfolio = getPortfolioStats();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GroupsFilter>("all");
  const [sort, setSort] = useState<SortKey>("deadline");
  const [sortDir, setSortDir] = useState<SortDir>(STATUS_DEFAULT_DIRS.deadline);
  const [view, setView] = useState<ViewMode>("table");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["groups", "mine"],
    queryFn: listMyGroups,
  });

  const queryClient = useQueryClient();
  const { data: applications = [] } = useQuery({
    queryKey: ["applications", "mine"],
    queryFn: listMyApplications,
  });

  const handleCancelApplication = async (groupId: string) => {
    try {
      await cancelMyApplication(groupId);
      toast.success("Candidature retirée");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["applications", "mine"] }),
        queryClient.invalidateQueries({ queryKey: ["groups", "mine"] }),
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error("Impossible de retirer la candidature", { description: msg });
    }
  };

  const allGroups = useMemo<TontineGroup[]>(() => rows.map(overviewToTontine), [rows]);

  const counts = useMemo<Record<GroupsFilter, number>>(() => {
    const base: Record<GroupsFilter, number> = {
      all: allGroups.length,
      active: 0,
      "your-turn": 0,
      completed: 0,
      pending: 0,
    };
    for (const g of allGroups) base[g.status]++;
    return base;
  }, [allGroups]);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const result = allGroups.filter((g) => {
      if (filter !== "all" && g.status !== filter) return false;
      if (!normalizedQuery) return true;
      return (
        g.name.toLowerCase().includes(normalizedQuery) ||
        g.currentTurn.toLowerCase().includes(normalizedQuery) ||
        g.frequency.toLowerCase().includes(normalizedQuery)
      );
    });
    return [...result].sort((a, b) => compareGroups(a, b, sort, sortDir));
  }, [allGroups, query, filter, sort, sortDir]);

  const handleSortChange = (key: SortKey) => {
    if (key === sort) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setSortDir(STATUS_DEFAULT_DIRS[key]);
    }
  };

  const handleExport = () => {
    const csv = toCsv(filteredGroups);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tontine-groupes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Export terminé", { description: `${filteredGroups.length} groupes exportés.` });
  };

  const isFiltered = filter !== "all" || query.trim() !== "";

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Mes groupes"
        subtitle="Suivi consolidé de votre portefeuille de tontines."
        primaryAction={{
          label: "Créer un groupe",
          onClick: () => navigate("/nouveau"),
          icon: <Plus className="h-4 w-4" />,
        }}
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <GroupsKpiStrip stats={portfolio} />

        {applications.length > 0 && (
          <ApplicationsList applications={applications} onCancel={handleCancelApplication} />
        )}

        <GroupsToolbar
          query={query}
          onQueryChange={setQuery}
          filter={filter}
          onFilterChange={setFilter}
          counts={counts}
          sort={sort}
          onSortChange={(s) => {
            setSort(s);
            setSortDir(STATUS_DEFAULT_DIRS[s]);
          }}
          view={view}
          onViewChange={setView}
          onExport={handleExport}
        />

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : filteredGroups.length === 0 ? (
          <EmptyState
            filtered={isFiltered}
            onClearFilters={() => {
              setFilter("all");
              setQuery("");
            }}
          />
        ) : view === "table" ? (
          <GroupsTable groups={filteredGroups} sort={sort} sortDir={sortDir} onSortChange={handleSortChange} />
        ) : (
          <GroupsGrid groups={filteredGroups} />
        )}

        <p className="text-[11px] text-muted-foreground">
          {filteredGroups.length} {filteredGroups.length > 1 ? "groupes" : "groupe"} affichés · Données en direct depuis votre registre Tontine Digital.
        </p>
      </div>
    </div>
  );
}
