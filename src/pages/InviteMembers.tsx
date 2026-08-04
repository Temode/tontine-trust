import { useMemo, useState } from "react";
import { Loader2, Plus, Share2, Shield, X, XCircle } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
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
import { ShareSheet } from "@/components/invite/ShareSheet";

const STATUS_FR: Record<string, string> = {
  pending: "Actif",
  accepted: "Utilisé",
  revoked: "Révoqué",
  expired: "Expiré",
};

export default function InviteMembers() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [maxUses, setMaxUses] = useState<string>("");
  const [expiresInDays, setExpiresInDays] = useState<string>("");

  const myGroupsQ = useQuery({ queryKey: ["groups", "mine"], queryFn: listMyGroups });
  const organizedGroups = useMemo(
    () => (myGroupsQ.data ?? []).filter((g) => g.is_organizer),
    [myGroupsQ.data],
  );

  const currentId = selectedId || organizedGroups[0]?.id || "";
  const currentGroup = organizedGroups.find((g) => g.id === currentId);

  const invitationsQ = useQuery({
    queryKey: ["group", currentId, "invitations"],
    queryFn: () => listGroupInvitations(currentId),
    enabled: !!currentId,
  });

  const createM = useMutation({
    mutationFn: () => {
      const maxUsesNum =
        maxUses.trim() === "" ? null : Math.max(1, Math.min(100, parseInt(maxUses, 10) || 0));
      const days =
        expiresInDays.trim() === ""
          ? null
          : Math.max(1, Math.min(365, parseInt(expiresInDays, 10) || 0));
      const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;
      return createInvitation({ groupId: currentId, maxUses: maxUsesNum, expiresAt });
    },
    onSuccess: (inv) => {
      toast.success("Nouveau code généré");
      setShareCode(inv.code);
      setMaxUses("");
      setExpiresInDays("");
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

            <section className="rounded-xl border border-hairline bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">Paramètres du prochain code</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Optionnel. Limitez le nombre d'utilisations ou la durée de validité du prochain code généré.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs">
                  <span className="font-medium text-muted-foreground">Utilisations max.</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Illimité"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value.replace(/[^0-9]/g, ""))}
                    className="mt-1 h-10 w-full rounded-md border border-hairline bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-medium text-muted-foreground">Validité (jours)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Sans expiration"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value.replace(/[^0-9]/g, ""))}
                    className="mt-1 h-10 w-full rounded-md border border-hairline bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />
                </label>
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
                  {createM.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
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
                    <li key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
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
                        {STATUS_FR[inv.status] ?? inv.status}
                      </span>
                      <span className="text-xs text-muted-foreground num">
                        {inv.uses_count}
                        {inv.max_uses ? `/${inv.max_uses}` : ""} util.
                      </span>
                      <button
                        type="button"
                        onClick={() => setShareCode(inv.code)}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-hairline px-2 text-xs font-medium text-foreground transition hover:bg-secondary"
                      >
                        <Share2 className="h-3 w-3" /> Partager
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
              Chaque adhésion est horodatée dans le registre du groupe.
            </p>
          </>
        )}
      </div>

      <DialogPrimitive.Root open={!!shareCode} onOpenChange={(o) => !o && setShareCode(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 w-full overflow-hidden rounded-t-xl border-x border-t border-hairline bg-card shadow-2xl md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border"
          >
            <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <DialogPrimitive.Title className="font-display text-base font-bold text-foreground">
                Partager l'invitation
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-hairline text-muted-foreground transition hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </header>
            <div className="p-5">
              {shareCode && currentGroup && (
                <ShareSheet
                  code={shareCode}
                  groupName={currentGroup.name}
                  contribution={currentGroup.contribution_amount}
                  frequency={currentGroup.frequency}
                />
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}