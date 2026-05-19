import type { Frequency, TontineGroup } from "@/lib/types";

export type DbFrequency = "hebdomadaire" | "quinzaine" | "mensuelle";
export type DbGroupStatus = "draft" | "open" | "active" | "completed" | "cancelled";
export type DbMemberRole = "organisateur" | "membre";
export type DbMemberStatus = "active" | "invited" | "removed" | "left";
export type DbInvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface DbGroupOverview {
  id: string;
  name: string;
  description: string | null;
  contribution_amount: number;
  frequency: DbFrequency;
  max_members: number;
  status: DbGroupStatus;
  created_at: string;
  members_count: number;
  is_organizer: boolean;
}

export interface DbGroup {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  contribution_amount: number;
  frequency: DbFrequency;
  max_members: number;
  rotation_order_kind: "random" | "fixed" | "choice";
  late_penalty_percent: number;
  late_penalty_after_days: number;
  status: DbGroupStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: DbMemberRole;
  status: DbMemberStatus;
  position: number | null;
  joined_at: string;
  profile?: { full_name: string | null; phone_number: string | null } | null;
}

export interface DbInvitation {
  id: string;
  group_id: string;
  code: string;
  created_by: string;
  max_uses: number | null;
  uses_count: number;
  status: DbInvitationStatus;
  expires_at: string | null;
  created_at: string;
}

const FREQ_TO_UI: Record<DbFrequency, Frequency> = {
  hebdomadaire: "Hebdomadaire",
  quinzaine: "Quinzaine",
  mensuelle: "Mensuelle",
};

export const FREQ_TO_DB: Record<Frequency, DbFrequency> = {
  Hebdomadaire: "hebdomadaire",
  Quinzaine: "quinzaine",
  Mensuelle: "mensuelle",
};

/** Adapter : ligne DB -> TontineGroup utilisable par l'UI existante. */
export function overviewToTontine(row: DbGroupOverview): TontineGroup {
  const totalCollected = row.contribution_amount * row.members_count;
  return {
    id: row.id,
    name: row.name,
    members: row.members_count,
    contribution: row.contribution_amount,
    frequency: FREQ_TO_UI[row.frequency],
    nextPaymentDate: "—",
    daysToDeadline: undefined,
    progress: 0,
    currentTurn: "—",
    yourTurn: 0,
    status: row.status === "completed" ? "completed" : row.status === "active" ? "active" : "pending",
    totalCollected,
    rules: [],
    role: row.is_organizer ? "organizer" : "participant",
    averageScore: 0,
    startedOn: new Date(row.created_at).toLocaleDateString("fr-FR"),
  };
}