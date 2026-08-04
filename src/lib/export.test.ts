import { describe, expect, it } from "vitest";
import { buildPrintableHTML, toCSV, type ExportColumn } from "@/lib/export";

interface Row { name: string; amount: number; note: string }
const rows: Row[] = [
  { name: "Alpha", amount: 1500, note: "ok" },
  { name: 'Bêta; "X"', amount: -200, note: "ligne\navec saut" },
];
const cols: ExportColumn<Row>[] = [
  { key: "name", label: "Nom", value: (r) => r.name },
  { key: "amount", label: "Montant", value: (r) => r.amount },
  { key: "note", label: "Note", value: (r) => r.note },
];

describe("export CSV", () => {
  it("ajoute le BOM et l'en-tête", () => {
    const csv = toCSV(rows, cols);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.split("\r\n")[0]).toBe("\uFEFFNom;Montant;Note");
  });
  it("échappe séparateurs, guillemets et sauts de ligne", () => {
    const csv = toCSV(rows, cols);
    expect(csv).toContain('"Bêta; ""X"""');
    expect(csv).toContain('"ligne\navec saut"');
  });
  it("gère une liste vide", () => {
    expect(toCSV([], cols).split("\r\n")).toHaveLength(1);
  });
});

describe("export PDF (HTML imprimable)", () => {
  it("échappe le HTML et rend une ligne par enregistrement", () => {
    const html = buildPrintableHTML("Titre", "Sous-titre", [{ name: "<b>x</b>", amount: 1, note: "" }], cols);
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain("Titre");
  });
  it("affiche un message si aucune donnée", () => {
    expect(buildPrintableHTML("T", "S", [], cols)).toContain("Aucune donnée");
  });
});
