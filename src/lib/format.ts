/** Format an amount as Guinean Franc with thin spaces as thousand separators. */
export function formatGNF(value: number, options: { withCurrency?: boolean; compact?: boolean } = {}): string {
  const { withCurrency = false, compact = false } = options;
  const safe = Number.isFinite(value) ? value : 0;

  if (compact && Math.abs(safe) >= 1_000_000) {
    const millions = safe / 1_000_000;
    const formatted = new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: millions >= 10 ? 0 : 1,
    }).format(millions);
    return withCurrency ? `${formatted} M GNF` : `${formatted} M`;
  }

  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(safe);
  return withCurrency ? `${formatted} GNF` : formatted;
}

/** Format a relative day count for next payment ("Dans 3 jours", "Aujourd'hui"...). */
export function formatRelativeDays(days: number): string {
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  if (days < 0) return `Il y a ${Math.abs(days)} jours`;
  return `Dans ${days} jours`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}
