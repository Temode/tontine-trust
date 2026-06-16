import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, ShieldAlert, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getActiveDeletionRequest, requestGroupDeletion, voteGroupDeletion, listVotes,
} from "@/lib/api/deletion";

interface Props {
  groupId: string;
  isOrganizer: boolean;
  currentUserId: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending_members: "Consultation des membres en cours",
  pending_admin: "En attente de validation Tontine",
  approved: "Suppression approuvée",
  rejected: "Demande refusée",
  cancelled: "Demande annulée",
};

export function DeletionPanel({ groupId, isOrganizer, currentUserId }: Props) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  const reqQ = useQuery({
    queryKey: ["deletion-request", groupId],
    queryFn: () => getActiveDeletionRequest(groupId),
  });

  const votesQ = useQuery({
    queryKey: ["deletion-votes", reqQ.data?.id],
    queryFn: () => listVotes(reqQ.data!.id),
    enabled: !!reqQ.data?.id,
  });

  const requestM = useMutation({
    mutationFn: () => requestGroupDeletion(groupId, reason),
    onSuccess: () => {
      toast.success("Demande de suppression envoyée aux membres");
      setReason("");
      qc.invalidateQueries({ queryKey: ["deletion-request", groupId] });
    },
    onError: (e: Error) => toast.error("Impossible", { description: e.message }),
  });

  const voteM = useMutation({
    mutationFn: (v: "yes" | "no") => voteGroupDeletion(reqQ.data!.id, v),
    onSuccess: (_d, v) => {
      toast.success(v === "yes" ? "Vote enregistré" : "Vous avez refusé la suppression");
      qc.invalidateQueries({ queryKey: ["deletion-request", groupId] });
      qc.invalidateQueries({ queryKey: ["deletion-votes", reqQ.data?.id] });
    },
    onError: (e: Error) => toast.error("Impossible", { description: e.message }),
  });

  if (reqQ.isLoading) return null;

  const req = reqQ.data;

  // No active request → show organizer entry point
  if (!req) {
    if (!isOrganizer) return null;
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" /> Demander la suppression du groupe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            La suppression nécessite l'accord unanime des membres (14 jours pour s'opposer)
            puis la validation de Tontine. Pré-requis : aucun tour en cours, aucune cotisation
            en attente.
          </p>
          <Textarea
            placeholder="Motif obligatoire (visible par les membres et Tontine)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={!reason.trim()}>
                <Trash2 className="mr-2 h-4 w-4" /> Soumettre la demande
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la demande ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tous les membres seront notifiés. Un seul refus annule la demande.
                  Si personne ne s'oppose sous 14 jours, Tontine statuera.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => requestM.mutate()}>Envoyer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  // Active request → banner + vote UI for members
  const myVote = votesQ.data?.find((v) => v.user_id === currentUserId);
  const yesCount = votesQ.data?.filter((v) => v.vote === "yes").length ?? 0;
  const deadline = new Date(req.members_deadline).toLocaleDateString("fr-FR");

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-5 w-5" /> {STATUS_LABEL[req.status]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p><strong>Motif :</strong> {req.reason}</p>
        <p className="text-muted-foreground">
          {yesCount} approbation(s) · échéance des votes : {deadline}
        </p>
        {req.status === "pending_members" && !isOrganizer && (
          <div className="space-y-2">
            <p>Êtes-vous d'accord pour supprimer ce groupe ?</p>
            {myVote ? (
              <p className="text-sm font-medium">
                Votre vote actuel : {myVote.vote === "yes" ? "Approuvé" : "Refusé"}
              </p>
            ) : (
              <div className="flex gap-2">
                <Button onClick={() => voteM.mutate("yes")} disabled={voteM.isPending}>
                  <Check className="mr-2 h-4 w-4" /> Approuver
                </Button>
                <Button variant="destructive" onClick={() => voteM.mutate("no")} disabled={voteM.isPending}>
                  <X className="mr-2 h-4 w-4" /> Refuser
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Silence après le {deadline} = accord tacite.
            </p>
          </div>
        )}
        {req.status === "pending_admin" && (
          <p>La demande a été transmise à Tontine pour décision finale.</p>
        )}
      </CardContent>
    </Card>
  );
}