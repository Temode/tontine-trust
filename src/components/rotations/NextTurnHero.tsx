import { ArrowRight, CalendarDays, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import type { Turn } from "@/lib/types";

interface NextTurnHeroProps {
  turn: Turn | null;
}

export function NextTurnHero({ turn }: NextTurnHeroProps) {
  if (!turn) {
    return (
      <article className="rounded-xl border border-hairline bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-muted-foreground">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Pas de tour à venir</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Aucun de vos cycles ouverts n'a encore programmé votre tour.
              Rejoignez ou créez un nouveau groupe pour planifier votre prochain encaissement.
            </p>
          </div>
        </div>
      </article>
    );
  }

  const fillRate = Math.round((turn.contributorsPaid / turn.contributorsTotal) * 100);

  return (
    <article className="relative overflow-hidden rounded-xl bg-accent-700 p-6 text-accent-foreground lg:p-8">
      {/* Soft glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-25">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-foreground/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-card/15 blur-3xl" />
      </div>

      <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent-foreground/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
            <Trophy className="h-3.5 w-3.5" />
            Votre prochain tour
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold leading-tight lg:text-3xl">
            {turn.groupName}
          </h2>
          <p className="mt-1 text-sm text-accent-foreground/80">
            Tour <span className="num">#{turn.index}</span> sur <span className="num">{turn.total}</span> ·{" "}
            {turn.date} · {formatRelativeDays(turn.daysFromToday)}
          </p>

          <p className="mt-6 text-[11px] uppercase tracking-[0.14em] text-accent-foreground/70">
            Cagnotte attendue
          </p>
          <p className="mt-1 font-display text-4xl font-bold leading-none num lg:text-5xl">
            {formatGNF(turn.amount)}
            <span className="ml-2 text-lg font-medium text-accent-foreground/70">GNF</span>
          </p>
        </div>

        <div className="space-y-4">
          {/* Members status */}
          <div className="rounded-lg bg-accent-foreground/8 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-accent-foreground/80">
                <Users className="h-3.5 w-3.5" />
                Cotisations reçues
              </p>
              <span className="font-display text-sm font-semibold num">
                {turn.contributorsPaid}/{turn.contributorsTotal}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-accent-foreground/15">
              <div
                className="h-full rounded-full bg-accent-foreground/85"
                style={{ width: `${fillRate}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-accent-foreground/70">
              Versement automatique dès réception de toutes les cotisations.
            </p>
          </div>

          <Link
            to={`/groupes/${turn.groupId}`}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent-foreground text-sm font-semibold text-accent-700 transition hover:bg-accent-foreground/90"
          >
            Voir le groupe
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
