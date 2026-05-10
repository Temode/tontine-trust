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

export type CalendarEventType =
  | "contribution"
  | "your-turn"
  | "turn"
  | "meeting"
  | "cycle-start"
  | "cycle-end"
  | "swap-deadline"
  | "rule-vote"
  | "reminder";

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  /** ISO date "YYYY-MM-DD". */
  date: string;
  /** Optional 24h time "HH:MM". */
  time?: string;
  endTime?: string;
  daysFromToday: number;
  groupId?: string;
  groupName?: string;
  amount?: number;
  isYou?: boolean;
  description?: string;
  status?: "scheduled" | "completed" | "cancelled";
}

export type CalendarView = "month" | "agenda";

export type DirectoryCategory = "family" | "professional" | "business" | "community";

export type DirectoryRotation = "random" | "fixed" | "auction" | "choice";

export type DirectorySwap = "open" | "consensus" | "closed";

export type DirectoryVisibility = "public-link" | "directory";

export interface DirectoryGroup {
  id: string;
  name: string;
  category: DirectoryCategory;
  description: string;
  /** Display name + initials of the organizer. */
  organizerName: string;
  organizerInitials: string;
  /** Reliability score of the organizer (0-100). */
  organizerScore: number;
  /** Total members at full capacity. */
  members: number;
  /** Already filled seats. */
  filled: number;
  contribution: number;
  frequency: Frequency;
  rotationOrder: DirectoryRotation;
  swapPolicy: DirectorySwap;
  latePenaltyPercent: number;
  visibility: DirectoryVisibility;
  inviteCode: string;
  /** Days until the cycle starts (negative = already started). */
  startsInDays: number;
  /** Average reliability score of existing members. */
  meanScore: number;
  createdOn: string;
  rules: string[];
  /** Curated tags for filtering. */
  tags: string[];
}

export type InvitationChannel = "sms" | "link" | "email" | "qr" | "directory" | "manual";

export type InvitationStatus = "sent" | "opened" | "joined" | "declined" | "expired" | "queued";

export interface Invitation {
  id: string;
  groupId: string;
  groupName: string;
  /** Display name of the recipient (may be unknown for link/QR shares). */
  recipientName?: string;
  recipientInitials?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  channel: InvitationChannel;
  sentOn: string;
  /** Days from today; negative for past. */
  daysFromToday: number;
  status: InvitationStatus;
  /** When the recipient opened the invitation (display string). */
  openedOn?: string;
  /** Personal message attached to the invitation. */
  message?: string;
}

export type JoinRequestStatus = "pending" | "approved" | "rejected";

export interface JoinRequest {
  id: string;
  groupId: string;
  groupName: string;
  applicantName: string;
  applicantInitials: string;
  applicantPhone: string;
  applicantScore: number;
  appliedOn: string;
  daysFromToday: number;
  status: JoinRequestStatus;
  channel: InvitationChannel;
  message?: string;
  /** True when the applicant came in via a public-link / directory listing rather than a personal invitation. */
  cold?: boolean;
}

export interface JoinApplication {
  id: string;
  groupId: string;
  groupName: string;
  organizerName: string;
  organizerInitials: string;
  contribution: number;
  members: number;
  appliedOn: string;
  daysFromToday: number;
  status: JoinApplicationStatus;
  message?: string;
  /** Position requested if rotation order is "choice". */
  requestedTurn?: number;
}

export type JoinApplicationStatus = "pending" | "accepted" | "declined" | "cancelled";

export type KycLevel = 1 | 2 | 3;

export type KycDocumentType = "national_id" | "passport" | "selfie" | "utility_bill" | "tax_id";

export type KycDocumentStatus = "verified" | "pending" | "rejected" | "expired";

export interface KycDocument {
  id: string;
  type: KycDocumentType;
  label: string;
  reference?: string;
  uploadedOn: string;
  status: KycDocumentStatus;
  expiresOn?: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  initials: string;
  phone: string;
  email: string;
  city: string;
  country: string;
  language: "fr" | "en";
  occupation: string;
  bio: string;
  memberSince: string;
  /** Number of months since joining the platform. */
  tenureMonths: number;
  reliabilityScore: number;
  kycLevel: KycLevel;
  kycVerifiedOn: string;
  twoFactorEnabled: boolean;
  biometricEnabled: boolean;
  notificationChannels: {
    sms: boolean;
    push: boolean;
    email: boolean;
  };
  notificationCadence: "real-time" | "daily" | "weekly";
  currency: "GNF";
  theme: "light" | "dark" | "system";
  badges: string[];
  /** Lifetime metrics. */
  lifetimeContributions: number;
  lifetimeCagnottes: number;
  cyclesCompleted: number;
  cyclesActive: number;
  onTimeRate: number;
}

export interface SessionDevice {
  id: string;
  device: string;
  os: string;
  browser: string;
  city: string;
  ip: string;
  lastActive: string;
  daysFromToday: number;
  current: boolean;
}

export type ProfileActivityType =
  | "login"
  | "kyc_update"
  | "security_change"
  | "payment_method"
  | "preferences"
  | "profile_edit"
  | "data_export";

export interface ProfileActivityEntry {
  id: string;
  type: ProfileActivityType;
  title: string;
  detail: string;
  timestamp: string;
  daysFromToday: number;
  signature: string;
}
