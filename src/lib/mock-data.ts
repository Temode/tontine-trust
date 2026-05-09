import type { CashflowPoint, LedgerEvent, Member, MonthlyStatement, PaymentMethod, SwapProposal, TontineGroup, Transaction, Turn } from "./types";

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

// Operations stretching back ~12 months to give the registry real depth.
transactions.push(
  {
    id: "tx-13",
    type: "out",
    groupId: "g-madina",
    groupName: "Commerçants Madina",
    amount: 1_000_000,
    date: "15 Déc 2024",
    daysFromToday: -19,
    status: "success",
    operator: "orange",
    turn: 5,
    reference: "OM-890211",
  },
  {
    id: "tx-14",
    type: "out",
    groupId: "g-kaloum",
    groupName: "Investisseurs Kaloum",
    amount: 2_000_000,
    date: "15 Nov 2024",
    daysFromToday: -49,
    status: "success",
    operator: "mtn",
    turn: 4,
    reference: "MTN-779203",
  },
  {
    id: "tx-15",
    type: "in",
    groupId: "g-bureau",
    groupName: "Collègues Bureau",
    amount: 1_600_000,
    date: "10 Oct 2024",
    daysFromToday: -85,
    status: "success",
    operator: "mtn",
    turn: 4,
    reference: "MTN-768004",
  },
  {
    id: "tx-16",
    type: "out",
    groupId: "g-diallo",
    groupName: "Tontine Famille Diallo",
    amount: 500_000,
    date: "28 Sep 2024",
    daysFromToday: -97,
    status: "success",
    operator: "orange",
    turn: 5,
    reference: "OM-871022",
  },
  {
    id: "tx-17",
    type: "out",
    groupId: "g-donka",
    groupName: "Pilotes Donka",
    amount: 750_000,
    date: "12 Sep 2024",
    daysFromToday: -113,
    status: "success",
    operator: "orange",
    turn: 4,
    reference: "OM-862415",
  },
  {
    id: "tx-18",
    type: "out",
    groupId: "g-madina",
    groupName: "Commerçants Madina",
    amount: 1_000_000,
    date: "20 Août 2024",
    daysFromToday: -136,
    status: "success",
    operator: "orange",
    turn: 2,
    reference: "OM-844511",
  },
  {
    id: "tx-19",
    type: "out",
    groupId: "g-kaloum",
    groupName: "Investisseurs Kaloum",
    amount: 2_000_000,
    date: "15 Juil 2024",
    daysFromToday: -172,
    status: "success",
    operator: "mtn",
    turn: 1,
    reference: "MTN-714008",
  },
  {
    id: "tx-20",
    type: "in",
    groupId: "g-sandervalia",
    groupName: "Artisans Sandervalia",
    amount: 600_000,
    date: "01 Juil 2024",
    daysFromToday: -187,
    status: "success",
    operator: "orange",
    turn: 4,
    reference: "OM-705122",
  },
  {
    id: "tx-21",
    type: "out",
    groupId: "g-bureau",
    groupName: "Collègues Bureau",
    amount: 200_000,
    date: "01 Juin 2024",
    daysFromToday: -217,
    status: "success",
    operator: "mtn",
    turn: 1,
    reference: "MTN-680110",
  },
  {
    id: "tx-22",
    type: "out",
    groupId: "g-diallo",
    groupName: "Tontine Famille Diallo",
    amount: 500_000,
    date: "10 Mai 2024",
    daysFromToday: -239,
    status: "success",
    operator: "orange",
    turn: 2,
    reference: "OM-665902",
  },
  {
    id: "tx-23",
    type: "out",
    groupId: "g-diallo",
    groupName: "Tontine Famille Diallo",
    amount: 500_000,
    date: "10 Avr 2024",
    daysFromToday: -270,
    status: "success",
    operator: "orange",
    turn: 1,
    reference: "OM-642115",
  },
);

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

/**
 * Cycle length per frequency (in days). Approximations are fine for visualisation.
 */
const FREQUENCY_DAYS: Record<TontineGroup["frequency"], number> = {
  Hebdomadaire: 7,
  Quinzaine: 14,
  Mensuelle: 30,
};

/** Pseudo-random members used to populate beneficiaries when a group has no member roster yet. */
const FALLBACK_BENEFICIARIES: Array<{ name: string; initials: string }> = [
  { name: "Mamadou Diallo", initials: "MD" },
  { name: "Fatoumata Barry", initials: "FB" },
  { name: "Ibrahima Sow", initials: "IS" },
  { name: "Aissatou Camara", initials: "AC" },
  { name: "Ousmane Bah", initials: "OB" },
  { name: "Mariama Touré", initials: "MT" },
  { name: "Abdoulaye Keita", initials: "AK" },
  { name: "Sekou Konaté", initials: "SK" },
  { name: "Hadiatou Cissé", initials: "HC" },
  { name: "Moussa Bangoura", initials: "MB" },
  { name: "Kadiatou Sylla", initials: "KS" },
  { name: "Lansana Camara", initials: "LC" },
  { name: "Aminata Diaby", initials: "AD" },
  { name: "Boubacar Doumbouya", initials: "BD" },
  { name: "Néné Touré", initials: "NT" },
  { name: "Salif Kaba", initials: "SK" },
  { name: "Kankou Bah", initials: "KB" },
  { name: "Thierno Diallo", initials: "TD" },
  { name: "Mariama Souaré", initials: "MS" },
  { name: "Alpha Conté", initials: "AC" },
];

function formatDateFr(d: Date): string {
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Generate the full rotation roster for a group: completed turns, the current turn,
 * and the upcoming ones — using the deterministic order of FALLBACK_BENEFICIARIES so the
 * output is stable across renders and the user lands at index = group.yourTurn.
 */
function generateTurnsForGroup(group: TontineGroup, today: Date): Turn[] {
  if (group.status === "pending") return [];

  const cycleDays = FREQUENCY_DAYS[group.frequency];
  const turnsCompleted = Math.round((group.progress / 100) * group.members);
  const nextDeadlineDays = group.daysToDeadline ?? cycleDays;

  const turns: Turn[] = [];

  for (let i = 1; i <= group.members; i++) {
    // Day offset relative to the current "next deadline":
    const offset = (i - turnsCompleted - 1) * cycleDays + nextDeadlineDays;
    const date = new Date(today.getTime() + offset * 24 * 60 * 60 * 1000);
    const status: Turn["status"] =
      group.status === "completed"
        ? "completed"
        : i <= turnsCompleted
        ? "completed"
        : i === turnsCompleted + 1
        ? "current"
        : "upcoming";

    const isYou = i === group.yourTurn && group.status !== "completed";
    const fallback = FALLBACK_BENEFICIARIES[(i + group.id.length) % FALLBACK_BENEFICIARIES.length];

    turns.push({
      id: `${group.id}-t${i}`,
      groupId: group.id,
      groupName: group.name,
      index: i,
      total: group.members,
      date: formatDateFr(date),
      daysFromToday: Math.round(offset),
      beneficiaryName: isYou ? "Vous" : fallback.name,
      beneficiaryInitials: isYou ? "ED" : fallback.initials,
      isYou,
      amount: group.contribution * group.members,
      contributorsPaid:
        status === "current"
          ? Math.round(group.members * 0.8)
          : status === "completed"
          ? group.members
          : 0,
      contributorsTotal: group.members,
      status,
    });
  }

  return turns;
}

const TODAY = new Date(2025, 0, 3); // Aligns with mock dates ("5 Jan 2025" ≈ today + 2j).

export function getAllTurns(): Turn[] {
  return groups.flatMap((g) => generateTurnsForGroup(g, TODAY));
}

export function getYourNextTurn(): Turn | null {
  const all = getAllTurns().filter((t) => t.isYou && t.status !== "completed");
  if (all.length === 0) return null;
  return all.reduce((best, t) => (t.daysFromToday < best.daysFromToday ? t : best));
}

export function getRotationStats() {
  const all = getAllTurns();
  const yours = all.filter((t) => t.isYou);
  const yoursUpcoming = yours.filter((t) => t.status !== "completed");
  const yoursCompleted = yours.filter((t) => t.status === "completed");
  const totalCycle = all.length;
  const completedCycle = all.filter((t) => t.status === "completed").length;
  const next90 = all.filter((t) => t.daysFromToday >= 0 && t.daysFromToday <= 90).length;

  const expectedAmount = yoursUpcoming.reduce((s, t) => s + t.amount, 0);
  const receivedAmount = yoursCompleted.reduce((s, t) => s + t.amount, 0);

  return {
    yourUpcomingCount: yoursUpcoming.length,
    yourReceivedCount: yoursCompleted.length,
    expectedAmount,
    receivedAmount,
    next90,
    totalCycle,
    completedCycle,
    completionRate: totalCycle > 0 ? Math.round((completedCycle / totalCycle) * 100) : 0,
  };
}

export const swapProposals: SwapProposal[] = [
  {
    id: "swap-1",
    groupId: "g-madina",
    groupName: "Commerçants Madina",
    direction: "incoming",
    counterparty: "Aissatou Camara",
    counterpartyInitials: "AC",
    yourTurn: 8,
    theirTurn: 14,
    proposedOn: "02 Jan 2025",
    expiresIn: 3,
    message: "Bonjour, j'ai un besoin urgent — pouvez-vous échanger votre tour avec le mien ?",
    status: "pending",
  },
  {
    id: "swap-2",
    groupId: "g-donka",
    groupName: "Pilotes Donka",
    direction: "outgoing",
    counterparty: "Boubacar Doumbouya",
    counterpartyInitials: "BD",
    yourTurn: 12,
    theirTurn: 9,
    proposedOn: "30 Déc 2024",
    expiresIn: 5,
    message: "Bonsoir, accepterais-tu de prendre mon tour ? Je peux te redonner le tien plus tard.",
    status: "pending",
  },
  {
    id: "swap-3",
    groupId: "g-diallo",
    groupName: "Tontine Famille Diallo",
    direction: "outgoing",
    counterparty: "Mariama Touré",
    counterpartyInitials: "MT",
    yourTurn: 11,
    theirTurn: 6,
    proposedOn: "15 Déc 2024",
    expiresIn: 0,
    message: "—",
    status: "accepted",
  },
];

export const ledgerEvents: LedgerEvent[] = [
  {
    id: "le-1",
    type: "swap_proposed",
    timestamp: "02 Jan 2025 · 09:14",
    daysFromToday: -1,
    groupId: "g-madina",
    groupName: "Commerçants Madina",
    title: "Proposition d'échange reçue",
    detail: "Aissatou Camara propose d'échanger le tour #14 contre votre tour #8.",
    actor: "Aissatou Camara",
    signature: "0x4f9b…a128",
  },
  {
    id: "le-2",
    type: "payment_made",
    timestamp: "01 Jan 2025 · 11:02",
    daysFromToday: -3,
    groupId: "g-bureau",
    groupName: "Collègues Bureau",
    title: "Cotisation enregistrée",
    detail: "200 000 GNF prélevés sur MTN Mobile Money pour le tour #3.",
    actor: "Vous",
    signature: "0x6210…cf03",
  },
  {
    id: "le-3",
    type: "beneficiary_confirmed",
    timestamp: "29 Déc 2024 · 18:45",
    daysFromToday: -6,
    groupId: "g-madina",
    groupName: "Commerçants Madina",
    title: "Bénéficiaire confirmé pour le tour #7",
    detail: "Mamadou Diallo recevra la cagnotte (20 000 000 GNF) le 5 Jan.",
    actor: "Système",
    signature: "0x7301…29ef",
  },
  {
    id: "le-4",
    type: "rules_updated",
    timestamp: "27 Déc 2024 · 16:20",
    daysFromToday: -8,
    groupId: "g-donka",
    groupName: "Pilotes Donka",
    title: "Règles du groupe ajustées",
    detail: "Pénalité de retard portée à 8% après 2 jours (vote à 11/15).",
    actor: "Boubacar Doumbouya",
    signature: "0x9f02…b441",
  },
  {
    id: "le-5",
    type: "cagnotte_received",
    timestamp: "25 Déc 2024 · 10:38",
    daysFromToday: -10,
    groupId: "g-diallo",
    groupName: "Tontine Famille Diallo",
    title: "Cagnotte versée — Tour #7",
    detail: "6 000 000 GNF reçus sur MTN Mobile Money. Reçu généré.",
    actor: "Système",
    signature: "0xa12c…04dd",
  },
  {
    id: "le-6",
    type: "swap_accepted",
    timestamp: "15 Déc 2024 · 09:05",
    daysFromToday: -20,
    groupId: "g-diallo",
    groupName: "Tontine Famille Diallo",
    title: "Échange accepté",
    detail: "Mariama Touré a accepté de prendre votre tour #11 contre son tour #6.",
    actor: "Mariama Touré",
    signature: "0xb88f…1a07",
  },
  {
    id: "le-7",
    type: "member_added",
    timestamp: "10 Nov 2024 · 14:22",
    daysFromToday: -54,
    groupId: "g-kaloum",
    groupName: "Investisseurs Kaloum",
    title: "Nouveau membre admis",
    detail: "Néné Touré a rejoint le groupe (24/24 atteint).",
    actor: "Mariama Sylla",
    signature: "0xc014…78aa",
  },
  {
    id: "le-8",
    type: "cycle_started",
    timestamp: "01 Nov 2024 · 08:00",
    daysFromToday: -63,
    groupId: "g-kaloum",
    groupName: "Investisseurs Kaloum",
    title: "Cycle démarré",
    detail: "24 membres · 24 tours · cotisation mensuelle 2 000 000 GNF.",
    actor: "Système",
    signature: "0xd203…ee14",
  },
  {
    id: "le-9",
    type: "penalty_applied",
    timestamp: "28 Nov 2024 · 23:01",
    daysFromToday: -37,
    groupId: "g-diallo",
    groupName: "Tontine Famille Diallo",
    title: "Pénalité appliquée",
    detail: "Pénalité de 25 000 GNF (5%) appliquée pour 4 jours de retard.",
    actor: "Système",
    signature: "0xe9f1…b202",
  },
  {
    id: "le-10",
    type: "group_joined",
    timestamp: "01 Sep 2024 · 10:15",
    daysFromToday: -125,
    groupId: "g-madina",
    groupName: "Commerçants Madina",
    title: "Vous avez rejoint le groupe",
    detail: "Position d'entrée : tour #8 sur 20.",
    actor: "Vous",
    signature: "0xf201…9c44",
  },
  {
    id: "le-11",
    type: "kyc_verified",
    timestamp: "20 Avr 2024 · 17:33",
    daysFromToday: -260,
    title: "Identité vérifiée",
    detail: "Pièce d'identité contrôlée par le service conformité.",
    actor: "Service Conformité",
    signature: "0x0021…1f88",
  },
  {
    id: "le-12",
    type: "cycle_completed",
    timestamp: "01 Sep 2024 · 12:00",
    daysFromToday: -125,
    groupId: "g-sandervalia",
    groupName: "Artisans Sandervalia",
    title: "Cycle clôturé",
    detail: "6 tours bouclés · 600 000 GNF distribués · 0 pénalité.",
    actor: "Système",
    signature: "0x1145…6710",
  },
];

export function getCashflowSeries(): CashflowPoint[] {
  // Aggregate transactions by month over the last 12 months.
  const now = new Date(2025, 0, 3);
  const months: CashflowPoint[] = [];
  const monthLabels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ label: monthLabels[d.getMonth()], key, inflow: 0, outflow: 0, cumulative: 0 });
  }

  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const tx of transactions) {
    if (tx.status !== "success") continue;
    const days = tx.daysFromToday ?? 0;
    const date = new Date(now.getTime() + days * 86_400_000);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const slot = byKey.get(key);
    if (!slot) continue;
    if (tx.type === "in") slot.inflow += tx.amount;
    else slot.outflow += tx.amount;
  }

  let running = 0;
  for (const m of months) {
    running += m.inflow - m.outflow;
    m.cumulative = running;
  }
  return months;
}

export function getStatements(): MonthlyStatement[] {
  const series = getCashflowSeries();
  const now = new Date(2025, 0, 3);
  const monthsLong = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  return series
    .slice()
    .reverse()
    .slice(0, 6)
    .map((point, i) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ops = transactions.filter((t) => {
        if (t.status !== "success") return false;
        const d = new Date(now.getTime() + (t.daysFromToday ?? 0) * 86_400_000);
        return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth();
      }).length;

      const monthName = monthsLong[monthDate.getMonth()];
      const isCurrentMonth = i === 0;

      return {
        id: `stmt-${point.key}`,
        month: `${monthName} ${monthDate.getFullYear()}`,
        range: isCurrentMonth ? "01 — en cours" : `01 — 31 ${point.label.toLowerCase()}.`,
        inflow: point.inflow,
        outflow: point.outflow,
        net: point.inflow - point.outflow,
        operations: ops,
        status: isCurrentMonth ? "pending" : "ready",
      } satisfies MonthlyStatement;
    });
}

export function getHistoryStats() {
  const successful = transactions.filter((t) => t.status === "success");
  const inflow = successful.filter((t) => t.type === "in").reduce((s, t) => s + t.amount, 0);
  const outflow = successful.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0);
  const failed = transactions.filter((t) => t.status === "failed").length;
  const total = transactions.length;
  const executionRate = total > 0 ? Math.round(((total - failed) / total) * 100) : 0;
  return {
    inflow,
    outflow,
    net: inflow - outflow,
    operations: total,
    executionRate,
    failedCount: failed,
  };
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
