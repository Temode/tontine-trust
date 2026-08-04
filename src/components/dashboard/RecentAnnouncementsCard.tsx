import { Link } from "react-router-dom";
import { Megaphone, ChevronRight, Pin } from "lucide-react";
import { SectionCard } from "@/components/dashboard/SectionCard";
import type { DbRecentAnnouncement } from "@/lib/api/announcements";

interface Props {
  items: DbRecentAnnouncement[];
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function RecentAnnouncementsCard({ items }: Props) {
  if (!items || items.length === 0) return null;
  return (
    <SectionCard
      title="Annonces récentes"
      subtitle={`${items.length} nouvelle${items.length > 1 ? "s" : ""}`}
      bare
    >
      <ul className="divide-y divide-border/60">
        {items.map((a) => (
          <li key={a.id}>
            <Link
              to={`/groupes/${a.group_id}`}
              className="flex items-start gap-3 px-5 py-3.5 transition hover:bg-secondary/40 lg:px-6"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
                {a.pinned ? <Pin className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {a.title}
                </p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {a.body}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {a.group_name ?? "Groupe"} · {timeAgo(a.created_at)}
                </p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}