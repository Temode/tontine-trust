export type GroupStatus = "active" | "your-turn" | "completed" | "pending";

export type Frequency = "Hebdomadaire" | "Quinzaine" | "Mensuelle";

export type GroupRole = "organizer" | "participant";

export interface TontineGroup {
  id: string;
  name: string;
  members: number;
  contribution: number;
  frequency: Frequency;
  nextPaymentDate: string;
  /** Days until next deadline. Negative for overdue, undefined for completed. */
  daysToDeadline?: number;
  progress: number;
  currentTurn: string;
  yourTurn: number;
  status: GroupStatus;
  totalCollected: number;
  rules: string[];
  role: GroupRole;
  /** Average reliability score across members. */
  averageScore: number;
  /** Date the cycle started. */
  startedOn: string;
}

export type MobileMoneyOperator = "orange" | "mtn";

export interface Member {
  id: string;
  name: string;
  initials: string;
  turn: number;
  paid: boolean;
  reliabilityScore: number;
  isYou?: boolean;
}

export type TransactionType = "in" | "out";

export type TransactionStatus = "success" | "pending" | "failed" | "scheduled" | "late";

export interface Transaction {
  id: string;
  type: TransactionType;
  groupId: string;
  groupName: string;
  amount: number;
  date: string;
  /** Days from today; negative = past, used for sorting and period filtering. */
  daysFromToday?: number;
  status: TransactionStatus;
  operator?: MobileMoneyOperator;
  /** Tour # in the group cycle. */
  turn?: number;
  /** Late penalty applied (already part of `amount`). */
  penalty?: number;
  /** Operator-side reference. */
  reference?: string;
}

export interface PaymentMethod {
  id: string;
  operator: MobileMoneyOperator;
  label: string;
  msisdn: string;
  primary: boolean;
  verified: boolean;
  /** Approximate balance, optional. */
  balance?: number;
}

export type TurnStatus = "completed" | "current" | "upcoming";

export interface Turn {
  id: string;
  groupId: string;
  groupName: string;
  /** 1-indexed turn number. */
  index: number;
  /** Total number of turns in the cycle (= members). */
  total: number;
  /** Display date, e.g. "15 Jan 2025". */
  date: string;
  /** Days from today; negative for past. */
  daysFromToday: number;
  beneficiaryName: string;
  beneficiaryInitials: string;
  /** True when the current user is the beneficiary of this turn. */
  isYou: boolean;
  amount: number;
  /** Members who have paid for this turn at the time of viewing. */
  contributorsPaid: number;
  contributorsTotal: number;
  status: TurnStatus;
}

export type SwapStatus = "pending" | "accepted" | "declined" | "expired";

export type SwapDirection = "incoming" | "outgoing";

export interface SwapProposal {
  id: string;
  groupId: string;
  groupName: string;
  direction: SwapDirection;
  counterparty: string;
  counterpartyInitials: string;
  yourTurn: number;
  theirTurn: number;
  proposedOn: string;
  expiresIn: number;
  message?: string;
  status: SwapStatus;
}

export type LedgerEventType =
  | "group_joined"
  | "group_created"
  | "rules_updated"
  | "member_added"
  | "member_removed"
  | "swap_proposed"
  | "swap_accepted"
  | "swap_declined"
  | "beneficiary_confirmed"
  | "payment_made"
  | "cagnotte_received"
  | "penalty_applied"
  | "cycle_started"
  | "cycle_completed"
  | "kyc_verified";

export interface LedgerEvent {
  id: string;
  type: LedgerEventType;
  /** ISO-like display timestamp, e.g. "28 Déc 2024 · 14:32". */
  timestamp: string;
  daysFromToday: number;
  groupId?: string;
  groupName?: string;
  /** Headline displayed as the main label. */
  title: string;
  /** Optional secondary line for context. */
  detail?: string;
  /** Display the actor's name. "Vous" when self-issued. */
  actor: string;
  /** Hash-style audit signature, mocked. */
  signature: string;
}

export interface MonthlyStatement {
  id: string;
  month: string;
  range: string;
  inflow: number;
  outflow: number;
  net: number;
  operations: number;
  status: "ready" | "pending";
}

export interface CashflowPoint {
  /** Display month, e.g. "Avr". */
  label: string;
  /** Sortable month key, e.g. "2024-04". */
  key: string;
  /** Inflows (cagnottes received) — positive values. */
  inflow: number;
  /** Outflows (contributions paid) — stored positive but rendered as negative. */
  outflow: number;
  /** Cumulative net since the beginning of the series. */
  cumulative: number;
}
