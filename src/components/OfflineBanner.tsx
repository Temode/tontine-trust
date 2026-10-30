import { WifiOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  const qc = useQueryClient();
  if (online) return null;
  const last = Math.max(0, ...qc.getQueryCache().getAll().map((q) => q.state.dataUpdatedAt || 0));
  const when = last
    ? new Date(last).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <div role="status" className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-secondary px-3 py-1.5 text-xs text-foreground">
      <WifiOff className="h-3.5 w-3.5" />
      Hors ligne{when ? ` — données du ${when.replace(" ", " à ")}` : ""}. Paiements et envois indisponibles.
    </div>
  );
}
