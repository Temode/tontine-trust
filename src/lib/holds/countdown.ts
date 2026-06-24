/**
 * Calcule l'état d'une rétention de payout à partir d'un timestamp ISO
 * (UTC ou avec offset) et d'une horloge `now` en millisecondes UTC.
 *
 * Robuste aux fuseaux : on compare TOUJOURS deux instants UTC. Côté DB,
 * `payout_hold_until` est stocké en `timestamptz` et sérialisé par
 * PostgREST en ISO 8601 (`...Z` ou `...+00:00`). `Date.parse` interprète
 * ces deux formes comme un instant UTC absolu. `Date.now()` est aussi
 * un instant UTC. Le calcul ne dépend donc pas du fuseau du navigateur.
 *
 * Pour l'affichage de la date "Gelé jusqu'au ..." on utilise
 * `toLocaleDateString("fr-FR", ..., { timeZone })` côté composant, ce qui
 * convertit l'instant en heure locale du bénéficiaire (Conakry = UTC).
 */
export interface HoldStatus {
  released: boolean;
  remainingMs: number;
  /** d/h/m/s du temps restant — 0 si déjà libéré. */
  parts: { days: number; hours: number; minutes: number; seconds: number };
  /** Libellé court "Xj Yh Zm" / "Hh Mm Ss" / "Mm Ss". */
  label: string;
}

export function computeHoldStatus(until: string | Date, nowMs: number = Date.now()): HoldStatus {
  const target = typeof until === "string" ? Date.parse(until) : until.getTime();
  if (!Number.isFinite(target)) {
    return {
      released: true,
      remainingMs: 0,
      parts: { days: 0, hours: 0, minutes: 0, seconds: 0 },
      label: "Débloqué",
    };
  }
  const remaining = Math.max(0, target - nowMs);
  const released = remaining === 0;
  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const label = released
    ? "Débloqué"
    : days > 0
    ? `${days}j ${hours}h ${minutes}m`
    : hours > 0
    ? `${hours}h ${minutes}m ${seconds}s`
    : `${minutes}m ${seconds}s`;
  return { released, remainingMs: remaining, parts: { days, hours, minutes, seconds }, label };
}

/**
 * Formate une date ISO en date locale Guinée (UTC) pour l'UI
 * « Gelé jusqu'au … ». On force le fuseau pour éviter que deux utilisateurs
 * dans des fuseaux différents voient des jours différents.
 */
export function formatHoldUntilLabel(until: string | Date, locale = "fr-FR"): string {
  const d = typeof until === "string" ? new Date(until) : until;
  return d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Conakry",
  });
}