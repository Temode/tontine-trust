import { z } from "zod";

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Le nom du groupe doit faire au moins 3 caractères.")
    .max(64, "Le nom ne peut pas dépasser 64 caractères."),
  description: z
    .string()
    .trim()
    .max(280, "La description ne peut pas dépasser 280 caractères.")
    .optional()
    .or(z.literal("")),
  category: z.enum(["family", "professional", "business", "community"], {
    errorMap: () => ({ message: "Catégorie invalide." }),
  }),
  contribution: z
    .number({ invalid_type_error: "Cotisation requise." })
    .int("La cotisation doit être un nombre entier.")
    .min(1000, "La cotisation doit être d'au moins 1 000 GNF.")
    .max(50_000_000, "La cotisation ne peut pas dépasser 50 000 000 GNF."),
  frequency: z.enum(["Quotidienne", "Hebdomadaire", "Quinzaine", "Mensuelle"]),
  members: z
    .number({ invalid_type_error: "Nombre de membres requis." })
    .int()
    .min(2, "Un groupe doit compter au moins 2 membres.")
    .max(50, "Un groupe ne peut pas dépasser 50 membres."),
  rotationOrder: z.enum(["random", "fixed", "auction", "choice"]),
  latePenaltyPercent: z.number().int().min(0).max(100),
  latePenaltyAfterDays: z.number().int().min(0).max(60),
  swapPolicy: z.enum(["open", "consensus", "closed"]),
  inviteCode: z
    .string()
    .regex(/^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "Le code d'invitation doit suivre le format TD-XXXX-XXXX."),
  visibility: z.enum(["private", "public-link", "directory"]),
  coOrganizerPhones: z
    .string()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine(
      (val) => {
        if (!val) return true;
        const phones = val
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        // Format MSISDN guinéen accepté : +224XXXXXXXXX (9 chiffres) avec espaces optionnels.
        const re = /^\+224\s?[6-7]\d{2}(\s?\d{2}){3}$/;
        return phones.every((p) => re.test(p));
      },
      {
        message:
          "Chaque co-organisateur doit être un numéro guinéen au format +224 6XX XX XX XX.",
      },
    ),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

/** Validate an in-progress draft and return aggregated, FR-localised messages. */
export function validateGroupDraft(draft: unknown): {
  ok: boolean;
  errors: string[];
  /** Step index (1-5) to jump to for the first error, if applicable. */
  firstErrorStep?: number;
} {
  const parsed = createGroupSchema.safeParse(draft);
  if (parsed.success) return { ok: true, errors: [] };

  const errors = parsed.error.issues.map((i) => i.message);

  const fieldToStep: Record<string, number> = {
    name: 1,
    description: 1,
    category: 1,
    contribution: 2,
    frequency: 2,
    members: 2,
    rotationOrder: 3,
    latePenaltyPercent: 3,
    latePenaltyAfterDays: 3,
    swapPolicy: 3,
    inviteCode: 4,
    visibility: 4,
    coOrganizerPhones: 4,
  };
  const firstPath = parsed.error.issues[0]?.path[0];
  const firstErrorStep = typeof firstPath === "string" ? fieldToStep[firstPath] : undefined;

  return { ok: false, errors, firstErrorStep };
}