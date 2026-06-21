import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Phone, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  listCallRequests,
  respondCallRequest,
  subscribeCallRequests,
  type CallRequest,
  type CallStatus,
} from "@/lib/api/calls";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { CallRoom } from "./CallRoom";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
}

const STATUS_LABEL: Record<CallStatus, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  declined: "Refusée",
  cancelled: "Annulée",
  missed: "Manquée",
  ended: "Terminée",
};

const STATUS_COLOR: Record<CallStatus, string> = {
  pending: "bg-accent/15 text-accent-foreground",
  accepted: "bg-emerald-100 text-emerald-700",
  declined: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  missed: "bg-amber-100 text-amber-700",
  ended: "bg-muted text-muted-foreground",
};

export function CallHistoryDrawer({ open, onOpenChange, groupId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [joinCallId, setJoinCallId] = useState<string | null>(null);
  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["call-requests", groupId],
    queryFn: () => listCallRequests(groupId),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const ch = subscribeCallRequests(groupId, () => {
      qc.invalidateQueries({ queryKey: ["call-requests", groupId] });
    });
    return () => {
      ch.unsubscribe();
    };
  }, [open, groupId, qc]);

  const respond = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Exclude<CallStatus, "pending"> }) =>
      respondCallRequest(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call-requests", groupId] }),
    onError: (e: Error) => toast.error("Action impossible", { description: e.message }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Historique des appels
          </SheetTitle>
          <SheetDescription>
            Demandes d'appel passées et en cours. Cliquez sur « Rejoindre » pour entrer dans un appel actif.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-3">
          {isLoading && (
            <p className="text-center text-xs text-muted-foreground">Chargement…</p>
          )}
          {!isLoading && calls.length === 0 && (
            <div className="rounded-lg border border-dashed border-hairline px-4 py-10 text-center">
              <Phone className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold text-foreground">Aucun appel</p>
              <p className="text-xs text-muted-foreground">
                Personne n'a encore demandé d'appel dans ce groupe.
              </p>
            </div>
          )}
          {calls.map((c: CallRequest) => {
            const mine = c.requested_by === user?.id;
            const date = new Date(c.scheduled_at ?? c.created_at);
            return (
              <div
                key={c.id}
                className="rounded-lg border border-hairline bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {c.topic || "Appel sans sujet"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span className="tabular-nums">
                        {date.toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span>· {c.requester?.full_name ?? "Membre"}</span>
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      STATUS_COLOR[c.status],
                    )}
                  >
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>

                {c.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    {!mine && (
                      <button
                        type="button"
                        onClick={() => {
                          respond.mutate({ id: c.id, status: "accepted" });
                          setJoinCallId(c.id);
                        }}
                        disabled={respond.isPending}
                        className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary-700"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Rejoindre
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        respond.mutate({
                          id: c.id,
                          status: mine ? "cancelled" : "declined",
                        })
                      }
                      disabled={respond.isPending}
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-semibold text-foreground hover:bg-secondary"
                    >
                      <PhoneOff className="h-3.5 w-3.5" />
                      {mine ? "Annuler" : "Refuser"}
                    </button>
                  </div>
                )}

                {c.status === "accepted" && (
                  <button
                    type="button"
                    onClick={() => setJoinCallId(c.id)}
                    className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 text-xs font-semibold text-primary hover:bg-primary/10"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Rejoindre l'appel
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
      <CallRoom
        open={!!joinCallId}
        onOpenChange={(v) => !v && setJoinCallId(null)}
        callId={joinCallId}
      />
    </Sheet>
  );
}