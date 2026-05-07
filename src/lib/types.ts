export type GroupStatus = "active" | "your-turn" | "completed" | "pending";

export type Frequency = "Hebdomadaire" | "Mensuelle" | "Quinzaine";

export interface TontineGroup {
  id: string;
  name: string;
  members: number;
  contribution: number;
  frequency: Frequency;
  nextPaymentDate: string;
  progress: number;
  currentTurn: string;
  yourTurn: number;
  status: GroupStatus;
  totalCollected: number;
  rules: string[];
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

export interface Transaction {
  id: string;
  type: TransactionType;
  groupId: string;
  groupName: string;
  amount: number;
  date: string;
  status: "success" | "pending" | "failed";
  operator?: MobileMoneyOperator;
}
