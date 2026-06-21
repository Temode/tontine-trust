import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { requestGroupCall } from "@/lib/api/calls";
import { CallRoom } from "./CallRoom";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  groupName?: string;
  onDone?: () => void;
}

export function CallRequestDialog({ open, onOpenChange, groupId, groupName, onDone }: Props) {
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [datetime, setDatetime] = useState("");
  const [activeCall, setActiveCall] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      requestGroupCall(
        groupId,
        topic,
        mode === "schedule" && datetime ? new Date(datetime).toISOString() : null,
      ),
    onSuccess: (callId) => {
      toast.success("Appel lancé", {
        description: "Les membres reçoivent la notification.",
      });
      setTopic("");
      setDatetime("");
      onOpenChange(false);
      onDone?.();
      if (mode === "now") setActiveCall(callId);
    },
    onError: (e: Error) =>
      toast.error("Demande impossible", { description: e.message }),
  });

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Demander un appel
          </DialogTitle>
          <DialogDescription>
            Proposez un appel vocal aux membres actifs du groupe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">
              Sujet (facultatif)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex. Point sur la cotisation de mars"
              maxLength={120}
              className="h-10 w-full rounded-md border border-hairline bg-background px-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-foreground">Quand ?</p>
            <div className="flex gap-2">
              {(["now", "schedule"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-semibold transition ${
                    mode === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-hairline bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "now" ? "Maintenant" : "Programmer"}
                </button>
              ))}
            </div>
          </div>

          {mode === "schedule" && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Date et heure
              </label>
              <input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                className="h-10 w-full rounded-md border border-hairline bg-background px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-md border border-hairline px-4 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => mut.mutate()}
            disabled={mut.isPending || (mode === "schedule" && !datetime)}
            className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-primary transition hover:bg-primary-700 disabled:opacity-50"
          >
            {mut.isPending ? "Envoi…" : "Envoyer la demande"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <CallRoom
      open={!!activeCall}
      onOpenChange={(v) => !v && setActiveCall(null)}
      callId={activeCall}
      groupName={groupName}
    />
    </>
  );
}