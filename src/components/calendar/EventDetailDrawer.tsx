import { ArrowRight, Bell, Clock, ShieldCheck, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import type { CalendarEvent } from "@/lib/types";
import { EVENT_VISUALS } from "./eventVisuals";

const WEEKDAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

interface EventDetailDrawerProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDetailDrawer({ event, open, onOpenChange }: EventDetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-hairline bg-card p-0 sm:max-w-md"
      >
        {event && <EventBody event={event} onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function EventBody({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const v = EVENT_VISUALS[event.type];
  const Icon = v.Icon;
  const [y, m, d] = event.date.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayLabel = `${WEEKDAYS_FR[date.getDay()]} ${date.getDate()} ${MONTHS_FR[date.getMonth()]} ${date.getFullYear()}`;

  const isYourTurn = event.type === "your-turn";
  const isFinancial =
    event.type === "contribution" || event.type === "your-turn" || event.type === "turn";

  const cta = ctaForEvent(event);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header
        className={cn(
          "relative px-6 pb-6 pt-5",
          isYourTurn ? "bg-accent-700 text-accent-foreground" : "bg-secondary/40",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className={cn(
            "absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md transition",
            isYourTurn
              ? "border border-accent-foreground/20 text-accent-foreground hover:bg-accent-foreground/10"
              : "border border-hairline text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-md",
              isYourTurn ? "bg-accent-foreground/15 text-accent-foreground" : `${v.bg} ${v.fg}`,
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.16em]",
                isYourTurn ? "text-accent-foreground/80" : "text-muted-foreground",
              )}
            >
              {v.label}
            </p>
            <SheetTitle
              className={cn(
                "mt-1 font-display text-lg font-bold leading-tight",
                isYourTurn ? "text-accent-foreground" : "text-foreground",
              )}
            >
              {event.title}
            </SheetTitle>
          </div>
        </div>

        <p
          className={cn(
            "mt-4 text-sm",
            isYourTurn ? "text-accent-foreground/85" : "text-muted-foreground",
          )}
        >
          {dayLabel} · {formatRelativeDays(event.daysFromToday)}
          {event.time && (
            <>
              {" "}·{" "}
              <span className="num">{event.time}</span>
              {event.endTime && <> – <span className="num">{event.endTime}</span></>}
            </>
          )}
        </p>
      </header>

      {/* Body */}
      <div className="flex-1 space-y-5 px-6 py-6">
        {event.amount !== undefined && (
          <article
            className={cn(
              "rounded-xl border p-4",
              isFinancial ? "border-hairline bg-secondary/40" : "border-hairline",
            )}
          >
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {isYourTurn || event.type === "turn" ? "Cagnotte" : "Montant"}
            </p>
            <p
              className={cn(
                "mt-1 font-display text-3xl font-bold num",
                isYourTurn ? "text-accent-700" : "text-foreground",
              )}
            >
              {formatGNF(event.amount)}
              <span className="ml-2 text-base font-medium text-muted-foreground">GNF</span>
            </p>
          </article>
        )}

        {event.description && (
          <p className="text-sm leading-relaxed text-foreground">{event.description}</p>
        )}

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {event.groupName && <Field label="Groupe" value={event.groupName} />}
          {event.time && (
            <Field
              label="Horaire"
              value={
                <span className="num">
                  {event.time}
                  {event.endTime && ` – ${event.endTime}`}
                </span>
              }
              icon={<Clock className="h-3.5 w-3.5" />}
            />
          )}
          {event.status && (
            <Field
              label="Statut"
              value={
                event.status === "scheduled" ? "Programmé" : event.status === "completed" ? "Réalisé" : "Annulé"
              }
            />
          )}
          {event.type === "meeting" && (
            <Field label="Présence" value="Membres invités" icon={<Users className="h-3.5 w-3.5" />} />
          )}
        </dl>

        <div className="rounded-md border border-hairline bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Événement notarisé · synchronisation Mobile Money en temps réel
          </span>
        </div>
      </div>

      {/* Footer actions */}
      <footer className="flex items-center justify-between gap-2 border-t border-hairline px-6 py-4">
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Bell className="h-3.5 w-3.5" />
          Activer un rappel
        </button>
        {cta && (
          <Link
            to={cta.to}
            onClick={onClose}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
          >
            {cta.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </footer>
    </div>
  );
}

function ctaForEvent(event: CalendarEvent): { to: string; label: string } | null {
  if (event.groupId) {
    if (event.type === "contribution") return { to: `/groupes/${event.groupId}`, label: "Payer" };
    if (event.type === "your-turn") return { to: `/groupes/${event.groupId}`, label: "Voir le groupe" };
    return { to: `/groupes/${event.groupId}`, label: "Ouvrir le groupe" };
  }
  if (event.type === "swap-deadline") return { to: "/rotations", label: "Voir l'échange" };
  if (event.type === "reminder") return { to: "/profil", label: "Ouvrir le profil" };
  return null;
}

function Field({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-hairline bg-card px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {icon}
        {value}
      </dd>
    </div>
  );
}
