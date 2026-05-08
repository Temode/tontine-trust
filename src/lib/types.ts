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
