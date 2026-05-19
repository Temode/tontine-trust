import { useMemo, useState } from "react";
import { Copy, Loader2, Plus, Shield, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/TopBar";
import { listMyGroups } from "@/lib/api/groups";
import {
  createInvitation,
  listGroupInvitations,
  revokeInvitation,
} from "@/lib/api/invitations";
import { cn } from "@/lib/utils";

export default function InviteMembers() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");

  const myGroupsQ = useQuery({ queryKey: ["groups", "mine"], queryFn: listMyGroups });
  const organizedGroups = useMemo(
    () => (myGroupsQ.data ?? []).filter((g) => g.is_organizer),
    [myGroupsQ.data],
  );

  const currentId = selectedId || organizedGroups[0]?.id || "";

  const invitationsQ = useQuery({
    queryKey: ["group", currentId, "invitations"],
    queryFn: () => listGroupInvitations(currentId),
    enabled: !!currentId,
  });

  const createM = useMutation({
    mutationFn: () => createInvitation({ groupId: currentId }),
    onSuccess: () => {
      toast.success("Nouveau code généré");
      qc.invalidateQueries({ queryKey: ["group", currentId, "invitations"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const revokeM = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => {
      toast("Code révoqué");
      qc.invalidateQueries({ queryKey: ["group", currentId, "invitations"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => undefined);
    toast.success("Code copié");
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Inviter des membres"
        subtitle="Générez et partagez les codes d'invitation de vos groupes."
        primaryAction={
          currentId
            ? {
                label: "Nouveau code",
                onClick: () => createM.mutate(),
                icon: <Plus className="h-4 w-4" />,
              }
            : undefined
        }
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        {myGroupsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : organizedGroups.length === 0 ? (
          <div className="rounded-xl border border-hairline bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            Vous n'organisez aucun groupe. Créez d'abord un groupe pour générer des invitations.
          </div>
        ) : (
          <>
            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Groupe
              </p>
              <div className="flex flex-wrap gap-2">
                {organizedGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedId(g.id)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium transition",
                      g.id === currentId
                        ? "border-primary bg-primary-50/40 text-foreground"
                        : "border-hairline text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {g.name}{" "}
                    <span className="ml-1 text-xs text-muted-foreground num">
                      {g.members_count}/{g.max_members}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-hairline bg-card">
              <header className="flex items-center justify-between border-b border-hairline px-5 py-3">
                <h2 className="text-sm font-semibold text-foreground">Codes d'invitation</h2>
                <button
                  type="button"
                  onClick={() => createM.mutate()}
                  disabled={createM.isPending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-50"
                >
                  {createM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Nouveau code
                </button>
              </header>
              {invitationsQ.isLoading ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">Chargement…</p>
              ) : (invitationsQ.data ?? []).length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">
                  Aucun code d'invitation. Cliquez sur « Nouveau code » pour en générer un.
                </p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {(invitationsQ.data ?? []).map((inv) => (
                    <li key={inv.id} className="flex items-center gap-3 px-5 py-3">
                      <p className="flex-1 truncate font-mono text-base font-bold tracking-[0.16em] text-foreground num">
                        {inv.code}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          inv.status === "pending" && "bg-success/10 text-success",
                          inv.status === "revoked" && "bg-destructive/10 text-destructive",
                          inv.status === "expired" && "bg-muted text-muted-foreground",
                          inv.status === "accepted" && "bg-primary-50 text-primary",
                        )}
                      >
                        {inv.status}
                      </span>
                      <span className="text-xs text-muted-foreground num">
                        {inv.uses_count}{inv.max_uses ? `/${inv.max_uses}` : ""} util.
                      </span>
                      <button
                        type="button"
                        onClick={() => copy(inv.code)}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-hairline px-2 text-xs font-medium text-foreground transition hover:bg-secondary"
                      >
                        <Copy className="h-3 w-3" /> Copier
                      </button>
                      {inv.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => revokeM.mutate(inv.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-hairline px-2 text-xs font-medium text-destructive transition hover:bg-destructive/5"
                        >
                          <XCircle className="h-3 w-3" /> Révoquer
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="inline-flex items-start gap-2 text-[11px] text-muted-foreground">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              Partagez les codes uniquement aux personnes que vous souhaitez voir rejoindre votre groupe.
              Chaque adhésion est tracée dans le registre.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
