import type { Member, PaymentMethod, TontineGroup, Transaction } from "./types";

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
    daysToDeadline: 2,
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
    role: "participant",
    averageScore: 93,
    startedOn: "01 Sep 2024",
  },
  {
    id: "g-diallo",
    name: "Tontine Famille Diallo",
    members: 12,
    contribution: 500_000,
    frequency: "Mensuelle",
    nextPaymentDate: "15 Jan 2025",
    daysToDeadline: 12,
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
    role: "organizer",
    averageScore: 96,
    startedOn: "01 Mars 2024",
  },
  {
    id: "g-bureau",
    name: "Collègues Bureau",
    members: 8,
    contribution: 200_000,
    frequency: "Mensuelle",
    nextPaymentDate: "1 Fév 2025",
    daysToDeadline: 29,
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
    role: "participant",
    averageScore: 91,
    startedOn: "01 Oct 2024",
  },
  {
    id: "g-donka",
    name: "Pilotes Donka",
    members: 15,
    contribution: 750_000,
    frequency: "Hebdomadaire",
    nextPaymentDate: "8 Jan 2025",
    daysToDeadline: 5,
    progress: 60,
    currentTurn: "Boubacar D.",
    yourTurn: 12,
    status: "active",
    totalCollected: 11_250_000,
    rules: [
      "Pénalité de retard : 8% après 2 jours",
      "Ordre de rotation : Fixe",
      "Échange de tours : Refusé",
    ],
    role: "organizer",
    averageScore: 89,
    startedOn: "15 Sep 2024",
  },
  {
    id: "g-kaloum",
    name: "Investisseurs Kaloum",
    members: 24,
    contribution: 2_000_000,
    frequency: "Mensuelle",
    nextPaymentDate: "20 Jan 2025",
    daysToDeadline: 17,
    progress: 25,
    currentTurn: "Mariama S.",
    yourTurn: 18,
    status: "active",
    totalCollected: 12_000_000,
    rules: [
      "Pénalité de retard : 15% après 1 jour",
      "Ordre de rotation : Enchères",
      "Échange de tours : Sur accord notarié",
    ],
    role: "participant",
    averageScore: 97,
    startedOn: "01 Nov 2024",
  },
  {
    id: "g-conakry",
    name: "Entrepreneurs Conakry",
    members: 10,
    contribution: 350_000,
    frequency: "Quinzaine",
    nextPaymentDate: "—",
    progress: 0,
    currentTurn: "Inscription en cours",
    yourTurn: 0,
    status: "pending",
    totalCollected: 0,
    rules: [
      "Pénalité de retard : 5% après 2 jours",
      "Ordre de rotation : Tirage au sort",
      "Échange de tours : Autorisé",
    ],
    role: "organizer",
    averageScore: 0,
    startedOn: "—",
  },
  {
    id: "g-sandervalia",
    name: "Artisans Sandervalia",
    members: 6,
    contribution: 100_000,
    frequency: "Mensuelle",
    nextPaymentDate: "Cycle terminé",
    progress: 100,
    currentTurn: "Cycle terminé",
    yourTurn: 4,
    status: "completed",
    totalCollected: 600_000,
    rules: [
      "Pénalité de retard : 5% après 5 jours",
      "Ordre de rotation : Aléatoire",
      "Échange de tours : Autorisé",
    ],
    role: "participant",
    averageScore: 88,
    startedOn: "01 Mars 2024",
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
    groupName: "Tontine Famille Diallo",
    amount: 6_000_000,
    date: "25 Déc 2024",
    daysFromToday: -10,
    status: "success",
    operator: "mtn",
    turn: 7,
    reference: "MTN-784512",
  },
  {
    id: "tx-2",
    type: "out",
    groupId: "g-diallo",
    groupName: "Tontine Famille Diallo",
    amount: 500_000,
    date: "28 Déc 2024",
    daysFromToday: -7,
    status: "success",
    operator: "orange",
    turn: 8,
    reference: "OM-892341",
  },
  {
    id: "tx-3",
    type: "out",
    groupId: "g-madina",
    groupName: "Commerçants Madina",
    amount: 1_000_000,
    date: "29 Déc 2024",
    daysFromToday: -6,
    status: "success",
    operator: "orange",
    turn: 7,
    reference: "OM-892355",
  },
  {
    id: "tx-4",
    type: "out",
    groupId: "g-bureau",
    groupName: "Collègues Bureau",
    amount: 200_000,
    date: "01 Jan 2025",
    daysFromToday: -3,
    status: "success",
    operator: "mtn",
    turn: 3,
    reference: "MTN-784678",
  },
  {
    id: "tx-5",
    type: "out",
    groupId: "g-donka",
    groupName: "Pilotes Donka",
    amount: 750_000,
    date: "02 Jan 2025",
    daysFromToday: -2,
    status: "success",
    operator: "orange",
    turn: 9,
    reference: "OM-892412",
  },
  {
    id: "tx-6",
    type: "out",
    groupId: "g-kaloum",
    groupName: "Investisseurs Kaloum",
    amount: 2_000_000,
    date: "03 Jan 2025",
    daysFromToday: -1,
    status: "success",
    operator: "mtn",
    turn: 6,
    reference: "MTN-784721",
  },
  {
    id: "tx-7",
    type: "out",
    groupId: "g-diallo",
    groupName: "Tontine Famille Diallo",
    amount: 525_000,
    date: "28 Nov 2024",
    daysFromToday: -37,
    status: "success",
    operator: "orange",
    turn: 7,
    penalty: 25_000,
    reference: "OM-882104",
  },
  {
    id: "tx-8",
    type: "out",
    groupId: "g-madina",
    groupName: "Commerçants Madina",
    amount: 1_000_000,
    date: "22 Déc 2024",
    daysFromToday: -13,
    status: "success",
    operator: "orange",
    turn: 6,
    reference: "OM-891422",
  },
  {
    id: "tx-9",
    type: "out",
    groupId: "g-donka",
    groupName: "Pilotes Donka",
    amount: 750_000,
    date: "26 Déc 2024",
    daysFromToday: -9,
    status: "success",
    operator: "orange",
    turn: 8,
    reference: "OM-892121",
  },
  {
    id: "tx-10",
    type: "in",
    groupId: "g-bureau",
    groupName: "Collègues Bureau",
    amount: 1_600_000,
    date: "10 Déc 2024",
    daysFromToday: -25,
    status: "success",
    operator: "mtn",
    turn: 3,
    reference: "MTN-783998",
  },
  {
    id: "tx-11",
    type: "out",
    groupId: "g-kaloum",
    groupName: "Investisseurs Kaloum",
    amount: 2_000_000,
    date: "20 Nov 2024",
    daysFromToday: -45,
    status: "failed",
    operator: "mtn",
    turn: 5,
    reference: "MTN-781022",
  },
  {
    id: "tx-12",
    type: "out",
    groupId: "g-bureau",
    groupName: "Collègues Bureau",
    amount: 200_000,
    date: "15 Déc 2024",
    daysFromToday: -20,
    status: "success",
    operator: "mtn",
    turn: 2,
    reference: "MTN-783542",
  },
];

export const paymentMethods: PaymentMethod[] = [
  {
    id: "pm-orange",
    operator: "orange",
    label: "Orange Money",
    msisdn: "+224 621 00 00 00",
    primary: true,
    verified: true,
    balance: 4_250_000,
  },
  {
    id: "pm-mtn",
    operator: "mtn",
    label: "MTN Mobile Money",
    msisdn: "+224 661 00 00 00",
    primary: false,
    verified: true,
    balance: 1_120_000,
  },
];

export interface UpcomingContribution {
  id: string;
  groupId: string;
  groupName: string;
  amount: number;
  date: string;
  daysAway: number;
  /** UI grouping. */
  bucket: "overdue" | "this-week" | "this-month" | "later";
  /** Whether the user can act now (vs. scheduled / awaiting cycle). */
  payable: boolean;
}

function bucketFor(days: number): UpcomingContribution["bucket"] {
  if (days < 0) return "overdue";
  if (days <= 7) return "this-week";
  if (days <= 30) return "this-month";
  return "later";
}

/** Build the upcoming contribution schedule from group deadlines. */
export function getUpcomingContributions(): UpcomingContribution[] {
  return groups
    .filter((g) => g.daysToDeadline !== undefined && g.status !== "completed" && g.status !== "pending")
    .map((g): UpcomingContribution => ({
      id: `up-${g.id}`,
      groupId: g.id,
      groupName: g.name,
      amount: g.contribution,
      date: g.nextPaymentDate,
      daysAway: g.daysToDeadline ?? 0,
      bucket: bucketFor(g.daysToDeadline ?? 0),
      payable: (g.daysToDeadline ?? 0) <= 14,
    }))
    .sort((a, b) => a.daysAway - b.daysAway);
}

export function getContributionsStats() {
  const upcoming = getUpcomingContributions();
  const out30 = transactions.filter(
    (t) => t.type === "out" && t.status === "success" && (t.daysFromToday ?? 0) >= -30,
  );
  const failed30 = transactions.filter(
    (t) => t.type === "out" && t.status === "failed" && (t.daysFromToday ?? 0) >= -30,
  );
  const onTime = transactions.filter(
    (t) => t.type === "out" && t.status === "success" && !t.penalty,
  ).length;
  const late = transactions.filter((t) => t.type === "out" && (t.penalty ?? 0) > 0).length;
  const denominator = onTime + late || 1;
  const onTimeRate = Math.round((onTime / denominator) * 100);

  const dueSoon = upcoming.filter((u) => u.daysAway <= 7);
  const overdue = upcoming.filter((u) => u.bucket === "overdue");

  return {
    upcomingCount: upcoming.length,
    upcomingTotal: upcoming.reduce((s, u) => s + u.amount, 0),
    dueSoonCount: dueSoon.length,
    dueSoonTotal: dueSoon.reduce((s, u) => s + u.amount, 0),
    paid30Count: out30.length,
    paid30Total: out30.reduce((s, t) => s + t.amount, 0),
    failed30Count: failed30.length,
    overdueCount: overdue.length,
    overdueTotal: overdue.reduce((s, u) => s + u.amount, 0),
    onTimeRate,
    onTimeCount: onTime,
    lateCount: late,
  };
}

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
  const activeGroups = groups.filter((g) => g.status !== "completed" && g.status !== "pending").length;
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

export function getPortfolioStats() {
  const total = groups.length;
  const active = groups.filter((g) => g.status === "active").length;
  const yourTurn = groups.filter((g) => g.status === "your-turn").length;
  const completed = groups.filter((g) => g.status === "completed").length;
  const pending = groups.filter((g) => g.status === "pending").length;

  // Capital engagé : somme des cotisations encore dues sur le cycle restant.
  const capitalCommitted = groups
    .filter((g) => g.status === "active" || g.status === "your-turn")
    .reduce((sum, g) => {
      const turnsRemaining = Math.max(0, g.members - Math.round((g.progress / 100) * g.members));
      return sum + g.contribution * turnsRemaining;
    }, 0);

  const cagnotteCumulee = groups.reduce((sum, g) => sum + g.totalCollected, 0);

  const scored = groups.filter((g) => g.averageScore > 0);
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((sum, g) => sum + g.averageScore, 0) / scored.length)
    : 0;

  // Prochaine cagnotte attendue (votre tour le plus proche en jours).
  const upcomingTurn = groups
    .filter((g) => g.status !== "completed" && g.status !== "pending")
    .reduce<{ amount: number; days: number; groupName: string } | null>((best, g) => {
      if (g.status === "your-turn") {
        const amount = g.contribution * g.members;
        if (!best || (g.daysToDeadline ?? 9999) < best.days) {
          return { amount, days: g.daysToDeadline ?? 0, groupName: g.name };
        }
      }
      return best;
    }, null);

  return {
    total,
    active,
    yourTurn,
    completed,
    pending,
    capitalCommitted,
    cagnotteCumulee,
    avgScore,
    upcomingTurn,
  };
}
