import { useMemo, useState } from "react";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/TopBar";
import { NotificationInbox } from "@/components/notifications/NotificationInbox";
import { NotificationPreferencesCard } from "@/components/notifications/NotificationPreferencesCard";
import { NotificationsKpiStrip } from "@/components/notifications/NotificationsKpiStrip";
import {
  NotificationsToolbar,
  type NotificationFilter,
} from "@/components/notifications/NotificationsToolbar";
import { getNotificationsStats, notifications as initialNotifications } from "@/lib/mock-data";
import type { Notification, NotificationCategory } from "@/lib/types";

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [query, setQuery] = useState("");

  const stats = useMemo(() => getNotificationsStats(items), [items]);

  const counts = useMemo(() => {
    const byCategory: Record<NotificationCategory, number> = {
      financial: 0,
      governance: 0,
      security: 0,
      social: 0,
      system: 0,
    };
    let unread = 0;
    let action = 0;
    let all = 0;
    for (const n of items) {
      if (n.status === "archived") continue;
      all++;
      if (n.status === "unread") unread++;
      if (n.requiresAction) action++;
      byCategory[n.category]++;
    }
    return {
      all,
      unread,
      action,
      ...byCategory,
    } as Record<NotificationFilter, number>;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((n) => {
      if (q) {
        const haystack = `${n.title} ${n.description} ${n.source}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filter === "all") return true;
      if (filter === "unread") return n.status === "unread";
      if (filter === "action") return n.requiresAction && n.status !== "archived";
      return n.category === filter;
    });
  }, [items, filter, query]);

  const handleMarkRead = (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id && n.status === "unread" ? { ...n, status: "read" } : n)),
    );
  };

  const handleArchive = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, status: "archived" } : n)));
    toast("Notification archivée", { description: "Accessible depuis le filtre Tout en bas de l'inbox." });
  };

  const handleMarkAllRead = () => {
    const unreadCount = items.filter((n) => n.status === "unread").length;
    setItems((prev) => prev.map((n) => (n.status === "unread" ? { ...n, status: "read" } : n)));
    toast.success(`${unreadCount} ${unreadCount > 1 ? "alertes marquées lues" : "alerte marquée lue"}`);
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Notifications"
        subtitle="Centre d'alertes consolidé · synchronisé en temps réel avec vos groupes et les services Tontine Digital."
        primaryAction={{
          label: "Tout marquer lu",
          onClick: handleMarkAllRead,
          icon: <CheckCheck className="h-4 w-4" />,
        }}
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <NotificationsKpiStrip stats={stats} />

        <NotificationsToolbar
          filter={filter}
          onFilterChange={setFilter}
          query={query}
          onQueryChange={setQuery}
          counts={counts}
          onMarkAllRead={handleMarkAllRead}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          <NotificationInbox
            notifications={filtered}
            onMarkRead={handleMarkRead}
            onArchive={handleArchive}
          />
          <NotificationPreferencesCard />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Tontine Digital horodate et signe chaque notification émise par le registre. Les alertes
          financières et de conformité sont conservées 10 ans selon l'agrément BCG-2024-018. Aucune
          notification ne quitte l'infrastructure sans signature cryptographique vérifiable.
        </p>
      </div>
    </div>
  );
}
