import { ArrowLeft, Phone, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/TopBar";
import { Switch } from "@/components/ui/switch";
import { getMyPrivacy, updatePhoneVisibility } from "@/lib/api/privacy";

export default function PrivacySettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["privacy", "mine"], queryFn: getMyPrivacy });

  const toggle = useMutation({
    mutationFn: (v: boolean) => updatePhoneVisibility(v),
    onSuccess: () => {
      toast.success("Préférence enregistrée");
      qc.invalidateQueries({ queryKey: ["privacy", "mine"] });
    },
    onError: (e: Error) => toast.error("Impossible", { description: e.message }),
  });

  return (
    <div className="animate-fade-in">
      <TopBar title="Confidentialité" subtitle="Contrôlez la visibilité de vos données personnelles." />
      <div className="space-y-4 px-5 py-6 lg:px-8 lg:py-8">
        <Link
          to="/profil"
          className="inline-flex h-8 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour au profil
        </Link>

        <article className="rounded-xl border border-hairline bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-foreground">
              <Phone className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Afficher mon numéro de téléphone</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Si désactivé, les autres membres voient un numéro masqué (ex : 0612••••••67). Les organisateurs
                conservent toujours l'accès complet.
              </p>
            </div>
            <Switch
              checked={!!data?.phone_visible_in_groups}
              disabled={isLoading || toggle.isPending}
              onCheckedChange={(v) => toggle.mutate(v)}
            />
          </div>
        </article>

        <article className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <Trash2 className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Supprimer mon compte</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Conformément au RGPD, vous pouvez demander la suppression complète de votre compte. Les
                écritures comptables liées aux tontines passées seront conservées sous forme anonymisée
                (obligation légale).
              </p>
              <Link
                to="/profil/suppression"
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-destructive px-3 text-sm font-semibold text-destructive-foreground transition hover:opacity-90"
              >
                Supprimer mon compte
              </Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}