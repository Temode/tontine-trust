import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  parseE164,
  formatPhone,
  normalizeGNPhone,
  isValidNational,
  findCountryByDial,
} from "./phone";

describe("normalizePhone", () => {
  it("normalise un numéro guinéen local", () => {
    expect(normalizePhone("611599395", "224")).toBe("224611599395");
  });
  it("supporte le 0 en tête", () => {
    expect(normalizePhone("0611599395", "224")).toBe("224611599395");
  });
  it("rejette un numéro guinéen trop court", () => {
    expect(normalizePhone("61159939", "224")).toBeNull();
  });
  it("rejette un guinéen commençant par un autre chiffre", () => {
    expect(normalizePhone("711599395", "224")).toBeNull();
  });
  it("normalise un numéro ivoirien (10 chiffres)", () => {
    expect(normalizePhone("0102030405", "225")).toBe("2250102030405");
  });
  it("valide un numéro français", () => {
    expect(normalizePhone("612345678", "33")).toBe("33612345678");
  });
});

describe("parseE164", () => {
  it("détecte l'indicatif guinéen", () => {
    expect(parseE164("+224611599395")).toEqual({
      dial: "224",
      national: "611599395",
      country: findCountryByDial("224"),
    });
  });
  it("gère le 00", () => {
    expect(parseE164("00224611599395").dial).toBe("224");
  });
  it("fallback guinéen sur 9 chiffres commençant par 6", () => {
    expect(parseE164("611599395")).toMatchObject({ dial: "224", national: "611599395" });
  });
});

describe("formatPhone", () => {
  it("formate proprement", () => {
    expect(formatPhone("+224611599395")).toBe("+224 611 599 395");
  });
});

describe("normalizeGNPhone (compat)", () => {
  it("gère les trois formats historiques", () => {
    expect(normalizeGNPhone("+224611599395")).toBe("224611599395");
    expect(normalizeGNPhone("00224611599395")).toBe("224611599395");
    expect(normalizeGNPhone("611599395")).toBe("224611599395");
  });
  it("rejette un numéro invalide", () => {
    expect(normalizeGNPhone("711599395")).toBeNull();
  });
});

describe("isValidNational", () => {
  it("valide la Guinée", () => {
    expect(isValidNational("611599395", findCountryByDial("224")!)).toBe(true);
    expect(isValidNational("711599395", findCountryByDial("224")!)).toBe(false);
  });
});