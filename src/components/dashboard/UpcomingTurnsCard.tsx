import { Link } from "react-router-dom";
import { Calendar, ChevronRight } from "lucide-react";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { formatGNF, getInitials } from "@/lib/format";
import type { DbNextTurn } from "@/lib/api/types";

interface Props {
  turns: DbNextTurn[];
  myUserId?: string | null;
  isLoading?: boolean;
}

export function UpcomingTurnsCard({ turns, myUserId, isLoading }: Props) {
  const top = turns.slice(0, 3);
  return (
    <SectionCard
      title="Prochaines échéances"
      subtitle={isLoading ? "Chargement…" : `${turns.length} tour${turns.length > 1 ? "s" : ""} à venir`}
      bare
    >
      {isLoading ? (
        <p className="px-5 py-6 text-sm text-muted-foreground lg:px-6">Chargement…</p>
      ) : top.length === 0 ? (
        <div className="px-5 py-8 text-center lg:px-6">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Calendar className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-foreground">Aucun tour planifié</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Démarrez un cycle pour voir les prochaines échéances ici.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {top.map((t) => {
            const isMe = myUserId && t.beneficiary_user_id === myUserId;
            const date = new Date(t.due_date).toLocaleDateString("fr-FR", {
              day: "2-digit", month: "short",
            });
            const initials = getInitials(t.beneficiary_name ?? "··") || "··";
            return (
              <li key={t.turn_id}>
                <Link
                  to={`/groupes/${t.group_id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-secondary/40 lg:px-6"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${isMe ? "bg-accent-600 text-accent-foreground" : "bg-secondary text-foreground"}`}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span className="truncate">{t.beneficiary_name ?? "Membre"}</span>
                      {isMe && (
                        <span className="rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-700">
                          Vous
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tour #{t.turn_number} · échéance {date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-sm font-bold text-foreground num">
                      {formatGNF(t.payout_amount, { withCurrency: true })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}