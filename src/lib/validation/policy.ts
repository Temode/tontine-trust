/**
 * Politique partagée du projet — règles métier appliquées côté client
 * (formulaires, modales) et côté API (RPC Postgres).
 *
 * Source unique de vérité : changer une valeur ici impacte toutes les
 * surfaces de validation.
 */
import { z } from "zod";

export const CONTRIBUTION_MIN_GNF = 1_000;
export const CONTRIBUTION_MAX_GNF = 50_000_000;
export const CONTRIBUTION_STEP_GNF = 1_000;

export const MEMBERS_MIN = 2;
export const MEMBERS_MAX = 50;

export const ALLOWED_FREQUENCIES = [
  "quotidienne",
  "hebdomadaire",
  "quinzaine",
  "mensuelle",
] as const;
export type AllowedFrequency = (typeof ALLOWED_FREQUENCIES)[number];

export const INVITE_CODE_REGEX = /^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export const contributionSchema = z
  .number({ invalid_type_error: "Cotisation requise." })
  .int("La cotisation doit être un nombre entier.")
  .min(CONTRIBUTION_MIN_GNF, `Minimum ${CONTRIBUTION_MIN_GNF.toLocaleString("fr-FR")} GNF.`)
  .max(CONTRIBUTION_MAX_GNF, `Maximum ${CONTRIBUTION_MAX_GNF.toLocaleString("fr-FR")} GNF.`)
  .refine((v) => v % CONTRIBUTION_STEP_GNF === 0, {
    message: `La cotisation doit être un multiple de ${CONTRIBUTION_STEP_GNF.toLocaleString("fr-FR")} GNF.`,
  });

export const membersSchema = z
  .number({ invalid_type_error: "Nombre de membres requis." })
  .int()
  .min(MEMBERS_MIN, `Au moins ${MEMBERS_MIN} membres.`)
  .max(MEMBERS_MAX, `Au maximum ${MEMBERS_MAX} membres.`);

export const inviteCodeSchema = z
  .string()
  .regex(INVITE_CODE_REGEX, "Format attendu : TD-XXXX-XXXX.");

/** Construit le lien public d'invitation à partir d'un code. */
export function buildInviteUrl(code: string): string {
  if (typeof window === "undefined") {
    return `https://tontine-digitale.lovable.app/rejoindre?code=${encodeURIComponent(code)}`;
  }
  return `${window.location.origin}/rejoindre?code=${encodeURIComponent(code)}`;
}