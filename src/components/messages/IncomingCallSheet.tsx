import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Phone, PhoneOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useIncomingCalls } from "@/hooks/useIncomingCalls";
import { respondCallRequest } from "@/lib/api/calls";
import { CallRoom } from "./CallRoom";

export function IncomingCallSheet() {
  const { current, dismiss } = useIncomingCalls();
  const [joined, setJoined] = useState<{ callId: string; groupName: string } | null>(null);

  const decline = useMutation({
    mutationFn: (id: string) => respondCallRequest(id, "declined"),
    onError: (e: Error) => toast.error("Action impossible", { description: e.message }),
    onSettled: () => dismiss(),
  });

  return (
    <>
      <Dialog open={!!current && !joined} onOpenChange={(v) => !v && dismiss()}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4 animate-pulse text-primary" />
            Appel entrant
          </DialogTitle>
          <DialogDescription>
            {current?.requester_name} demande un appel dans <strong>{current?.group_name}</strong>.
            {current?.topic && <span className="mt-1 block text-foreground">« {current.topic} »</span>}
          </DialogDescription>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => current && decline.mutate(current.id)}
              disabled={decline.isPending}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-hairline text-sm font-semibold text-foreground hover:bg-secondary"
            >
              <PhoneOff className="h-4 w-4" />
              Refuser
            </button>
            <button
              type="button"
              onClick={() => {
                if (!current) return;
                setJoined({ callId: current.id, groupName: current.group_name });
                dismiss();
              }}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-primary hover:bg-primary-700"
            >
              <Phone className="h-4 w-4" />
              Rejoindre
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <CallRoom
        open={!!joined}
        onOpenChange={(v) => !v && setJoined(null)}
        callId={joined?.callId ?? null}
        groupName={joined?.groupName}
      />
    </>
  );
}