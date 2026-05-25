import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Inbox } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import {
  listMyNotifications, markAllRead, markRead,
  type DbNotification,
} from "@/lib/api/notifications";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dd.getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export default function Notifications() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications", "list", 50],
    queryFn: () => listMyNotifications(50),
  });

  const readOne = useMutation({
    mutationFn: (id: string) => markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const filtered = useMemo(
    () => (filter === "unread" ? items.filter((n) => !n.read_at) : items),
    [items, filter],
  );
  const unreadCount = items.filter((n) => !n.read_at).length;

  const groups = useMemo(() => {
    const map = new Map<string, DbNotification[]>();
    for (const n of filtered) {
      const k = dayLabel(n.created_at);
      const arr = map.get(k) ?? [];
      arr.push(n);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleClick = (n: DbNotification) => {
    if (!n.read_at) readOne.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Notifications"
        subtitle="Tout ce qui se passe dans vos tontines."
      />

      <div className="space-y-5 px-5 py-6 lg:px-8 lg:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-hairline bg-card p-1 text-xs font-semibold">
            {(["all", "unread"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 transition",
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f === "all" ? "Toutes" : `Non lues${unreadCount ? ` (${unreadCount})` : ""}`}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => readAll.mutate()}
            disabled={unreadCount === 0 || readAll.isPending}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-hairline bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-60"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Tout marquer lu
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-card px-6 py-16 text-center">
            <Inbox className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-display text-base font-bold text-foreground">Rien à signaler</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filter === "unread" ? "Aucune notification non lue." : "Aucune notification pour le moment."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(([label, list]) => (
              <section key={label}>
                <h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {label}
                </h2>
                <ul className="overflow-hidden rounded-xl border border-hairline bg-card">
                  {list.map((n, i) => (
                    <li key={n.id} className={cn(i > 0 && "border-t border-border/60")}>
                      <NotificationItem notification={n} onClick={handleClick} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}