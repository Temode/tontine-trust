import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pause, Play, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { pauseCycle, resumeCycle, archiveGroup } from "@/lib/api/cycleAdmin";

interface Props {
  groupId: string;
  status: string;
}

export function CycleAdminPanel({ groupId, status }: Props) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  const pauseM = useMutation({
    mutationFn: () => pauseCycle(groupId, reason || undefined),
    onSuccess: () => {
      toast.success("Cycle mis en pause");
      setReason("");
      qc.invalidateQueries({ queryKey: ["group", groupId] });
    },
    onError: (e: Error) => toast.error("Pause impossible", { description: e.message }),
  });

  const resumeM = useMutation({
    mutationFn: () => resumeCycle(groupId),
    onSuccess: (days) => {
      toast.success(`Cycle relancé (échéances décalées de ${days}j)`);
      qc.invalidateQueries({ queryKey: ["group", groupId] });
    },
    onError: (e: Error) => toast.error("Reprise impossible", { description: e.message }),
  });

  const archiveM = useMutation({
    mutationFn: () => archiveGroup(groupId, reason || undefined),
    onSuccess: () => {
      toast.success("Groupe archivé");
      qc.invalidateQueries({ queryKey: ["group", groupId] });
    },
    onError: (e: Error) => toast.error("Archivage impossible", { description: e.message }),
  });

  return (
    <div className="space-y-3">
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motif (optionnel)"
        rows={2}
      />
      <div className="flex flex-wrap gap-2">
        {status !== "paused" && status !== "cancelled" && (
          <Button variant="outline" onClick={() => pauseM.mutate()} disabled={pauseM.isPending}>
            <Pause className="mr-2 h-4 w-4" /> Mettre en pause
          </Button>
        )}
        {status === "paused" && (
          <Button onClick={() => resumeM.mutate()} disabled={resumeM.isPending}>
            <Play className="mr-2 h-4 w-4" /> Reprendre
          </Button>
        )}
        {status !== "cancelled" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Archive className="mr-2 h-4 w-4" /> Archiver
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archiver le groupe ?</AlertDialogTitle>
                <AlertDialogDescription>
                  L'historique reste consultable mais aucune écriture ne sera plus possible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => archiveM.mutate()}>Archiver</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}