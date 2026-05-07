import type { Member, TontineGroup, Transaction } from "./types";

export const currentUser = {
  id: "user-1",
  name: "Elhadj Mamadou",
  initials: "ED",
  reliabilityScore: 95,
  phone: "+224 621 00 00 00",
  memberSince: "8 mois",
};

export const groups: TontineGroup[] = [
  {
    id: "g-madina",
    name: "Commerçants Madina",
    members: 20,
    contribution: 1_000_000,
    frequency: "Hebdomadaire",
    nextPaymentDate: "5 Jan 2025",
    progress: 40,
    currentTurn: "Vous",
    yourTurn: 8,
    status: "your-turn",
    totalCollected: 20_000_000,
    rules: [
      "Pénalité de retard : 10% après 1 jour",
      "Ordre de rotation : Fixe",
      "Échange de tours : Sur accord du groupe",
    ],
  },
  {
    id: "g-diallo",
    name: "Tontine Famille Diallo",
    members: 12,
    contribution: 500_000,
    frequency: "Mensuelle",
    nextPaymentDate: "15 Jan 2025",
    progress: 75,
    currentTurn: "Mamadou D.",
    yourTurn: 11,
    status: "active",
    totalCollected: 6_000_000,
    rules: [
      "Pénalité de retard : 5% après 3 jours",
      "Ordre de rotation : Aléatoire",
      "Échange de tours : Autorisé",
    ],
  },
  {
    id: "g-bureau",
    name: "Collègues Bureau",
    members: 8,
    contribution: 200_000,
    frequency: "Mensuelle",
    nextPaymentDate: "1 Fév 2025",
    progress: 37.5,
    currentTurn: "Aissatou C.",
    yourTurn: 5,
    status: "active",
    totalCollected: 1_600_000,
    rules: [
      "Pénalité de retard : Aucune",
      "Ordre de rotation : Tirage au sort",
      "Échange de tours : Autorisé",
    ],
  },
];

export const members: Member[] = [
  { id: "m1", name: "Mamadou Diallo", initials: "MD", turn: 1, paid: true, reliabilityScore: 98 },
  { id: "m2", name: "Fatoumata Barry", initials: "FB", turn: 2, paid: true, reliabilityScore: 95 },
  { id: "m3", name: "Ibrahima Sow", initials: "IS", turn: 3, paid: true, reliabilityScore: 92 },
  { id: "m4", name: "Aissatou Camara", initials: "AC", turn: 4, paid: false, reliabilityScore: 88 },
  { id: "m5", name: "Ousmane Bah", initials: "OB", turn: 5, paid: true, reliabilityScore: 96 },
  { id: "m6", name: "Mariama Touré", initials: "MT", turn: 6, paid: true, reliabilityScore: 94 },
  { id: "m7", name: "Abdoulaye Keita", initials: "AK", turn: 7, paid: false, reliabilityScore: 85 },
  { id: "you", name: "Vous", initials: "ED", turn: 8, paid: true, reliabilityScore: 100, isYou: true },
];

export const transactions: Transaction[] = [
  {
    id: "tx-1",
    type: "in",
    groupId: "g-diallo",
    groupName: "Famille Diallo",
    amount: 6_000_000,
    date: "25 Déc 2024",
    status: "success",
    operator: "mtn",
  },
  {
    id: "tx-2",
    type: "out",
    groupId: "g-diallo",
    groupName: "Famille Diallo",
    amount: 500_000,
    date: "28 Déc 2024",
    status: "success",
    operator: "orange",
  },
  {
    id: "tx-3",
    type: "out",
    groupId: "g-madina",
    groupName: "Commerçants Madina",
    amount: 1_000_000,
    date: "29 Déc 2024",
    status: "success",
    operator: "orange",
  },
  {
    id: "tx-4",
    type: "out",
    groupId: "g-bureau",
    groupName: "Collègues Bureau",
    amount: 200_000,
    date: "01 Jan 2025",
    status: "success",
    operator: "mtn",
  },
];

export type DeadlineType = "due" | "receiving";

export interface Deadline {
  id: string;
  type: DeadlineType;
  groupId: string;
  groupName: string;
  date: { month: string; day: string };
  amount: number;
  daysAway: number;
  urgent?: boolean;
}

export const upcomingDeadlines: Deadline[] = [
  {
    id: "d1",
    type: "due",
    groupId: "g-madina",
    groupName: "Commerçants Madina",
    date: { month: "JAN", day: "05" },
    amount: 1_000_000,
    daysAway: 2,
    urgent: true,
  },
  {
    id: "d2",
    type: "receiving",
    groupId: "g-madina",
    groupName: "Commerçants Madina",
    date: { month: "JAN", day: "05" },
    amount: 20_000_000,
    daysAway: 2,
  },
  {
    id: "d3",
    type: "due",
    groupId: "g-diallo",
    groupName: "Famille Diallo",
    date: { month: "JAN", day: "15" },
    amount: 500_000,
    daysAway: 12,
  },
  {
    id: "d4",
    type: "due",
    groupId: "g-bureau",
    groupName: "Collègues Bureau",
    date: { month: "FÉV", day: "01" },
    amount: 200_000,
    daysAway: 29,
  },
];

export type MemberStatus = "paid" | "pending" | "late" | "beneficiary";

export interface MemberStatusEntry {
  id: string;
  name: string;
  initials: string;
  status: MemberStatus;
  isYou?: boolean;
}

export const liveMembersStatus: MemberStatusEntry[] = [
  { id: "ls1", name: "Mamadou D.", initials: "MD", status: "paid" },
  { id: "ls2", name: "Fatoumata B.", initials: "FB", status: "paid" },
  { id: "ls3", name: "Ibrahima S.", initials: "IS", status: "paid" },
  { id: "ls4", name: "Ousmane B.", initials: "OB", status: "paid" },
  { id: "ls5", name: "Mariama T.", initials: "MT", status: "paid" },
  { id: "ls6", name: "Aissatou C.", initials: "AC", status: "pending" },
  { id: "ls7", name: "Abdoulaye K.", initials: "AK", status: "pending" },
  { id: "ls8", name: "Sekou K.", initials: "SK", status: "late" },
  { id: "lsyou", name: "Vous", initials: "ED", status: "beneficiary", isYou: true },
];

export interface GroupDistribution {
  groupId: string;
  name: string;
  share: number;
  toneClass: string;
}

export const groupDistribution: GroupDistribution[] = [
  { groupId: "g-madina", name: "Commerçants Madina", share: 59, toneClass: "bg-accent-500" },
  { groupId: "g-diallo", name: "Famille Diallo", share: 29, toneClass: "bg-primary-500" },
  { groupId: "g-bureau", name: "Collègues Bureau", share: 12, toneClass: "bg-primary-200" },
];

export function getGroupById(id: string): TontineGroup | undefined {
  return groups.find((g) => g.id === id);
}

export function getStats() {
  const activeGroups = groups.filter((g) => g.status !== "completed").length;
  const contributionsCount = transactions.filter((t) => t.type === "out" && t.status === "success").length;
  const contributionsTotal = transactions
    .filter((t) => t.type === "out" && t.status === "success")
    .reduce((sum, t) => sum + t.amount, 0);
  const cagnottesReceived = transactions
    .filter((t) => t.type === "in" && t.status === "success")
    .reduce((sum, t) => sum + t.amount, 0);
  return {
    activeGroups,
    contributionsCount,
    contributionsTotal,
    cagnottesReceived,
    totalBalance: groups.reduce((sum, g) => sum + g.totalCollected, 0),
    monthlyChange: 4_500_000,
    monthlyTrend: 12.5,
    reliabilityScore: currentUser.reliabilityScore,
    onTimePayments: { current: 12, total: 12 },
    lateCount: 0,
  };
}
