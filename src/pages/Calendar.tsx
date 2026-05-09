import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/TopBar";
import { AgendaView } from "@/components/calendar/AgendaView";
import { CalendarKpiStrip } from "@/components/calendar/CalendarKpiStrip";
import { CalendarToolbar } from "@/components/calendar/CalendarToolbar";
import { EventDetailDrawer } from "@/components/calendar/EventDetailDrawer";
import { EVENT_TYPES_ORDERED } from "@/components/calendar/eventVisuals";
import { MonthView } from "@/components/calendar/MonthView";
import { UpcomingEventsCard } from "@/components/calendar/UpcomingEventsCard";
import { TODAY_REFERENCE, getCalendarEvents, getCalendarStats, groups } from "@/lib/mock-data";
import type { CalendarEvent, CalendarEventType, CalendarView } from "@/lib/types";

export default function Calendar() {
  const allEvents = useMemo(() => getCalendarEvents(), []);
  const stats = useMemo(() => getCalendarStats(), []);

  const [cursor, setCursor] = useState<Date>(new Date(TODAY_REFERENCE.getFullYear(), TODAY_REFERENCE.getMonth(), 1));
  const [view, setView] = useState<CalendarView>("month");
  const [groupId, setGroupId] = useState<string>("all");
  const [selectedTypes, setSelectedTypes] = useState<Set<CalendarEventType>>(
    () => new Set(EVENT_TYPES_ORDERED),
  );
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredEvents = useMemo(() => {
    return allEvents.filter((e) => {
      if (!selectedTypes.has(e.type)) return false;
      if (groupId !== "all" && e.groupId !== groupId) return false;
      return true;
    });
  }, [allEvents, selectedTypes, groupId]);

  const handleToggleType = (type: CalendarEventType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleEventClick = (e: CalendarEvent) => {
    setActiveEvent(e);
    setDrawerOpen(true);
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Calendrier"
        subtitle="Vue consolidée des opérations, réunions, votes et échéances de votre portefeuille."
        primaryAction={{
          label: "Nouvel événement",
          onClick: () =>
            toast("Module de planification", {
              description: "L'éditeur d'événements et de rappels sera disponible dans la prochaine livraison.",
            }),
          icon: <Plus className="h-4 w-4" />,
        }}
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <CalendarKpiStrip stats={stats} />

        <CalendarToolbar
          view={view}
          onViewChange={setView}
          cursor={cursor}
          onCursorChange={setCursor}
          onToday={() => setCursor(new Date(TODAY_REFERENCE.getFullYear(), TODAY_REFERENCE.getMonth(), 1))}
          groupId={groupId}
          onGroupChange={setGroupId}
          groups={groups}
          selectedTypes={selectedTypes}
          onToggleType={handleToggleType}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          <div>
            {view === "month" ? (
              <MonthView cursor={cursor} events={filteredEvents} onEventClick={handleEventClick} />
            ) : (
              <AgendaView cursor={cursor} events={filteredEvents} onEventClick={handleEventClick} />
            )}
          </div>
          <UpcomingEventsCard events={filteredEvents} onEventClick={handleEventClick} />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Les événements financiers sont synchronisés via les API Orange Money et MTN Mobile Money. Les
          réunions et votes de groupe sont notifiés à l'ensemble des membres concernés et archivés sur le
          registre immuable.
        </p>
      </div>

      <EventDetailDrawer event={activeEvent} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
