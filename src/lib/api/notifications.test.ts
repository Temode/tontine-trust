import { describe, it, expect } from "vitest";
import { resolveNotificationLink } from "./notifications";

describe("resolveNotificationLink", () => {
  it("uses explicit link when present", () => {
    expect(
      resolveNotificationLink({ kind: "system", link: "/custom", group_id: null }),
    ).toBe("/custom");
  });

  const gid = "00000000-0000-0000-0000-000000000abc";
  const cases: Array<[string, string | null, string]> = [
    ["chat_message", gid, `/discussions/${gid}`],
    ["call_missed", gid, `/discussions/${gid}`],
    ["call_incoming", gid, `/discussions/${gid}`],
    ["invitation_accepted", gid, `/groupes/${gid}/membres`],
    ["invitation_accepted", null, "/groupes"],
    ["member_joined", gid, `/groupes/${gid}/membres`],
    ["invitation_received", null, "/rejoindre"],
    ["cycle_started", gid, `/groupes/${gid}`],
    ["cycle_completed", gid, `/groupes/${gid}`],
    ["turn_started", gid, `/groupes/${gid}`],
    ["turn_paid", gid, `/groupes/${gid}`],
    ["announcement", gid, `/groupes/${gid}`],
    ["group_completed", gid, `/groupes/${gid}`],
    ["contribution_due", gid, `/groupes/${gid}`],
    ["contribution_due", null, "/cotisations"],
    ["contribution_received", null, "/cotisations"],
    ["contribution_confirmed", null, "/cotisations"],
    ["payout_released", null, "/solde"],
    ["receipt_ready", null, "/recus"],
    ["reliability_changed", null, "/profil"],
    ["system", null, "/notifications"],
    ["unknown_kind", null, "/notifications"],
  ];

  it.each(cases)("kind=%s (group_id=%s) → %s", (kind, group_id, expected) => {
    expect(resolveNotificationLink({ kind, link: null, group_id })).toBe(expected);
  });

  it("incoming call opens the call screen", () => {
    expect(resolveNotificationLink({ kind: "call_incoming", group_id: gid, data: { call_id: "c1" } })).toBe("/appel/c1");
  });

  it("late contribution goes to the tontine even if an old link points elsewhere", () => {
    expect(resolveNotificationLink({ kind: "contribution_late", link: "/solde", group_id: gid })).toBe(`/groupes/${gid}`);
  });

  it("new message ignores a stale link", () => {
    expect(resolveNotificationLink({ kind: "chat_message", link: "/notifications", group_id: gid })).toBe(`/discussions/${gid}`);
  });
});
