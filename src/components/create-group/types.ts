import type { Frequency } from "@/lib/types";

export type GroupCategory = "family" | "professional" | "business" | "community";

export type RotationOrder = "random" | "fixed" | "auction" | "choice";

export type SwapPolicy = "open" | "consensus" | "closed";

export type Visibility = "private" | "public-link" | "directory";

export interface GroupDraft {
  /** Identité */
  name: string;
  description: string;
  category: GroupCategory;

  /** Paramètres financiers */
  contribution: number;
  frequency: Frequency;
  members: number;

  /** Règles */
  rotationOrder: RotationOrder;
  latePenaltyPercent: number;
  latePenaltyAfterDays: number;
  swapPolicy: SwapPolicy;

  /** Invitations */
  inviteCode: string;
  visibility: Visibility;
  coOrganizerPhones: string;
}

export const DEFAULT_DRAFT: GroupDraft = {
  name: "",
  description: "",
  category: "family",
  contribution: 500_000,
  frequency: "Mensuelle",
  members: 12,
  rotationOrder: "random",
  latePenaltyPercent: 5,
  latePenaltyAfterDays: 3,
  swapPolicy: "consensus",
  inviteCode: generateInviteCode(),
  visibility: "private",
  coOrganizerPhones: "",
};

export function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `TD-${code.slice(0, 4)}-${code.slice(4)}`;
}

export const FREQUENCY_DAYS: Record<Frequency, number> = {
  Hebdomadaire: 7,
  Quinzaine: 14,
  Mensuelle: 30,
};

export interface DraftDerived {
  cagnotte: number;
  cycleDays: number;
  cycleLabel: string;
  cyclesPerYear: number;
  yourTurnEarliestLabel: string;
  yourTurnLatestLabel: string;
}

export function deriveFromDraft(draft: GroupDraft): DraftDerived {
  const cagnotte = draft.contribution * draft.members;
  const cycleDays = draft.members * FREQUENCY_DAYS[draft.frequency];
  const cycleLabel =
    cycleDays >= 365
      ? `${(cycleDays / 365).toFixed(1)} an${cycleDays >= 365 * 2 ? "s" : ""}`
      : cycleDays >= 30
      ? `${Math.round(cycleDays / 30)} mois`
      : `${cycleDays} jours`;
  const cyclesPerYear = +(365 / cycleDays).toFixed(2);

  const earliestDays = FREQUENCY_DAYS[draft.frequency];
  const latestDays = (draft.members - 1) * FREQUENCY_DAYS[draft.frequency];

  return {
    cagnotte,
    cycleDays,
    cycleLabel,
    cyclesPerYear,
    yourTurnEarliestLabel: formatHorizon(earliestDays),
    yourTurnLatestLabel: formatHorizon(latestDays),
  };
}

function formatHorizon(days: number): string {
  if (days < 14) return `${days} jours`;
  if (days < 60) return `${Math.round(days / 7)} semaines`;
  if (days < 365) return `${Math.round(days / 30)} mois`;
  return `${(days / 365).toFixed(1)} an${days >= 730 ? "s" : ""}`;
}

export interface StepConfig {
  id: number;
  key: string;
  title: string;
  subtitle: string;
}

export const STEPS: StepConfig[] = [
  { id: 1, key: "identity", title: "Identité", subtitle: "Identification du groupe" },
  { id: 2, key: "financials", title: "Paramètres", subtitle: "Cotisation et fréquence" },
  { id: 3, key: "rules", title: "Règles", subtitle: "Rotation et conformité" },
  { id: 4, key: "invitations", title: "Invitations", subtitle: "Membres et accès" },
  { id: 5, key: "review", title: "Émission", subtitle: "Validation finale" },
];

export const CATEGORY_LABEL: Record<GroupCategory, string> = {
  family: "Famille",
  professional: "Collègues",
  business: "Commerçants",
  community: "Communauté",
};

export const ROTATION_LABEL: Record<RotationOrder, string> = {
  random: "Tirage au sort",
  fixed: "Ordre fixe",
  auction: "Enchères",
  choice: "Choix individuel",
};

export const SWAP_LABEL: Record<SwapPolicy, string> = {
  open: "Échanges libres",
  consensus: "Échanges sur consensus",
  closed: "Échanges interdits",
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: "Privé · sur invitation",
  "public-link": "Lien partageable",
  directory: "Annuaire public",
};
