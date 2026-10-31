import { describe, expect, it } from "vitest";
import { buildStrip, declineMessage, type RecipientRow } from "./callRecipients";

const rows: RecipientRow[] = [
  { user_id: "a", status: "delivered", name: "Aïssatou Bah" },
  { user_id: "b", status: "declined", name: "Mamadou Diallo" },
  { user_id: "me", status: "accepted", name: "Moi" },
];

describe("bande des membres", () => {
  it("montre chaque destinataire même si personne n'est connecté", () => {
    const s = buildStrip(rows, [], "me");
    expect(s.map((e) => [e.id, e.status])).toEqual([["a", "delivered"], ["b", "declined"]]);
  });

  it("ajoute une personne présente sans ligne, en ligne", () => {
    const s = buildStrip(rows, [{ identity: "caller", name: "Fanta", micMuted: true }], "me");
    expect(s.find((e) => e.id === "caller")).toMatchObject({ status: "accepted", inRoom: true, micMuted: true });
  });

  it("la présence dans la salle prime sur l'état écrit", () => {
    const s = buildStrip(rows, [{ identity: "a", name: null, micMuted: false }], "me");
    expect(s[0]).toMatchObject({ id: "a", status: "accepted", name: "Aïssatou Bah" });
  });
});

describe("message de refus", () => {
  it("à deux, nomme le prénom", () => {
    expect(declineMessage([rows[1]])).toBe("Mamadou a refusé l\u2019appel");
  });
  it("en groupe, reste collectif", () => {
    expect(declineMessage(rows.slice(0, 2))).toBe("Tous les membres ont refusé l\u2019appel");
  });
});
