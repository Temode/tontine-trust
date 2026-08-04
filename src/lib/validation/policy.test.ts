import { describe, it, expect } from "vitest";
import {
  CONTRIBUTION_MAX_GNF,
  CONTRIBUTION_MIN_GNF,
  CONTRIBUTION_STEP_GNF,
  MEMBERS_MAX,
  MEMBERS_MIN,
  ALLOWED_FREQUENCIES,
  contributionSchema,
  membersSchema,
  inviteCodeSchema,
  INVITE_CODE_REGEX,
  buildInviteUrl,
} from "./policy";

/**
 * Ces tests vérouillent la politique partagée appliquée par CreateGroupDialog,
 * JoinGroupDialog et PayContributionsDialog. La même politique est reflétée
 * côté API par les RPC Supabase (`create_group_with_invitation`,
 * `join_group_with_code`).
 */
describe("policy/contribution", () => {
  it("rejette les montants en dessous du minimum", () => {
    expect(contributionSchema.safeParse(CONTRIBUTION_MIN_GNF - 1).success).toBe(false);
    expect(contributionSchema.safeParse(0).success).toBe(false);
    expect(contributionSchema.safeParse(-1000).success).toBe(false);
  });

  it("rejette les montants au-dessus du maximum", () => {
    expect(contributionSchema.safeParse(CONTRIBUTION_MAX_GNF + 1000).success).toBe(false);
  });

  it("rejette les montants non multiples du pas", () => {
    expect(contributionSchema.safeParse(CONTRIBUTION_MIN_GNF + 1).success).toBe(false);
    expect(contributionSchema.safeParse(2500).success).toBe(false);
  });

  it("accepte les bornes valides", () => {
    expect(contributionSchema.safeParse(CONTRIBUTION_MIN_GNF).success).toBe(true);
    expect(contributionSchema.safeParse(CONTRIBUTION_MAX_GNF).success).toBe(true);
    expect(contributionSchema.safeParse(10_000).success).toBe(true);
  });

  it("rejette les valeurs non entières", () => {
    expect(contributionSchema.safeParse(1000.5).success).toBe(false);
  });

  it("rejette les chaînes", () => {
    expect(contributionSchema.safeParse("1000" as unknown as number).success).toBe(false);
  });

  it("a un pas cohérent avec le minimum", () => {
    expect(CONTRIBUTION_MIN_GNF % CONTRIBUTION_STEP_GNF).toBe(0);
    expect(CONTRIBUTION_MAX_GNF % CONTRIBUTION_STEP_GNF).toBe(0);
  });
});

describe("policy/members", () => {
  it("rejette en dessous du minimum", () => {
    expect(membersSchema.safeParse(MEMBERS_MIN - 1).success).toBe(false);
    expect(membersSchema.safeParse(0).success).toBe(false);
  });

  it("rejette au-dessus du maximum", () => {
    expect(membersSchema.safeParse(MEMBERS_MAX + 1).success).toBe(false);
  });

  it("accepte les bornes valides", () => {
    expect(membersSchema.safeParse(MEMBERS_MIN).success).toBe(true);
    expect(membersSchema.safeParse(MEMBERS_MAX).success).toBe(true);
    expect(membersSchema.safeParse(12).success).toBe(true);
  });

  it("rejette les valeurs non entières", () => {
    expect(membersSchema.safeParse(5.5).success).toBe(false);
  });
});

describe("policy/frequencies", () => {
  it("expose exactement la liste autorisée", () => {
    expect(ALLOWED_FREQUENCIES).toEqual([
      "quotidienne",
      "hebdomadaire",
      "quinzaine",
      "mensuelle",
    ]);
  });
});

describe("policy/invite-code", () => {
  const valid = ["TD-ABCD-1234", "TD-Z9Z9-A1B2", "TD-0000-9999"];
  const invalid = [
    "",
    "TD-abcd-1234", // lowercase
    "TD-ABC-1234", // mauvais segment 1
    "TD-ABCD-123", // mauvais segment 2
    "TDABCD1234", // pas de séparateurs
    "XX-ABCD-1234", // mauvais préfixe
    "TD-ABCD-1234 ", // espace en fin
    "TD-ABCD_1234", // mauvais séparateur
    "TD-ABCD-1234-EXTRA",
  ];

  it.each(valid)("accepte %s", (code) => {
    expect(inviteCodeSchema.safeParse(code).success).toBe(true);
    expect(INVITE_CODE_REGEX.test(code)).toBe(true);
  });

  it.each(invalid)("rejette %s", (code) => {
    expect(inviteCodeSchema.safeParse(code).success).toBe(false);
  });
});

describe("policy/buildInviteUrl", () => {
  it("encode le code dans l'URL", () => {
    const url = buildInviteUrl("TD-ABCD-1234");
    expect(url).toContain("/rejoindre?code=TD-ABCD-1234");
  });

  it("encode les caractères spéciaux", () => {
    const url = buildInviteUrl("TD-ABCD-12&3");
    expect(url).toContain("code=TD-ABCD-12%263");
  });
});