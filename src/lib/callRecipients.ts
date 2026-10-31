/**
 * Tableau de bord d'un appel : chaque destinataire et son état réel.
 * Source : table call_recipients ; la présence LiveKit ne fait que compléter.
 */
export type RecipientStatus =
  | "ringing"
  | "delivered"
  | "declined"
  | "accepted"
  | "missed"
  | "unreachable"
  | "left";

export interface RecipientRow {
  user_id: string;
  status: RecipientStatus;
  name: string | null;
}

export interface PresenceLite {
  identity: string;
  name: string | null;
  micMuted: boolean;
}

export interface StripEntry {
  id: string;
  name: string | null;
  status: RecipientStatus;
  /** Connecté à la salle en ce moment. */
  inRoom: boolean;
  micMuted: boolean;
}

export const RECIPIENT_LABEL: Record<RecipientStatus, string> = {
  ringing: "Appel envoyé",
  delivered: "Sonne…",
  declined: "A refusé",
  accepted: "En ligne",
  missed: "Pas de réponse",
  unreachable: "Aucun appareil",
  left: "Parti",
};

const ORDER: Record<RecipientStatus, number> = {
  accepted: 0, delivered: 1, ringing: 2, unreachable: 3, declined: 4, missed: 5, left: 6,
};

/**
 * Lignes de la bande : les destinataires (hors moi), plus toute personne
 * présente dans la salle sans ligne (l'appelant vu par un destinataire).
 */
export function buildStrip(
  recipients: RecipientRow[],
  remotes: PresenceLite[],
  selfId: string | undefined,
): StripEntry[] {
  const byId = new Map(remotes.map((p) => [p.identity, p]));
  const out: StripEntry[] = [];
  const seen = new Set<string>();
  for (const r of recipients) {
    if (r.user_id === selfId) continue;
    const p = byId.get(r.user_id);
    seen.add(r.user_id);
    out.push({
      id: r.user_id,
      name: p?.name ?? r.name,
      // Présent dans la salle = en ligne, quelle que soit la dernière écriture.
      status: p ? "accepted" : r.status,
      inRoom: !!p,
      micMuted: p?.micMuted ?? false,
    });
  }
  for (const p of remotes) {
    if (seen.has(p.identity) || p.identity === selfId) continue;
    out.push({ id: p.identity, name: p.name, status: "accepted", inRoom: true, micMuted: p.micMuted });
  }
  return out.sort((a, b) => ORDER[a.status] - ORDER[b.status]);
}

/** Message de fin quand l'appel est refusé ; prénom seulement à deux. */
export function declineMessage(recipients: RecipientRow[]): string {
  if (recipients.length === 1) {
    const first = recipients[0].name?.trim().split(/\s+/)[0];
    return first && !first.includes("@") ? `${first} a refusé l\u2019appel` : "Le membre a refusé l\u2019appel";
  }
  return "Tous les membres ont refusé l\u2019appel";
}
