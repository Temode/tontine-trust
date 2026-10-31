import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Pin } from "lucide-react";
import { getActiveCallForGroup } from "@/lib/api/calls";
import { useCall } from "@/hooks/CallContext";

interface Props {
  groupId: string;
  groupName: string;
}

export function PinnedCallBanner({ groupId, groupName }: Props) {
  const [hidden, setHidden] = useState(false);
  const { startCall, callId: activeCallId } = useCall();

  const { data: call } = useQuery({
    queryKey: ["active-call", groupId],
    queryFn: () => getActiveCallForGroup(groupId),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  if (!call || hidden || activeCallId === call.id) return null;

  return (
    <div className="flex items-center gap-3 border-b border-hairline bg-accent-50 px-4 py-2">
      <Pin className="h-4 w-4 shrink-0 text-accent-700" />
      <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
        Appel de groupe en cours
      </p>
      <button
        type="button"
        onClick={() =>
          startCall({
            callId: call.id,
            groupId,
            groupName,
            prefs: { micMuted: false, camOff: true, screenShare: false },
          })
        }
        className="shrink-0 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary-700"
      >
        Rejoindre
      </button>
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="shrink-0 text-muted-foreground transition hover:text-foreground"
        aria-label="Masquer"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}