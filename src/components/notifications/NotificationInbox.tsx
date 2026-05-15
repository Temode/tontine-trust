import { useMemo } from "react";
import { Inbox } from "lucide-react";
import type { Notification } from "@/lib/types";
import { NotificationRow } from "./NotificationRow";

interface NotificationInboxProps {
  notifications: Notification[];
  onMarkRead?: (id: string) => void;
  onArchive?: (id: string) => void;
}

interface DayBucket {
  id: string;
  label: string;
  items: Notification[];
}

function bucketize(notifications: Notification[]): DayBucket[] {
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const thisWeek: Notification[] = [];
  const earlier: Notification[] = [];
  const archived: Notification[] = [];

  for (const n of notifications) {
    if (n.status === "archived") {
      archived.push(n);
      continue;
    }
    if (n.daysFromToday === 0) today.push(n);
    else if (n.daysFromToday === -1) yesterday.push(n);
    else if (n.daysFromToday >= -7) thisWeek.push(n);
    else earlier.push(n);
  }

  const buckets: DayBucket[] = [];
  if (today.length) buckets.push({ id: "today", label: "Aujourd'hui", items: today });
  if (yesterday.length) buckets.push({ id: "yesterday", label: "Hier", items: yesterday });
  if (thisWeek.length) buckets.push({ id: "week", label: "Cette semaine", items: thisWeek });
  if (earlier.length) buckets.push({ id: "earlier", label: "Plus ancien", items: earlier });
  if (archived.length) buckets.push({ id: "archived", label: "Archivées", items: archived });
  return buckets;
}

export function NotificationInbox({ notifications, onMarkRead, onArchive }: NotificationInboxProps) {
  const buckets = useMemo(() => bucketize(notifications), [notifications]);

  if (buckets.length === 0) {
    return (
      <article className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-card px-6 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Inbox className="h-5 w-5" />
        </span>
        <h3 className="mt-4 font-display text-base font-bold text-foreground">Boîte de réception vide</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Aucune notification ne correspond à ce filtre. Vous êtes à jour sur toutes les actions en cours.
        </p>
      </article>
    );
  }

  return (
    <div className="space-y-6">
      {buckets.map((bucket) => (
        <section key={bucket.id} aria-labelledby={`bucket-${bucket.id}`}>
          <div className="mb-3 flex items-center justify-between px-1">
            <h3
              id={`bucket-${bucket.id}`}
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              {bucket.label}
            </h3>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground num">
              {bucket.items.length}
            </span>
          </div>
          <ul className="space-y-2">
            {bucket.items.map((n) => (
              <li key={n.id}>
                <NotificationRow notification={n} onMarkRead={onMarkRead} onArchive={onArchive} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
