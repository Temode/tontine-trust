import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationItem } from "./NotificationItem";
import {
  countUnread, listMyNotifications, markAllRead, markRead, resolveNotificationLink,
  type DbNotification,
} from "@/lib/api/notifications";
import { useState } from "react";

export function NotificationBell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: unread = 0 } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: countUnread,
    refetchOnWindowFocus: true,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["notifications", "list", 10],
    queryFn: () => listMyNotifications(10),
    enabled: open,
  });

  const readOne = useMutation({
    mutationFn: (id: string) => markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleClick = (n: DbNotification) => {
    if (!n.read_at) readOne.mutate(n.id);
    setOpen(false);
    navigate(resolveNotificationLink(n));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${unread} notifications non lues`}
          data-tour="notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-card text-muted-foreground transition hover:text-foreground"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <header className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <div>
            <p className="font-display text-sm font-bold text-foreground">Notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est à jour"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => readAll.mutate()}
            disabled={unread === 0 || readAll.isPending}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Tout marquer lu
          </button>
        </header>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Aucune notification pour le moment.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((n) => (
                <li key={n.id}>
                  <NotificationItem notification={n} onClick={handleClick} dense />
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="border-t border-hairline px-4 py-2 text-center">
          <button
            type="button"
            onClick={() => { setOpen(false); navigate("/notifications"); }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Voir toutes les notifications
          </button>
        </footer>
      </PopoverContent>
    </Popover>
  );
}