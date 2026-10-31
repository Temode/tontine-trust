interface Props {
  iso: string;
}

function label(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, now)) return "Aujourd'hui";
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (sameDay(d, yest)) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function DaySeparator({ iso }: Props) {
  return (
    <div className="my-4 flex justify-center">
      <span className="chat-bubble-shadow rounded-full bg-chat-in/90 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label(iso)}
      </span>
    </div>
  );
}