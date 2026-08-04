import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/TopBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { deleteMyAccount } from "@/lib/api/privacy";

export default function DeleteAccount() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [reason, setReason] = useState("");

  const del = useMutation({
    mutationFn: () => deleteMyAccount(reason || undefined),
    onSuccess: async () => {
      toast.success("Compte supprimé.");
      await signOut();
      navigate("/auth", { replace: true });
    },
    onError: (e: Error) => toast.error("Suppression impossible", { description: e.message }),
  });

  const canSubmit = confirm && understood && !del.isPending;

  return (
    <div className="animate-fade-in">
      <TopBar title="Supprimer mon compte" subtitle="Action irréversible." />
      <div className="space-y-5 px-5 py-6 lg:px-8 lg:py-8">
        <Link
          to="/profil/confidentialite"
          className="inline-flex h-8 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour
        </Link>

        <article className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-destructive" />
            <div className="text-sm text-foreground">
              <p className="font-semibold">Cette action est définitive.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Votre profil sera anonymisé ("Utilisateur supprimé").</li>
                <li>Vos notifications, préférences et rappels seront effacés.</li>
                <li>Vos cotisations et reçus passés sont conservés (obligation comptable).</li>
                <li>Vous ne pourrez plus vous reconnecter avec cet email.</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                Si vous êtes organisateur d'un groupe encore actif, transférez la propriété ou archivez le groupe
                avant de supprimer votre compte.
              </p>
            </div>
          </div>
        </article>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="reason">
            Raison (facultatif)
          </label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Aide-nous à comprendre pourquoi vous partez…"
            maxLength={500}
            rows={3}
          />
        </div>

        <label className="flex items-start gap-3 text-sm text-foreground">
          <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} />
          <span>Je confirme vouloir supprimer définitivement mon compte Tontine Digital.</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-foreground">
          <Checkbox checked={understood} onCheckedChange={(v) => setUnderstood(v === true)} />
          <span>Je comprends que cette action est irréversible.</span>
        </label>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => del.mutate()}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Supprimer définitivement mon compte
        </button>
      </div>
    </div>
  );
}