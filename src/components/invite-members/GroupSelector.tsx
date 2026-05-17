import { ChevronDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { TontineGroup } from "@/lib/types";

interface GroupSelectorProps {
  groups: TontineGroup[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function GroupSelector({ groups, selectedId, onSelect }: GroupSelectorProps) {
  const selected = groups.find((g) => g.id === selectedId) ?? groups[0];
  if (!selected) return null;

  const turnsCompleted = Math.round((selected.progress / 100) * selected.members);
  const slots = Math.max(0, selected.members - turnsCompleted);

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex flex-col gap-3 border-b border-hairline px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Users className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Émission en cours de placement
            </p>
            <h2 className="font-display text-base font-bold text-foreground lg:text-lg">{selected.name}</h2>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 rounded-md border border-hairline bg-secondary/40 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Distribuer pour
          </span>
          <div className="relative">
            <select
              aria-label="Choisir le groupe à distribuer"
              value={selected.id}
              onChange={(e) => onSelect(e.target.value)}
              className="h-7 appearance-none bg-transparent pl-2 pr-6 text-sm font-semibold text-foreground focus:outline-none"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </label>
      </header>

      <dl className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        <Field
          label="Cotisation"
          value={
            <>
              <span className="num">{formatGNF(selected.contribution)}</span>{" "}
              <span className="text-[11px] font-medium text-muted-foreground">GNF</span>
            </>
          }
        />
        <Field
          label="Cagnotte / tour"
          value={
            <>
              <span className="num text-accent-700">
                {formatGNF(selected.contribution * selected.members, { compact: true })}
              </span>{" "}
              <span className="text-[11px] font-medium text-muted-foreground">GNF</span>
            </>
          }
        />
        <Field label="Fréquence" value={selected.frequency} />
        <Field
          label="Capacité"
          value={
            <>
              <span className="num">
                {turnsCompleted}/{selected.members}
              </span>{" "}
              <span className={cn("text-[11px] font-medium", slots > 0 ? "text-warning" : "text-success")}>
                · {slots} restantes
              </span>
            </>
          }
        />
      </dl>
    </article>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card px-5 py-3.5 lg:px-6">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-sm font-bold text-foreground">{value}</dd>
    </div>
  );
}
