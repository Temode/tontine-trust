import type { GroupStatus } from "@/lib/types";

export type GroupsFilter = GroupStatus | "all";

export const STATUS_FILTERS: Array<{ id: GroupsFilter; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "your-turn", label: "Votre tour" },
  { id: "active", label: "Actifs" },
  { id: "pending", label: "Inscription" },
  { id: "completed", label: "Terminés" },
];

export type SortKey =
  | "name"
  | "members"
  | "contribution"
  | "totalCollected"
  | "progress"
  | "deadline"
  | "score";

export type SortDir = "asc" | "desc";

export const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: "deadline", label: "Prochaine échéance" },
  { id: "totalCollected", label: "Cagnotte" },
  { id: "progress", label: "Progression" },
  { id: "contribution", label: "Cotisation" },
  { id: "members", label: "Membres" },
  { id: "score", label: "Score moyen" },
  { id: "name", label: "Nom" },
];

export type ViewMode = "table" | "grid";
