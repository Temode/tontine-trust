import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { Phone, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { useIncomingCallsContext } from "@/hooks/IncomingCallsContext";
import { respondCallRequest } from "@/lib/api/calls";
import { useRingtone } from "@/hooks/useRingtone";
import { useDocumentTitleFlash } from "@/hooks/useDocumentTitleFlash";
import { CallRoom } from "./CallRoom";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "·";
}

function useElapsed(startIso: string | undefined): string {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!startIso) return;
    const t = window.setInterval(() => setN((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [startIso]);
  if (!startIso) return "00:00";
  const sec = Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));
  // re-use n to force render
  void n;
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function IncomingCallScreen() {
  const { current, dismiss } = useIncomingCallsContext();
  const [joined, setJoined] = useState<{ callId: string; groupName: string; groupId: string } | null>(null);

  const ringing = !!current && !joined;
  useRingtone(ringing);
  useDocumentTitleFlash(
    ringing,
    current ? `Appel — ${current.requester_name}` : "",
  );

  // Notification système (si onglet caché)
  useEffect(() => {
    if (!ringing || !current) return;
    try {
      if (
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.hidden
      ) {
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
        return () => n.close();
      }
    } catch {
      /* ignore */
    }
  }, [ringing, current]);

  const decline = useMutation({
    mutationFn: (id: string) => respondCallRequest(id, "declined"),
    onError: (e: Error) => toast.error("Action impossible", { description: e.message }),
    onSettled: () => dismiss(),
  });

  const elapsed = useElapsed(current?.created_at);

  if (typeof document === "undefined") return null;

  return (
    <>
      {ringing && current
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Appel entrant"
              className="fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden px-6 py-10 sm:py-14"
              style={{
                background:
                  "radial-gradient(120% 80% at 50% 10%, hsl(var(--primary) / 0.55) 0%, hsl(var(--primary-900)) 55%, #04161a 100%)",
              }}
            >
              {/* Header */}
              <div className="z-10 flex flex-col items-center text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/70">
                  Appel entrant
                </p>
                <p className="mt-2 text-sm text-primary-foreground/85">
                  {current.group_name}
                </p>
              </div>

              {/* Avatar + halo */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative flex h-44 w-44 items-center justify-center">
                  {/* Or pulsé */}
                  <span
                    aria-hidden
                    className="call-pulse-ring absolute inset-0 rounded-full"
                    style={{ boxShadow: "0 0 0 2px hsl(var(--accent) / 0.55)" }}
                  />
                  <span
                    aria-hidden
                    className="call-pulse-ring absolute inset-0 rounded-full"
                    style={{
                      animationDelay: "0.6s",
                      boxShadow: "0 0 0 2px hsl(var(--accent) / 0.4)",
                    }}
                  />
                  {/* Avatar */}
                  <div
                    className="call-breathe relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-primary-foreground/10 ring-2 ring-accent/70"
                    style={{
                      boxShadow:
                        "0 30px 80px -20px hsl(var(--accent) / 0.45), inset 0 0 0 1px hsl(var(--accent) / 0.25)",
                    }}
                  >
                    {current.requester_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={current.requester_avatar}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="font-display text-4xl font-bold text-primary-foreground">
                        {initials(current.requester_name)}
                      </span>
                    )}
                  </div>
                </div>

                <h2 className="font-display mt-8 text-3xl font-bold tracking-tight text-primary-foreground">
                  {current.requester_name}
                </h2>
                {current.topic ? (
                  <p className="mt-2 max-w-xs text-center text-sm text-primary-foreground/75">
                    « {current.topic} »
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-primary-foreground/60">
                    vous appelle
                  </p>
                )}
                <p className="num mt-4 text-xs tracking-wider text-primary-foreground/55">
                  {elapsed}
                </p>
              </div>

              {/* Actions */}
              <div className="z-10 flex w-full max-w-sm items-end justify-around">
                <button
                  type="button"
                  onClick={() => decline.mutate(current.id)}
                  disabled={decline.isPending}
                  className="group flex flex-col items-center gap-3 outline-none"
                  aria-label="Refuser l'appel"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition group-hover:scale-105 group-active:scale-95 group-disabled:opacity-50">
                    <PhoneOff className="h-7 w-7" />
                  </span>
                  <span className="text-xs font-semibold text-primary-foreground/85">
                    Refuser
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setJoined({
                      callId: current.id,
                      groupName: current.group_name,
                      groupId: current.group_id,
                    });
                    dismiss();
                  }}
                  className="group flex flex-col items-center gap-3 outline-none"
                  aria-label="Rejoindre l'appel"
                >
                  <span
                    className="flex h-20 w-20 items-center justify-center rounded-full text-primary-foreground transition group-hover:scale-105 group-active:scale-95"
                    style={{
                      background:
                        "linear-gradient(140deg, hsl(var(--accent)) 0%, hsl(var(--accent-600)) 100%)",
                      boxShadow:
                        "0 20px 50px -10px hsl(var(--accent) / 0.65), inset 0 0 0 1px hsl(var(--accent-700) / 0.4)",
                      color: "hsl(var(--accent-foreground))",
                    }}
                  >
                    <Phone className="h-8 w-8" />
                  </span>
                  <span className="text-xs font-semibold text-primary-foreground">
                    Rejoindre
                  </span>
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}

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