import { useMemo, useState } from "react";
import { ArrowRight, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import type { DirectoryGroup, Frequency } from "@/lib/types";

type CategoryFilter = "all" | DirectoryGroup["category"];
type FrequencyFilter = "all" | Frequency;
type AmountBracket = "all" | "low" | "mid" | "high";
type SortKey = "starts" | "amount-asc" | "amount-desc" | "score" | "slots";

const CATEGORIES: Array<{ id: CategoryFilter; label: string }> = [
  { id: "all", label: "Toutes catégories" },
  { id: "family", label: "Famille" },
  { id: "professional", label: "Collègues" },
  { id: "business", label: "Commerçants" },
  { id: "community", label: "Communauté" },
];

const FREQUENCIES: Array<{ id: FrequencyFilter; label: string }> = [
  { id: "all", label: "Toutes" },
  { id: "Hebdomadaire", label: "Hebdo" },
  { id: "Quinzaine", label: "Quinzaine" },
  { id: "Mensuelle", label: "Mensuelle" },
];

const AMOUNTS: Array<{ id: AmountBracket; label: string }> = [
  { id: "all", label: "Tout montant" },
  { id: "low", label: "≤ 250k" },
  { id: "mid", label: "250k – 1M" },
  { id: "high", label: "> 1M" },
];

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: "starts", label: "Démarrage le plus proche" },
  { id: "amount-asc", label: "Cotisation croissante" },
  { id: "amount-desc", label: "Cotisation décroissante" },
  { id: "score", label: "Score moyen" },
  { id: "slots", label: "Places restantes" },
];

const CATEGORY_LABEL: Record<DirectoryGroup["category"], string> = {
  family: "Famille",
  professional: "Collègues",
  business: "Commerçants",
  community: "Communauté",
};

interface DirectoryProps {
  groups: DirectoryGroup[];
  onSelect: (group: DirectoryGroup) => void;
}

export function Directory({ groups, onSelect }: DirectoryProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [frequency, setFrequency] = useState<FrequencyFilter>("all");
  const [amount, setAmount] = useState<AmountBracket>("all");
  const [sort, setSort] = useState<SortKey>("starts");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const result = groups.filter((g) => {
      if (category !== "all" && g.category !== category) return false;
      if (frequency !== "all" && g.frequency !== frequency) return false;
      if (amount === "low" && g.contribution > 250_000) return false;
      if (amount === "mid" && (g.contribution <= 250_000 || g.contribution > 1_000_000)) return false;
      if (amount === "high" && g.contribution <= 1_000_000) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.organizerName.toLowerCase().includes(q) ||
        g.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    return [...result].sort((a, b) => {
      switch (sort) {
        case "amount-asc":
          return a.contribution - b.contribution;
        case "amount-desc":
          return b.contribution - a.contribution;
        case "score":
          return b.meanScore - a.meanScore;
        case "slots":
          return b.members - b.filled - (a.members - a.filled);
        case "starts":
        default:
          return a.startsInDays - b.startsInDays;
      }
    });
  }, [groups, query, category, frequency, amount, sort]);

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex flex-col gap-3 border-b border-hairline px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Annuaire des groupes ouverts</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            {filtered.length} {filtered.length > 1 ? "émissions disponibles" : "émission disponible"}
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Rechercher un groupe"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, description, organisateur, tag..."
            className="h-9 w-full rounded-md border border-hairline bg-secondary/40 pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/15 lg:w-72"
          />
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-5 py-3 lg:px-6">
        <Select label="Catégorie" value={category} options={CATEGORIES} onChange={(v) => setCategory(v as CategoryFilter)} />
        <Select label="Fréquence" value={frequency} options={FREQUENCIES} onChange={(v) => setFrequency(v as FrequencyFilter)} />
        <Select label="Montant" value={amount} options={AMOUNTS} onChange={(v) => setAmount(v as AmountBracket)} />
        <Select label="Tri" value={sort} options={SORT_OPTIONS} onChange={(v) => setSort(v as SortKey)} />
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm text-muted-foreground">
          Aucun groupe ne correspond à ces critères. Élargissez votre recherche ou patientez — de nouveaux
          groupes émergent chaque semaine.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:p-6 xl:grid-cols-3">
          {filtered.map((g) => (
            <DirectoryCard key={g.id} group={g} onSelect={() => onSelect(g)} />
          ))}
        </div>
      )}
    </article>
  );
}

function DirectoryCard({ group, onSelect }: { group: DirectoryGroup; onSelect: () => void }) {
  const slots = group.members - group.filled;
  const fillRate = Math.round((group.filled / group.members) * 100);
  const cagnotte = group.contribution * group.members;

  return (
    <article
      className={cn(
        "flex flex-col rounded-lg border bg-card transition hover:border-primary/40",
        slots <= 2 ? "border-warning/30" : "border-hairline",
      )}
    >
      <header className="border-b border-hairline px-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {CATEGORY_LABEL[group.category]}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              slots <= 2 ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
            )}
          >
            {slots} {slots > 1 ? "places" : "place"}
          </span>
        </div>
        <h3 className="mt-2 font-display text-base font-bold leading-tight text-foreground">{group.name}</h3>
        <p className="mt-1 mb-3 line-clamp-2 text-xs text-muted-foreground">{group.description}</p>
      </header>

      <dl className="grid grid-cols-2 gap-px border-b border-hairline bg-border">
        <div className="bg-card px-4 py-3">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Cotisation</dt>
          <dd className="mt-0.5 font-display text-sm font-bold text-foreground num">
            {formatGNF(group.contribution)} <span className="text-[11px] font-medium text-muted-foreground">GNF</span>
          </dd>
        </div>
        <div className="bg-card px-4 py-3">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Cagnotte</dt>
          <dd className="mt-0.5 font-display text-sm font-bold text-accent-700 num">
            {formatGNF(cagnotte, { compact: cagnotte >= 1_000_000 })}{" "}
            <span className="text-[11px] font-medium text-muted-foreground">GNF</span>
          </dd>
        </div>
        <div className="bg-card px-4 py-3">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Fréquence</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground">{group.frequency}</dd>
        </div>
        <div className="bg-card px-4 py-3">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Démarrage</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground">
            {group.startsInDays >= 0 ? formatRelativeDays(group.startsInDays) : "En cours"}
          </dd>
        </div>
      </dl>

      <div className="px-4 py-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span className="num text-foreground">{group.filled}/{group.members}</span> capacité
          </span>
          <span className="num text-foreground">{group.meanScore}% score moyen</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: `${fillRate}%` }} />
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-hairline bg-secondary/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
            {group.organizerInitials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-foreground">{group.organizerName}</p>
            <p className="text-[10px] text-muted-foreground">Score {group.organizerScore}%</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSelect}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
        >
          Voir
          <ArrowRight className="h-3 w-3" />
        </button>
      </footer>
    </article>
  );
}

interface SelectProps {
  label: string;
  value: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  onChange: (v: string) => void;
}

function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-hairline bg-card px-2 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 bg-transparent pr-1 text-xs font-medium text-foreground focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
