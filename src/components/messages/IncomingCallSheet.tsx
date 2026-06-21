import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Phone, PhoneOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useIncomingCallsContext } from "@/hooks/IncomingCallsContext";
import { respondCallRequest } from "@/lib/api/calls";
import { CallRoom } from "./CallRoom";
import { useRingtone } from "@/hooks/useRingtone";

export function IncomingCallSheet() {
  const { current, dismiss } = useIncomingCallsContext();
  const [joined, setJoined] = useState<{ callId: string; groupName: string; groupId: string } | null>(null);
  const notifiedRef = useRef<string | null>(null);
  const toastIdRef = useRef<string | number | null>(null);

  // Sonnerie active tant qu'un appel entrant est en attente
  useRingtone(!!current && !joined);

  const decline = useMutation({
    mutationFn: (id: string) => respondCallRequest(id, "declined"),
    onError: (e: Error) => toast.error("Action impossible", { description: e.message }),
    onSettled: () => dismiss(),
  });

  // Notification navigateur + toast fallback dès qu'un appel arrive
  useEffect(() => {
    if (!current) {
      if (toastIdRef.current !== null) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      notifiedRef.current = null;
      return;
    }
    if (notifiedRef.current === current.id) return;
    notifiedRef.current = current.id;

    // Toast persistant (fallback si Dialog masquée par une autre modale/route)
    toastIdRef.current = toast(`📞 Appel entrant — ${current.group_name}`, {
      description: `${current.requester_name} vous appelle`,
      duration: Infinity,
      action: {
        label: "Rejoindre",
        onClick: () => {
          setJoined({
            callId: current.id,
            groupName: current.group_name,
            groupId: current.group_id,
          });
          dismiss();
        },
      },
    });

    // Notification système si l'onglet est caché
    try {
      if ("Notification" in window) {
        const fire = () => {
          if (document.hidden && Notification.permission === "granted") {
            const n = new Notification(`Appel entrant — ${current.group_name}`, {
              body: `${current.requester_name} vous appelle${current.topic ? ` : ${current.topic}` : ""}`,
              tag: current.id,
              requireInteraction: true,
              icon: "/favicon.svg",
            });
            n.onclick = () => {
              window.focus();
              n.close();
            };
          }
        };
        if (Notification.permission === "default") {
          void Notification.requestPermission().then(() => fire());
        } else {
          fire();
        }
      }
    } catch {
      /* ignore */
    }
  }, [current, dismiss]);

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
                setJoined({ callId: current.id, groupName: current.group_name, groupId: current.group_id });
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
        groupId={joined?.groupId}
        groupName={joined?.groupName}
      />
    </>
  );
}