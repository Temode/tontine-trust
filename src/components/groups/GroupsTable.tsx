import { ArrowUpDown, ChevronDown, ChevronUp, Crown, MoreHorizontal, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import type { TontineGroup } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import type { SortDir, SortKey } from "./types";

interface GroupsTableProps {
  groups: TontineGroup[];
  sort: SortKey;
  sortDir: SortDir;
  onSortChange: (key: SortKey) => void;
}

interface Column {
  id: SortKey | "actions" | "currentTurn";
  label: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  className?: string;
}

const columns: Column[] = [
  { id: "name", label: "Groupe", sortable: true },
  { id: "members", label: "Membres", align: "right", sortable: true, className: "hidden md:table-cell" },
  { id: "contribution", label: "Cotisation", align: "right", sortable: true, className: "hidden lg:table-cell" },
  { id: "totalCollected", label: "Cagnotte", align: "right", sortable: true },
  { id: "progress", label: "Progression", sortable: true, className: "hidden md:table-cell" },
  { id: "currentTurn", label: "Bénéficiaire", className: "hidden xl:table-cell" },
  { id: "deadline", label: "Échéance", align: "right", sortable: true, className: "hidden sm:table-cell" },
  { id: "score", label: "Score", align: "right", sortable: true, className: "hidden 2xl:table-cell" },
  { id: "actions", label: "", align: "right" },
];

export function GroupsTable({ groups, sort, sortDir, onSortChange }: GroupsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-hairline bg-card">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40">
          <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {columns.map((col) => {
              const Icon =
                col.sortable && sort === col.id ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ArrowUpDown;
              const align =
                col.align === "right" ? "text-right justify-end" : col.align === "center" ? "text-center justify-center" : "text-left justify-start";
              return (
                <th
                  key={col.id}
                  scope="col"
                  className={cn(
                    "px-4 py-3 first:pl-5 last:pr-5 lg:px-5 lg:first:pl-6 lg:last:pr-6",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.className,
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(col.id as SortKey)}
                      className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition hover:text-foreground",
                        sort === col.id ? "text-foreground" : "text-muted-foreground",
                        align,
                      )}
                    >
                      <span>{col.label}</span>
                      <Icon className="h-3 w-3" />
                    </button>
                  ) : (
                    col.label && <span>{col.label}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {groups.map((g) => (
            <GroupsTableRow key={g.id} group={g} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupsTableRow({ group }: { group: TontineGroup }) {
  const turnsCompleted = Math.round((group.progress / 100) * group.members);
  const isYourTurn = group.status === "your-turn";

  return (
    <tr className="text-sm transition-colors hover:bg-secondary/30">
      {/* Group cell */}
      <td className="px-4 py-3.5 first:pl-5 lg:px-5 lg:first:pl-6">
        <Link to={`/groupes/${group.id}`} className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-primary-foreground",
              isYourTurn ? "bg-accent-600" : "bg-primary",
            )}
          >
            <Users className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-foreground">{group.name}</p>
              <StatusBadge status={group.status} />
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                {group.role === "organizer" ? (
                  <Crown className="h-3 w-3" />
                ) : (
                  <Users className="h-3 w-3" />
                )}
                {group.role === "organizer" ? "Organisateur" : "Participant"}
              </span>
              <span className="ml-2">· {group.frequency}</span>
              <span className="mx-1.5">·</span>
              <span>Démarré {group.startedOn}</span>
            </p>
          </div>
        </Link>
      </td>

      {/* Members */}
      <td className="hidden px-4 py-3.5 text-right text-foreground num md:table-cell lg:px-5">{group.members}</td>

      {/* Contribution */}
      <td className="hidden px-4 py-3.5 text-right num lg:table-cell lg:px-5">
        <span className="text-foreground">{formatGNF(group.contribution)}</span>
        <span className="ml-1 text-[11px] text-muted-foreground">GNF</span>
      </td>

      {/* Cagnotte */}
      <td className="px-4 py-3.5 text-right font-display font-semibold num lg:px-5">
        {group.totalCollected > 0 ? (
          <>
            <span className={isYourTurn ? "text-accent-700" : "text-foreground"}>
              {formatGNF(group.totalCollected)}
            </span>
            <span className="ml-1 text-[11px] font-medium text-muted-foreground">GNF</span>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Progress */}
      <td className="hidden px-4 py-3.5 md:table-cell lg:px-5">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full rounded-full", isYourTurn ? "bg-accent-500" : group.status === "completed" ? "bg-muted-foreground/40" : "bg-primary")}
              style={{ width: `${group.progress}%` }}
            />
          </div>
          <span className="text-xs font-medium text-foreground num">
            {turnsCompleted}/{group.members}
          </span>
        </div>
      </td>

      {/* Current turn */}
      <td className="hidden px-4 py-3.5 text-foreground xl:table-cell lg:px-5">
        <p className="truncate">{group.currentTurn}</p>
        <p className="text-[11px] text-muted-foreground">Tour #{Math.min(group.yourTurn, group.members)}</p>
      </td>

      {/* Deadline */}
      <td className="hidden px-4 py-3.5 text-right sm:table-cell lg:px-5">
        {group.daysToDeadline !== undefined ? (
          <>
            <p className="text-foreground">{group.nextPaymentDate}</p>
            <p
              className={cn(
                "text-[11px]",
                group.daysToDeadline <= 3 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {formatRelativeDays(group.daysToDeadline)}
            </p>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Score */}
      <td className="hidden px-4 py-3.5 text-right num 2xl:table-cell lg:px-5">
        {group.averageScore > 0 ? (
          <span className="text-foreground">{group.averageScore}%</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5 text-right last:pr-5 lg:px-5 lg:last:pr-6">
        <Link
          to={`/groupes/${group.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary"
        >
          {isYourTurn ? "Recevoir" : "Détails"}
        </Link>
        <button
          type="button"
          aria-label={`Plus d'options pour ${group.name}`}
          className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
