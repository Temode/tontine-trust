import type {
  CalendarEvent,
  CashflowPoint,
  DirectoryGroup,
  Invitation,
  JoinApplication,
  JoinRequest,
  KycDocument,
  LedgerEvent,
  Member,
  MonthlyStatement,
  PaymentMethod,
  ProfileActivityEntry,
  SessionDevice,
  SwapProposal,
  TontineGroup,
  Transaction,
  Turn,
  UserProfile,
} from "./types";

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

/** Reference "today" used across mocks so the calendar lines up with other pages. */
export const TODAY_REFERENCE = new Date(2025, 0, 3);

function isoDateFromOffset(daysFromToday: number): string {
  const d = new Date(TODAY_REFERENCE.getTime() + daysFromToday * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function offsetFromIso(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Math.round((date.getTime() - TODAY_REFERENCE.getTime()) / 86_400_000);
}

/** Custom recurring meetings, votes and reminders not derived from groups. */
const customCalendarEvents: Array<Omit<CalendarEvent, "daysFromToday">> = [
  {
    id: "ev-meeting-madina",
    type: "meeting",
    title: "Réunion mensuelle — Commerçants Madina",
    date: "2025-01-12",
    time: "18:00",
    endTime: "19:30",
    groupId: "g-madina",
    groupName: "Commerçants Madina",
    description: "Bilan du tour en cours, vote sur l'ajustement de la cotisation et débat sur l'extension du cycle.",
  },
  {
    id: "ev-meeting-kaloum",
    type: "meeting",
    title: "Comité d'investisseurs — Kaloum",
    date: "2025-01-25",
    time: "10:00",
    endTime: "12:00",
    groupId: "g-kaloum",
    groupName: "Investisseurs Kaloum",
    description: "Revue trimestrielle, validation de la prochaine vague d'enchères pour le tour suivant.",
  },
  {
    id: "ev-vote-donka",
    type: "rule-vote",
    title: "Vote — Pénalité de retard",
    date: "2025-01-09",
    time: "20:00",
    groupId: "g-donka",
    groupName: "Pilotes Donka",
    description: "Vote pour ramener la pénalité de 8% à 5% à partir du tour #11.",
  },
  {
    id: "ev-swap-deadline-1",
    type: "swap-deadline",
    title: "Expiration — Échange #SW-1",
    date: "2025-01-05",
    time: "23:59",
    groupId: "g-madina",
    groupName: "Commerçants Madina",
    description: "Réponse attendue à la proposition d'échange de Aissatou Camara.",
  },
  {
    id: "ev-reminder-kyc",
    type: "reminder",
    title: "Rappel — Mise à jour KYC",
    date: "2025-01-15",
    time: "09:00",
    description: "Renouvellement annuel de la pièce d'identité auprès du service conformité.",
  },
  {
    id: "ev-cycle-end-bureau",
    type: "cycle-end",
    title: "Clôture du cycle — Collègues Bureau",
    date: "2025-08-01",
    groupId: "g-bureau",
    groupName: "Collègues Bureau",
    description: "Le cycle de 8 mois se termine. Possibilité de relancer un nouveau cycle.",
  },
  {
    id: "ev-meeting-diallo",
    type: "meeting",
    title: "Conseil de famille — Tontine Diallo",
    date: "2025-02-08",
    time: "16:00",
    endTime: "18:00",
    groupId: "g-diallo",
    groupName: "Tontine Famille Diallo",
    description: "Mise à jour des coordonnées Mobile Money et discussion du prochain cycle.",
  },
  {
    id: "ev-cycle-start-conakry",
    type: "cycle-start",
    title: "Démarrage du cycle — Entrepreneurs Conakry",
    date: "2025-02-15",
    groupId: "g-conakry",
    groupName: "Entrepreneurs Conakry",
    description: "Premier prélèvement programmé une fois les 10 inscriptions confirmées.",
  },
  {
    id: "ev-vote-kaloum",
    type: "rule-vote",
    title: "Vote — Plafond d'enchère",
    date: "2025-02-20",
    time: "19:00",
    groupId: "g-kaloum",
    groupName: "Investisseurs Kaloum",
    description: "Plafonnement de l'enchère pour acheter un tour à 8% de la cagnotte.",
  },
  {
    id: "ev-meeting-donka",
    type: "meeting",
    title: "Briefing hebdomadaire — Pilotes Donka",
    date: "2025-01-22",
    time: "07:30",
    endTime: "08:00",
    groupId: "g-donka",
    groupName: "Pilotes Donka",
  },
];

/** Build the unified calendar feed from groups, turns, transactions, swaps and custom events. */
export function getCalendarEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  // Contributions à venir (échéances)
  for (const g of groups) {
    if (g.status === "completed" || g.status === "pending") continue;
    if (g.daysToDeadline === undefined) continue;
    events.push({
      id: `cal-contrib-${g.id}`,
      type: "contribution",
      title: `Cotisation — ${g.name}`,
      date: isoDateFromOffset(g.daysToDeadline),
      daysFromToday: g.daysToDeadline,
      groupId: g.id,
      groupName: g.name,
      amount: g.contribution,
      description: `Prélèvement de ${formatGNFMock(g.contribution)} GNF · ${g.frequency.toLowerCase()}.`,
      status: "scheduled",
    });
  }

  // Tours bénéficiaires (à partir du roster complet)
  for (const t of getAllTurns()) {
    if (t.daysFromToday < -7 || t.daysFromToday > 365) continue;
    events.push({
      id: `cal-turn-${t.id}`,
      type: t.isYou ? "your-turn" : "turn",
      title: t.isYou ? `Vous recevez la cagnotte — ${t.groupName}` : `Tour ${t.beneficiaryName} — ${t.groupName}`,
      date: isoDateFromOffset(t.daysFromToday),
      daysFromToday: t.daysFromToday,
      groupId: t.groupId,
      groupName: t.groupName,
      amount: t.amount,
      isYou: t.isYou,
      description: `Tour #${t.index} sur ${t.total}. Versement automatique à l'encaissement complet.`,
      status: t.status === "completed" ? "completed" : "scheduled",
    });
  }

  // Transactions historiques importantes (entrées de cagnottes)
  for (const tx of transactions) {
    if (tx.status !== "success" || tx.type !== "in") continue;
    const days = tx.daysFromToday ?? 0;
    if (days < -90 || days > 0) continue;
    events.push({
      id: `cal-rx-${tx.id}`,
      type: "your-turn",
      title: `Cagnotte reçue — ${tx.groupName}`,
      date: isoDateFromOffset(days),
      daysFromToday: days,
      groupId: tx.groupId,
      groupName: tx.groupName,
      amount: tx.amount,
      isYou: true,
      description: `Versement encaissé via ${tx.operator === "orange" ? "Orange Money" : "MTN Mobile Money"}. Référence ${tx.reference ?? "—"}.`,
      status: "completed",
    });
  }

  // Échéances d'expiration des swap proposals
  for (const swap of swapProposals) {
    if (swap.status !== "pending" || swap.expiresIn <= 0) continue;
    events.push({
      id: `cal-swap-${swap.id}`,
      type: "swap-deadline",
      title: `Échange à statuer — ${swap.groupName}`,
      date: isoDateFromOffset(swap.expiresIn),
      daysFromToday: swap.expiresIn,
      groupId: swap.groupId,
      groupName: swap.groupName,
      description: `${swap.direction === "incoming" ? "Réponse attendue à" : "Échéance de"} la proposition de ${swap.counterparty}.`,
      status: "scheduled",
    });
  }

  // Événements personnalisés (réunions, votes, rappels)
  for (const ev of customCalendarEvents) {
    events.push({
      ...ev,
      daysFromToday: offsetFromIso(ev.date),
    });
  }

  // Tri chronologique
  events.sort((a, b) => a.daysFromToday - b.daysFromToday);

  // Dé-doublonnage par id (sécurité au cas où)
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

function formatGNFMock(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

export function getCalendarStats() {
  const events = getCalendarEvents();
  const now = TODAY_REFERENCE;
  const isSameMonth = (e: CalendarEvent) => {
    const [y, m] = e.date.split("-").map(Number);
    return y === now.getFullYear() && m === now.getMonth() + 1;
  };

  const thisMonth = events.filter(isSameMonth);
  const thisWeek = events.filter((e) => e.daysFromToday >= 0 && e.daysFromToday <= 7);
  const urgent = events.filter((e) => e.daysFromToday >= 0 && e.daysFromToday <= 3);
  const monthCapital = thisMonth
    .filter((e) => e.amount && (e.type === "contribution" || e.type === "your-turn" || e.type === "turn"))
    .reduce((s, e) => s + (e.amount ?? 0), 0);

  return {
    monthCount: thisMonth.length,
    weekCount: thisWeek.length,
    urgentCount: urgent.length,
    monthCapital,
  };
}

export const directoryGroups: DirectoryGroup[] = [
  {
    id: "dir-yelimane",
    name: "Femmes Entrepreneures Kindia",
    category: "business",
    description:
      "Tontine de marchandes et artisanes du marché de Kindia. Cotisations mensuelles dédiées au financement de stocks et d'équipements.",
    organizerName: "Salimatou Bah",
    organizerInitials: "SB",
    organizerScore: 98,
    members: 18,
    filled: 14,
    contribution: 750_000,
    frequency: "Mensuelle",
    rotationOrder: "fixed",
    swapPolicy: "consensus",
    latePenaltyPercent: 5,
    visibility: "directory",
    inviteCode: "TD-K3PY-7QM2",
    startsInDays: 21,
    meanScore: 94,
    createdOn: "12 Déc 2024",
    rules: [
      "Pénalité de retard : 5% après 3 jours",
      "Ordre de rotation : Fixe par ancienneté",
      "Échange de tours : Sur consensus du groupe",
    ],
    tags: ["marché", "commerce", "femmes"],
  },
  {
    id: "dir-conakry-tech",
    name: "Conakry Tech Builders",
    category: "professional",
    description:
      "Ingénieurs et opérateurs tech du grand Conakry. Cycle hebdomadaire pour soutenir équipements, certifications et amorçage de projets.",
    organizerName: "Mohamed Camara",
    organizerInitials: "MC",
    organizerScore: 96,
    members: 12,
    filled: 9,
    contribution: 500_000,
    frequency: "Hebdomadaire",
    rotationOrder: "auction",
    swapPolicy: "open",
    latePenaltyPercent: 10,
    visibility: "directory",
    inviteCode: "TD-NX5R-PB31",
    startsInDays: 7,
    meanScore: 95,
    createdOn: "20 Déc 2024",
    rules: [
      "Pénalité de retard : 10% après 1 jour",
      "Ordre de rotation : Enchères à chaque tour",
      "Échange de tours : Libre",
    ],
    tags: ["tech", "ingénieurs", "professionnel"],
  },
  {
    id: "dir-diaspora",
    name: "Diaspora Guinée — Europe",
    category: "community",
    description:
      "Guinéens d'Europe contribuant en Mobile Money pour des projets immobiliers à Conakry, Labé et Boké. Cycle bi-mensuel sur 24 mois.",
    organizerName: "Aminata Sow",
    organizerInitials: "AS",
    organizerScore: 99,
    members: 24,
    filled: 22,
    contribution: 1_500_000,
    frequency: "Quinzaine",
    rotationOrder: "random",
    swapPolicy: "closed",
    latePenaltyPercent: 8,
    visibility: "directory",
    inviteCode: "TD-D9TA-K2LM",
    startsInDays: 3,
    meanScore: 97,
    createdOn: "01 Nov 2024",
    rules: [
      "Pénalité de retard : 8% après 2 jours",
      "Ordre de rotation : Tirage au sort à l'émission",
      "Échange de tours : Interdit",
    ],
    tags: ["diaspora", "immobilier", "long-terme"],
  },
  {
    id: "dir-madina-marche",
    name: "Vendeuses Madina — Bloc B",
    category: "business",
    description:
      "Tontine de proximité du marché Madina, bloc B. Soutien rapide à la trésorerie quotidienne, démarrage immédiat dès complétion.",
    organizerName: "Hadja Touré",
    organizerInitials: "HT",
    organizerScore: 92,
    members: 10,
    filled: 7,
    contribution: 200_000,
    frequency: "Hebdomadaire",
    rotationOrder: "fixed",
    swapPolicy: "open",
    latePenaltyPercent: 5,
    visibility: "public-link",
    inviteCode: "TD-MN4Q-V8XK",
    startsInDays: 14,
    meanScore: 90,
    createdOn: "28 Déc 2024",
    rules: [
      "Pénalité de retard : 5% après 2 jours",
      "Ordre de rotation : Fixe",
      "Échange de tours : Libre",
    ],
    tags: ["marché", "trésorerie", "rapide"],
  },
  {
    id: "dir-ratoma-jeunesse",
    name: "Jeunesse Ratoma — Solidarité",
    category: "community",
    description:
      "Cycle solidaire pour jeunes diplômés en attente d'emploi. Cotisations modestes et flexibles, échanges de tours encouragés.",
    organizerName: "Ibrahima Bah",
    organizerInitials: "IB",
    organizerScore: 88,
    members: 15,
    filled: 8,
    contribution: 100_000,
    frequency: "Mensuelle",
    rotationOrder: "choice",
    swapPolicy: "open",
    latePenaltyPercent: 0,
    visibility: "directory",
    inviteCode: "TD-RJ8Y-3HFP",
    startsInDays: 30,
    meanScore: 86,
    createdOn: "30 Déc 2024",
    rules: [
      "Pénalité de retard : Aucune",
      "Ordre de rotation : Choix individuel",
      "Échange de tours : Libre",
    ],
    tags: ["jeunesse", "solidaire", "flexible"],
  },
  {
    id: "dir-export-coton",
    name: "Coopérative Export Coton",
    category: "business",
    description:
      "Réseau d'exportateurs de coton de Haute-Guinée. Cotisation élevée, cycle long, gouvernance stricte avec co-organisateurs notarisés.",
    organizerName: "Kalil Sylla",
    organizerInitials: "KS",
    organizerScore: 99,
    members: 20,
    filled: 16,
    contribution: 5_000_000,
    frequency: "Mensuelle",
    rotationOrder: "auction",
    swapPolicy: "consensus",
    latePenaltyPercent: 12,
    visibility: "directory",
    inviteCode: "TD-EC7B-8WJN",
    startsInDays: 45,
    meanScore: 96,
    createdOn: "15 Nov 2024",
    rules: [
      "Pénalité de retard : 12% après 1 jour",
      "Ordre de rotation : Enchères avec plafond",
      "Échange de tours : Sur consensus notarié",
    ],
    tags: ["coopérative", "export", "haute-guinée"],
  },
];

export const myApplications: JoinApplication[] = [
  {
    id: "app-1",
    groupId: "dir-yelimane",
    groupName: "Femmes Entrepreneures Kindia",
    organizerName: "Salimatou Bah",
    organizerInitials: "SB",
    contribution: 750_000,
    members: 18,
    appliedOn: "31 Déc 2024",
    daysFromToday: -3,
    status: "pending",
    message:
      "Bonjour, je suis artisane à Kindia depuis 6 ans. Je souhaite rejoindre pour financer un nouveau lot de matières premières.",
  },
  {
    id: "app-2",
    groupId: "dir-conakry-tech",
    groupName: "Conakry Tech Builders",
    organizerName: "Mohamed Camara",
    organizerInitials: "MC",
    contribution: 500_000,
    members: 12,
    appliedOn: "28 Déc 2024",
    daysFromToday: -6,
    status: "accepted",
    message: "Demande acceptée le 30 Déc. Premier prélèvement le 10 Jan.",
  },
  {
    id: "app-3",
    groupId: "dir-export-coton",
    groupName: "Coopérative Export Coton",
    organizerName: "Kalil Sylla",
    organizerInitials: "KS",
    contribution: 5_000_000,
    members: 20,
    appliedOn: "15 Déc 2024",
    daysFromToday: -19,
    status: "declined",
    message:
      "Demande refusée — cotisation au-delà du seuil de votre score actuel. Réessayez après votre 3e cycle réussi.",
  },
];

export function findDirectoryGroupByCode(code: string): DirectoryGroup | null {
  const normalized = code.trim().toUpperCase();
  return directoryGroups.find((g) => g.inviteCode === normalized) ?? null;
}

export function getJoinStats() {
  const open = directoryGroups.filter((g) => g.filled < g.members).length;
  const startingSoon = directoryGroups.filter((g) => g.startsInDays >= 0 && g.startsInDays <= 14).length;
  const contributions = directoryGroups.map((g) => g.contribution).sort((a, b) => a - b);
  const median =
    contributions.length === 0
      ? 0
      : contributions.length % 2 === 0
      ? (contributions[contributions.length / 2 - 1] + contributions[contributions.length / 2]) / 2
      : contributions[Math.floor(contributions.length / 2)];
  const myPending = myApplications.filter((a) => a.status === "pending").length;

  return {
    openCount: open,
    medianContribution: median,
    pendingApplications: myPending,
    startingSoon,
  };
}

/**
 * Groups whose role is "organizer" — those for which the current user can
 * issue invitations. Used by the InviteMembers page selector.
 */
export const myOrganizedGroups: TontineGroup[] = groups.filter((g) => g.role === "organizer");

export const invitations: Invitation[] = [
  // g-conakry (Entrepreneurs Conakry — pending, recruiting)
  {
    id: "inv-c1",
    groupId: "g-conakry",
    groupName: "Entrepreneurs Conakry",
    recipientName: "Aïssatou Diallo",
    recipientInitials: "AD",
    recipientPhone: "+224 622 14 25 36",
    channel: "sms",
    sentOn: "02 Jan 2025",
    daysFromToday: -1,
    status: "joined",
    openedOn: "02 Jan · 14:22",
  },
  {
    id: "inv-c2",
    groupId: "g-conakry",
    groupName: "Entrepreneurs Conakry",
    recipientName: "Mamadou Bah",
    recipientInitials: "MB",
    recipientPhone: "+224 661 02 84 19",
    channel: "sms",
    sentOn: "02 Jan 2025",
    daysFromToday: -1,
    status: "opened",
    openedOn: "02 Jan · 18:04",
  },
  {
    id: "inv-c3",
    groupId: "g-conakry",
    groupName: "Entrepreneurs Conakry",
    recipientName: "Fatoumata Sow",
    recipientInitials: "FS",
    recipientPhone: "+224 628 47 11 92",
    channel: "sms",
    sentOn: "01 Jan 2025",
    daysFromToday: -3,
    status: "joined",
    openedOn: "01 Jan · 09:11",
  },
  {
    id: "inv-c4",
    groupId: "g-conakry",
    groupName: "Entrepreneurs Conakry",
    recipientName: "Ousmane Camara",
    recipientInitials: "OC",
    recipientPhone: "+224 624 03 56 78",
    channel: "sms",
    sentOn: "01 Jan 2025",
    daysFromToday: -3,
    status: "sent",
  },
  {
    id: "inv-c5",
    groupId: "g-conakry",
    groupName: "Entrepreneurs Conakry",
    recipientEmail: "n.toure@kaloum-corp.gn",
    recipientName: "Néné Touré",
    recipientInitials: "NT",
    channel: "email",
    sentOn: "31 Déc 2024",
    daysFromToday: -4,
    status: "declined",
    message: "Merci, mais je participe déjà à deux tontines en parallèle.",
  },
  {
    id: "inv-c6",
    groupId: "g-conakry",
    groupName: "Entrepreneurs Conakry",
    channel: "link",
    recipientName: "Lien partagé",
    recipientInitials: "LP",
    sentOn: "30 Déc 2024",
    daysFromToday: -5,
    status: "opened",
    openedOn: "31 Déc · 11:45",
  },
  {
    id: "inv-c7",
    groupId: "g-conakry",
    groupName: "Entrepreneurs Conakry",
    recipientName: "Boubacar Touré",
    recipientInitials: "BT",
    recipientPhone: "+224 666 91 28 03",
    channel: "sms",
    sentOn: "28 Déc 2024",
    daysFromToday: -7,
    status: "expired",
  },
  {
    id: "inv-c8",
    groupId: "g-conakry",
    groupName: "Entrepreneurs Conakry",
    recipientName: "Mariama Diaby",
    recipientInitials: "MD",
    recipientPhone: "+224 624 88 47 12",
    channel: "qr",
    sentOn: "27 Déc 2024",
    daysFromToday: -8,
    status: "joined",
    openedOn: "27 Déc · 17:20",
  },
  // g-diallo (Tontine Famille Diallo)
  {
    id: "inv-d1",
    groupId: "g-diallo",
    groupName: "Tontine Famille Diallo",
    recipientName: "Hadja Touré",
    recipientInitials: "HT",
    recipientPhone: "+224 621 33 78 02",
    channel: "sms",
    sentOn: "20 Déc 2024",
    daysFromToday: -15,
    status: "joined",
    openedOn: "20 Déc · 16:42",
  },
  {
    id: "inv-d2",
    groupId: "g-diallo",
    groupName: "Tontine Famille Diallo",
    recipientName: "Alpha Conté",
    recipientInitials: "AC",
    recipientPhone: "+224 661 47 19 03",
    channel: "sms",
    sentOn: "18 Déc 2024",
    daysFromToday: -17,
    status: "joined",
  },
  // g-donka (Pilotes Donka)
  {
    id: "inv-do1",
    groupId: "g-donka",
    groupName: "Pilotes Donka",
    recipientName: "Salif Kaba",
    recipientInitials: "SK",
    recipientPhone: "+224 628 11 47 92",
    channel: "sms",
    sentOn: "29 Déc 2024",
    daysFromToday: -6,
    status: "opened",
    openedOn: "29 Déc · 22:01",
  },
  {
    id: "inv-do2",
    groupId: "g-donka",
    groupName: "Pilotes Donka",
    recipientName: "Lansana Camara",
    recipientInitials: "LC",
    recipientPhone: "+224 666 03 28 17",
    channel: "sms",
    sentOn: "28 Déc 2024",
    daysFromToday: -7,
    status: "joined",
  },
];

export const joinRequests: JoinRequest[] = [
  {
    id: "jr-1",
    groupId: "g-conakry",
    groupName: "Entrepreneurs Conakry",
    applicantName: "Kankou Bah",
    applicantInitials: "KB",
    applicantPhone: "+224 622 47 19 28",
    applicantScore: 96,
    appliedOn: "02 Jan 2025",
    daysFromToday: -1,
    status: "pending",
    channel: "directory",
    cold: true,
    message:
      "Bonjour, je gère deux boutiques à Madina depuis 2018. J'aimerais rejoindre votre cycle pour financer un nouveau local.",
  },
  {
    id: "jr-2",
    groupId: "g-conakry",
    groupName: "Entrepreneurs Conakry",
    applicantName: "Thierno Diallo",
    applicantInitials: "TD",
    applicantPhone: "+224 661 22 84 03",
    applicantScore: 92,
    appliedOn: "01 Jan 2025",
    daysFromToday: -3,
    status: "pending",
    channel: "link",
    message:
      "J'ai obtenu votre lien via Mamadou. Score de 92% sur trois cycles. Disponible pour un appel.",
  },
  {
    id: "jr-3",
    groupId: "g-conakry",
    groupName: "Entrepreneurs Conakry",
    applicantName: "Aminata Diaby",
    applicantInitials: "AD",
    applicantPhone: "+224 624 03 87 14",
    applicantScore: 88,
    appliedOn: "31 Déc 2024",
    daysFromToday: -4,
    status: "pending",
    channel: "directory",
    cold: true,
  },
  {
    id: "jr-4",
    groupId: "g-conakry",
    groupName: "Entrepreneurs Conakry",
    applicantName: "Sekou Konaté",
    applicantInitials: "SK",
    applicantPhone: "+224 628 14 92 03",
    applicantScore: 74,
    appliedOn: "30 Déc 2024",
    daysFromToday: -5,
    status: "pending",
    channel: "directory",
    cold: true,
    message: "Première participation à une tontine digitale. Solde Mobile Money disponible.",
  },
  {
    id: "jr-5",
    groupId: "g-donka",
    groupName: "Pilotes Donka",
    applicantName: "Moussa Bangoura",
    applicantInitials: "MB",
    applicantPhone: "+224 666 47 28 19",
    applicantScore: 95,
    appliedOn: "29 Déc 2024",
    daysFromToday: -6,
    status: "pending",
    channel: "link",
  },
];

/** Return the invite code for a given organized group. */
export function getInviteCodeForGroup(groupId: string): string {
  // Deterministic 8-char code based on the groupId. Same group always gets the same code.
  const seed = groupId.replace(/[^a-z0-9]/gi, "").toUpperCase().padEnd(8, "X");
  const a = seed.slice(0, 4);
  const b = seed.slice(4, 8);
  return `TD-${a}-${b}`;
}

export function getInviteStats(groupId: string) {
  const group = groups.find((g) => g.id === groupId);
  const inv = invitations.filter((i) => i.groupId === groupId);
  const joined = inv.filter((i) => i.status === "joined").length;
  const sent = inv.length;
  const conversion = sent > 0 ? Math.round((joined / sent) * 100) : 0;
  const opened = inv.filter((i) => i.status === "opened" || i.status === "joined" || i.status === "declined").length;
  const slots = group ? Math.max(0, group.members - joined) : 0;
  // Average response delay in hours, mocked.
  const responded = inv.filter((i) => i.openedOn && i.daysFromToday !== undefined);
  const avgHours = responded.length > 0 ? Math.round(((Math.abs(inv.reduce((s, i) => s + (i.daysFromToday ?? 0), 0)) / responded.length) * 24) / 6) : 0;
  return {
    slots,
    sent,
    joined,
    opened,
    conversion,
    avgResponseHours: avgHours,
    pendingRequests: joinRequests.filter((r) => r.groupId === groupId && r.status === "pending").length,
  };
}

export const userProfile: UserProfile = {
  id: currentUser.id,
  fullName: "Elhadj Mamadou Diallo",
  initials: currentUser.initials,
  phone: currentUser.phone,
  email: "elhadj.diallo@kaloum-corp.gn",
  city: "Conakry",
  country: "Guinée",
  language: "fr",
  occupation: "Entrepreneur · co-fondateur Kaloum Corp",
  bio: "Co-fondateur de Kaloum Corp · investisseur dans 5 tontines actives à travers le grand Conakry et la diaspora.",
  memberSince: "01 Mars 2024",
  tenureMonths: 10,
  reliabilityScore: currentUser.reliabilityScore,
  kycLevel: 2,
  kycVerifiedOn: "20 Avr 2024",
  twoFactorEnabled: true,
  biometricEnabled: true,
  notificationChannels: { sms: true, push: true, email: false },
  notificationCadence: "real-time",
  currency: "GNF",
  theme: "system",
  badges: ["bronze-payer", "early-adopter", "organizer-trusted"],
  lifetimeContributions: 18_400_000,
  lifetimeCagnottes: 27_600_000,
  cyclesCompleted: 3,
  cyclesActive: 5,
  onTimeRate: 98,
};

export const kycDocuments: KycDocument[] = [
  {
    id: "kyc-cni",
    type: "national_id",
    label: "Carte nationale d'identité",
    reference: "GN-CNI-784512903",
    uploadedOn: "18 Avr 2024",
    status: "verified",
    expiresOn: "18 Avr 2029",
  },
  {
    id: "kyc-selfie",
    type: "selfie",
    label: "Vérification biométrique",
    uploadedOn: "20 Avr 2024",
    status: "verified",
  },
  {
    id: "kyc-utility",
    type: "utility_bill",
    label: "Justificatif de domicile",
    reference: "EDG-#202403",
    uploadedOn: "10 Mar 2024",
    status: "verified",
    expiresOn: "10 Mar 2025",
  },
  {
    id: "kyc-tax",
    type: "tax_id",
    label: "NIF · Numéro fiscal",
    reference: "NIF-GN-094218",
    uploadedOn: "12 Mar 2024",
    status: "pending",
  },
];

export const sessionDevices: SessionDevice[] = [
  {
    id: "dev-1",
    device: "iPhone 15 Pro",
    os: "iOS 18.2",
    browser: "Safari Mobile",
    city: "Conakry · Kaloum",
    ip: "41.218.92.114",
    lastActive: "À l'instant",
    daysFromToday: 0,
    current: true,
  },
  {
    id: "dev-2",
    device: "MacBook Pro 14\"",
    os: "macOS 15.1",
    browser: "Chrome 131",
    city: "Conakry · Ratoma",
    ip: "41.218.92.114",
    lastActive: "Il y a 2 heures",
    daysFromToday: 0,
    current: false,
  },
  {
    id: "dev-3",
    device: "Pixel 8",
    os: "Android 15",
    browser: "Chrome Mobile",
    city: "Labé",
    ip: "41.220.114.78",
    lastActive: "Il y a 3 jours",
    daysFromToday: -3,
    current: false,
  },
];

export const profileActivity: ProfileActivityEntry[] = [
  {
    id: "pa-1",
    type: "login",
    title: "Connexion réussie",
    detail: "iPhone 15 Pro · Conakry · 41.218.92.114",
    timestamp: "Aujourd'hui · 09:14",
    daysFromToday: 0,
    signature: "0x9c12…44ab",
  },
  {
    id: "pa-2",
    type: "security_change",
    title: "Authentification biométrique activée",
    detail: "Face ID enregistré sur iPhone 15 Pro.",
    timestamp: "Hier · 21:08",
    daysFromToday: -1,
    signature: "0x44b1…0e2d",
  },
  {
    id: "pa-3",
    type: "payment_method",
    title: "Méthode de paiement ajoutée",
    detail: "MTN Mobile Money +224 661 00 00 00 vérifiée par OTP.",
    timestamp: "28 Déc · 14:22",
    daysFromToday: -7,
    signature: "0x7140…d1cc",
  },
  {
    id: "pa-4",
    type: "kyc_update",
    title: "Dépôt du NIF fiscal",
    detail: "Document NIF-GN-094218 soumis pour passage en KYC niveau 3.",
    timestamp: "12 Déc · 11:03",
    daysFromToday: -23,
    signature: "0xa044…9b71",
  },
  {
    id: "pa-5",
    type: "profile_edit",
    title: "Mise à jour du profil",
    detail: "Occupation passée à « Entrepreneur · co-fondateur Kaloum Corp ».",
    timestamp: "01 Déc · 10:42",
    daysFromToday: -34,
    signature: "0xbb02…117f",
  },
  {
    id: "pa-6",
    type: "preferences",
    title: "Canaux de notification ajustés",
    detail: "E-mail désactivé · SMS et push conservés en temps réel.",
    timestamp: "10 Nov · 18:55",
    daysFromToday: -55,
    signature: "0xc811…9203",
  },
  {
    id: "pa-7",
    type: "data_export",
    title: "Export du registre demandé",
    detail: "Pack CSV + PDF · 12 mois · délivré sous 72h.",
    timestamp: "20 Oct · 09:30",
    daysFromToday: -76,
    signature: "0xd92f…7a14",
  },
];

export interface ProfileBadgeDef {
  id: string;
  label: string;
  description: string;
}

export const badgeDefinitions: Record<string, ProfileBadgeDef> = {
  "bronze-payer": {
    id: "bronze-payer",
    label: "Payeur bronze",
    description: "12 cotisations consécutives à temps.",
  },
  "early-adopter": {
    id: "early-adopter",
    label: "Pionnier",
    description: "Inscrit dans les 1 000 premiers utilisateurs.",
  },
  "organizer-trusted": {
    id: "organizer-trusted",
    label: "Organisateur de confiance",
    description: "3 groupes émis sans incident, score moyen ≥ 90%.",
  },
};

/** Reliability score breakdown — weighted factors that aggregate into the global score. */
export interface ReliabilityFactor {
  id: string;
  label: string;
  hint: string;
  value: number;
  /** Display unit suffix. */
  unit?: string;
  /** Weighting in percent of the final score. */
  weight: number;
}

export function getReliabilityBreakdown(): ReliabilityFactor[] {
  return [
    {
      id: "ontime",
      label: "Ponctualité des paiements",
      hint: "Cotisations payées avant l'échéance sur 12 mois.",
      value: userProfile.onTimeRate,
      unit: "%",
      weight: 45,
    },
    {
      id: "tenure",
      label: "Ancienneté",
      hint: "Présence sur la plateforme.",
      value: Math.min(100, Math.round((userProfile.tenureMonths / 24) * 100)),
      unit: "/100",
      weight: 15,
    },
    {
      id: "volume",
      label: "Volume cumulé",
      hint: "Capital engagé sur l'ensemble des cycles.",
      value: Math.min(100, Math.round((userProfile.lifetimeContributions / 25_000_000) * 100)),
      unit: "/100",
      weight: 25,
    },
    {
      id: "completion",
      label: "Cycles complétés",
      hint: "Nombre de cycles achevés sans manquement.",
      value: Math.min(100, userProfile.cyclesCompleted * 25),
      unit: "/100",
      weight: 15,
    },
  ];
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
