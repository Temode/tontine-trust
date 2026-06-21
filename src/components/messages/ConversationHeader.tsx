import { ArrowLeft, Info, Phone, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { getInitials } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DbGroupOverview } from "@/lib/api/types";

interface Props {
  group: DbGroupOverview;
}

export function ConversationHeader({ group }: Props) {
  const initials = getInitials(group.name) || "··";
  const statusLabel =
    group.status === "active"
      ? "Cycle actif"
      : group.status === "paused"
      ? "En pause"
      : group.status === "draft"
      ? "Brouillon"
      : "Cycle clôturé";

  return (
    <header className="flex items-center gap-3 border-b border-hairline bg-card px-4 py-3">
      <Link
        to="/discussions"
        className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
        aria-label="Retour"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold text-foreground">
          {group.name}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {group.members_count} membre{group.members_count > 1 ? "s" : ""} · {statusLabel}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground/60 disabled:cursor-not-allowed"
              aria-label="Appel vocal"
            >
              <Phone className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Appels vocaux — bientôt disponible</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground/60 disabled:cursor-not-allowed"
              aria-label="Appel vidéo"
            >
              <Video className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Réunions vidéo — bientôt disponible</TooltipContent>
        </Tooltip>
        <Link
          to={`/groupes/${group.id}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Détails du groupe"
        >
          <Info className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}