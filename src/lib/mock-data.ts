import type { Member, TontineGroup, Transaction } from "./types";

export const currentUser = {
  id: "user-1",
  name: "Elhadj Mamadou",
  initials: "ED",
  reliabilityScore: 98,
  phone: "+224 6XX XXX XXX",
};

export const groups: TontineGroup[] = [
  {
    id: "g-diallo",
    name: "Tontine Famille Diallo",
    members: 12,
    contribution: 500_000,
    frequency: "Mensuelle",
    nextPaymentDate: "15 Jan 2025",
    progress: 75,
    currentTurn: "Mamadou D.",
    yourTurn: 8,
    status: "active",
    totalCollected: 6_000_000,
    rules: [
      "Pénalité de retard : 5% après 3 jours",
      "Ordre de rotation : Aléatoire",
      "Échange de tours : Autorisé",
    ],
  },
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
    id: "g-bureau",
    name: "Collègues Bureau",
    members: 8,
    contribution: 200_000,
    frequency: "Mensuelle",
    nextPaymentDate: "1 Fév 2025",
    progress: 100,
    currentTurn: "Cycle terminé",
    yourTurn: 3,
    status: "completed",
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
    type: "out",
    groupId: "g-diallo",
    groupName: "Famille Diallo",
    amount: 500_000,
    date: "28 Déc 2024",
    status: "success",
    operator: "orange",
  },
  {
    id: "tx-2",
    type: "in",
    groupId: "g-madina",
    groupName: "Commerçants Madina",
    amount: 20_000_000,
    date: "25 Déc 2024",
    status: "success",
    operator: "mtn",
  },
  {
    id: "tx-3",
    type: "out",
    groupId: "g-bureau",
    groupName: "Collègues Bureau",
    amount: 200_000,
    date: "20 Déc 2024",
    status: "success",
    operator: "orange",
  },
  {
    id: "tx-4",
    type: "out",
    groupId: "g-diallo",
    groupName: "Famille Diallo",
    amount: 500_000,
    date: "28 Nov 2024",
    status: "success",
    operator: "orange",
  },
];

export function getGroupById(id: string): TontineGroup | undefined {
  return groups.find((g) => g.id === id);
}

export function getStats() {
  const activeGroups = groups.filter((g) => g.status !== "completed").length;
  const totalContributions = transactions.filter((t) => t.type === "out" && t.status === "success").length;
  return {
    activeGroups,
    totalContributions,
    reliabilityScore: currentUser.reliabilityScore,
    totalBalance: groups.reduce((sum, g) => sum + g.totalCollected, 0),
  };
}
