import type { Frequency, TontineGroup } from "@/lib/types";

export type DbFrequency = "quotidienne" | "hebdomadaire" | "quinzaine" | "mensuelle";
export type DbGroupStatus = "draft" | "open" | "active" | "paused" | "completed" | "cancelled";
export type DbMemberRole = "organisateur" | "membre";
export type DbMemberStatus = "active" | "invited" | "removed" | "left" | "pending" | "suspended";
export type DbInvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type DbTurnStatus = "upcoming" | "collecting" | "paid" | "skipped";

export interface DbGroupOverview {
  id: string;
  name: string;
  description: string | null;
  contribution_amount: number;
  frequency: DbFrequency;
  max_members: number;
  status: DbGroupStatus;
  visibility?: "private" | "public-link" | "directory";
  created_at: string;
  members_count: number;
  is_organizer: boolean;
  my_status?: DbMemberStatus | null;
  my_role?: DbMemberRole | null;
  organizer_name?: string | null;
}

export interface DbGroup {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  contribution_amount: number;
  frequency: DbFrequency;
  max_members: number;
  rotation_order_kind: "random" | "fixed" | "choice" | "auction";
  late_penalty_percent: number;
  late_penalty_after_days: number;
  swap_policy?: "none" | "with_consent" | "organizer_only";
  status: DbGroupStatus;
  visibility?: "private" | "public-link" | "directory";
  co_organizers?: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  paused_at?: string | null;
  paused_reason?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
}

export interface DbGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: DbMemberRole;
  status: DbMemberStatus;
  position: number | null;
  joined_at: string;
  suspended_at?: string | null;
  suspended_reason?: string | null;
  can_chat?: boolean;
  can_bid?: boolean;
  can_swap?: boolean;
  can_invite?: boolean;
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

export interface DbNextTurn {
  group_id: string;
  turn_id: string;
  cycle_id: string;
  turn_number: number;
  due_date: string;
  payout_amount: number;
  status: DbTurnStatus;
  beneficiary_user_id: string;
  beneficiary_name: string | null;
}

const FREQ_TO_UI: Record<DbFrequency, Frequency> = {
  quotidienne: "Quotidienne",
  hebdomadaire: "Hebdomadaire",
  quinzaine: "Quinzaine",
  mensuelle: "Mensuelle",
};

export const FREQ_TO_DB: Record<Frequency, DbFrequency> = {
  Quotidienne: "quotidienne",
  Hebdomadaire: "hebdomadaire",
  Quinzaine: "quinzaine",
  Mensuelle: "mensuelle",
};

/** Adapter : ligne DB -> TontineGroup utilisable par l'UI existante. */
export function overviewToTontine(row: DbGroupOverview): TontineGroup {
  const totalCollected = row.contribution_amount * row.members_count;
  const isPending = row.my_status === "pending";
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
    status: isPending
      ? "pending"
      : row.status === "completed"
      ? "completed"
      : row.status === "active"
      ? "active"
      : "pending",
    totalCollected,
    rules: [],
    role: row.is_organizer ? "organizer" : "participant",
    averageScore: 0,
    startedOn: new Date(row.created_at).toLocaleDateString("fr-FR"),
  };
}