/**
 * Librairie téléphone multi-pays.
 *
 * - `COUNTRIES` : catalogue supporté par le sélecteur d'indicatif.
 * - `normalizePhone(national, dial)` : numéro E.164 sans "+" (ex "224611599395") ou `null`.
 * - `parseE164(raw)` : { dial, national } détecté depuis un stockage brut.
 * - `formatPhone(raw)` : rendu convivial "+224 611 59 93 95".
 *
 * La normalisation guinéenne d'origine (`normalizeGNPhone`) reste exportée
 * pour compat avec le reste du code / edge functions.
 */

export interface CountryDef {
  code: string;      // ISO 3166-1 alpha-2
  name: string;
  dial: string;      // sans "+"
  flag: string;
  nationalLength: number | number[]; // longueur(s) attendue(s) après retrait de l'indicatif
  nationalPrefixes?: string[];        // premiers chiffres valides (optionnel)
}

export const COUNTRIES: CountryDef[] = [
  { code: "GN", name: "Guinée",        dial: "224", flag: "🇬🇳", nationalLength: 9, nationalPrefixes: ["6"] },
  { code: "CI", name: "Côte d'Ivoire", dial: "225", flag: "🇨🇮", nationalLength: 10 },
  { code: "SN", name: "Sénégal",       dial: "221", flag: "🇸🇳", nationalLength: 9, nationalPrefixes: ["7"] },
  { code: "ML", name: "Mali",          dial: "223", flag: "🇲🇱", nationalLength: 8 },
  { code: "BF", name: "Burkina Faso",  dial: "226", flag: "🇧🇫", nationalLength: 8 },
  { code: "NE", name: "Niger",         dial: "227", flag: "🇳🇪", nationalLength: 8 },
  { code: "TG", name: "Togo",          dial: "228", flag: "🇹🇬", nationalLength: 8 },
  { code: "BJ", name: "Bénin",         dial: "229", flag: "🇧🇯", nationalLength: 8 },
  { code: "FR", name: "France",        dial: "33",  flag: "🇫🇷", nationalLength: 9 },
  { code: "BE", name: "Belgique",      dial: "32",  flag: "🇧🇪", nationalLength: 9 },
  { code: "CA", name: "Canada",        dial: "1",   flag: "🇨🇦", nationalLength: 10 },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

export function findCountryByDial(dial: string | null | undefined): CountryDef | null {
  if (!dial) return null;
  const d = String(dial).replace(/[^\d]/g, "");
  return COUNTRIES.find((c) => c.dial === d) ?? null;
}

function onlyDigits(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/[\s\-().+]/g, "");
}

/** Vérifie qu'une partie nationale correspond aux règles d'un pays. */
export function isValidNational(national: string, country: CountryDef): boolean {
  const d = onlyDigits(national).replace(/^0+/, "");
  const lens = Array.isArray(country.nationalLength) ? country.nationalLength : [country.nationalLength];
  if (!lens.includes(d.length)) return false;
  if (country.nationalPrefixes && !country.nationalPrefixes.some((p) => d.startsWith(p))) return false;
  return true;
}

/**
 * Normalise `national` selon `dial` et renvoie "DDDXXXXXXXXX" (sans "+")
 * ou `null` si invalide.
 */
export function normalizePhone(national: string, dial: string): string | null {
  const country = findCountryByDial(dial);
  if (!country) return null;
  const d = onlyDigits(national).replace(/^0+/, "");
  if (!isValidNational(d, country)) return null;
  return `${country.dial}${d}`;
}

/**
 * Parse un numéro stocké (avec ou sans "+") vers { dial, national, country }.
 * Retourne `dial` par défaut (Guinée) si aucun indicatif détecté.
 */
export function parseE164(raw: string | null | undefined): {
  dial: string;
  national: string;
  country: CountryDef | null;
} {
  const digits = onlyDigits(raw).replace(/^00/, "");
  if (!digits) return { dial: DEFAULT_COUNTRY.dial, national: "", country: DEFAULT_COUNTRY };
  // Cherche l'indicatif le plus long qui matche.
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (digits.startsWith(c.dial)) {
      return { dial: c.dial, national: digits.slice(c.dial.length), country: c };
    }
  }
  // Fallback : suppose Guinée si commence par 6 avec 9 chiffres.
  if (/^6\d{8}$/.test(digits)) {
    return { dial: DEFAULT_COUNTRY.dial, national: digits, country: DEFAULT_COUNTRY };
  }
  return { dial: DEFAULT_COUNTRY.dial, national: digits, country: null };
}

/** Rendu convivial "+DDD NNN NN NN NN". */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const { dial, national } = parseE164(raw);
  if (!national) return raw ?? "";
  const grouped = national.match(/.{1,3}/g)?.join(" ") ?? national;
  return `+${dial} ${grouped}`;
}

/* ─── Compat rétro ─────────────────────────────────────────────────── */

/**
 * Normalise un numéro guinéen au format Nimba "224XXXXXXXXX".
 * Conservé pour compat ; délègue à `normalizePhone` avec +224.
 */
export function normalizeGNPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = onlyDigits(raw);
  if (!digits) return null;
  if (digits.startsWith("00224")) return `224${digits.slice(5)}`;
  if (digits.startsWith("224") && digits.length === 12) return digits;
  if (/^6\d{8}$/.test(digits)) return `224${digits}`;
  return null;
}

/** Affichage convivial "+224 6XX XX XX XX" (compat). */
export function formatGNPhone(raw: string | null | undefined): string {
  const n = normalizeGNPhone(raw);
  if (!n) return raw ?? "";
  const local = n.slice(3);
  return `+224 ${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}