/**
 * Normalise un numéro guinéen au format Nimba "224XXXXXXXXX".
 * Accepte +224, 00224 ou un numéro local à 9 chiffres commençant par 6.
 * Retourne `null` si le numéro est invalide.
 */
export function normalizeGNPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[\s\-().+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("00224")) return `224${digits.slice(5)}`;
  if (digits.startsWith("224")) return digits;
  if (/^6\d{8}$/.test(digits)) return `224${digits}`;
  return null;
}

/** Affichage convivial : "+224 6XX XX XX XX". */
export function formatGNPhone(raw: string | null | undefined): string {
  const n = normalizeGNPhone(raw);
  if (!n) return raw ?? "";
  const local = n.slice(3);
  return `+224 ${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}