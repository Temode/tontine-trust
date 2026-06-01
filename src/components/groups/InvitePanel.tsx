import { useMemo, useRef } from "react";
import { Copy, Link2, Loader2, Mail, MessageCircle, Plus, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvitation,
  listGroupInvitations,
  revokeInvitation,
} from "@/lib/api/invitations";
import { formatGNF } from "@/lib/format";
import { cn } from "@/lib/utils";

interface InvitePanelProps {
  groupId: string;
  groupName: string;
  contribution: number;
  frequency: string;
}

function buildLink(code: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/rejoindre?code=${encodeURIComponent(code)}`;
  }
  return `https://tontine.digital/join/${code}`;
}

export const INVITE_PANEL_ID = "group-invite-panel";

export function InvitePanel({ groupId, groupName, contribution, frequency }: InvitePanelProps) {
  const qc = useQueryClient();
  const rootRef = useRef<HTMLElement | null>(null);

  const invitationsQ = useQuery({
    queryKey: ["group", groupId, "invitations"],
    queryFn: () => listGroupInvitations(groupId),
    enabled: !!groupId,
  });

  const createM = useMutation({
    mutationFn: () => createInvitation({ groupId }),
    onSuccess: () => {
      toast.success("Nouveau code généré");
      qc.invalidateQueries({ queryKey: ["group", groupId, "invitations"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const revokeM = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => {
      toast("Code révoqué");
      qc.invalidateQueries({ queryKey: ["group", groupId, "invitations"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const invitations = invitationsQ.data ?? [];
  const active = useMemo(
    () => invitations.find((i) => i.status === "pending") ?? invitations[0] ?? null,
    [invitations],
  );
  const recent = invitations.slice(0, 3);

  const code = active?.code ?? "";
  const link = code ? buildLink(code) : "";

  const shareText = code
    ? `Bonjour,\nJe vous invite à rejoindre notre tontine « ${groupName} ».\n• Cotisation : ${formatGNF(contribution, { withCurrency: true })} (${frequency.toLowerCase()})\n• Code : ${code}\n• Lien : ${link}`
    : "";

  const copy = (value: string, label: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => undefined);
    toast.success(label);
  };

  const mailtoHref = code
    ? `mailto:?subject=${encodeURIComponent(`Rejoignez la tontine « ${groupName} »`)}&body=${encodeURIComponent(shareText)}`
    : "#";
  const waHref = code ? `https://wa.me/?text=${encodeURIComponent(shareText)}` : "#";

  return (
    <section
      id={INVITE_PANEL_ID}
      ref={rootRef}
      className="mt-5 rounded-xl border border-hairline bg-card"
    >
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <UserPlus className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Inviter des membres</h2>
            <p className="text-xs text-muted-foreground">
              Partagez le code ou le lien pour que d'autres rejoignent ce groupe.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => createM.mutate()}
          disabled={createM.isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
        >
          {createM.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Nouveau code
        </button>
      </header>

      <div className="space-y-4 px-5 py-4">
        {invitationsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : !code ? (
          <div className="rounded-lg border border-dashed border-hairline bg-secondary/30 px-4 py-6 text-center">
            <p className="text-sm text-foreground">Aucun code d'invitation pour l'instant.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Générez un code pour partager l'accès au groupe.
            </p>
            <button
              type="button"
              onClick={() => createM.mutate()}
              disabled={createM.isPending}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Générer un code
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              {/* Code */}
              <div className="rounded-lg border border-hairline bg-secondary/30 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Code d'invitation
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <p className="flex-1 truncate font-mono text-xl font-bold tracking-[0.18em] text-foreground num">
                    {code}
                  </p>
                  <button
                    type="button"
                    onClick={() => copy(code, "Code copié")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline bg-card px-3 text-xs font-medium text-foreground transition hover:bg-secondary"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copier
                  </button>
                </div>
              </div>

              {/* Lien */}
              <div className="rounded-lg border border-hairline bg-secondary/30 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Lien partageable
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-1.5 truncate rounded-md border border-hairline bg-card px-2 py-2 text-xs text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate font-mono">{link}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(link, "Lien copié")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline bg-card px-3 text-xs font-medium text-foreground transition hover:bg-secondary"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copier
                  </button>
                </div>
              </div>
            </div>

            {/* Quick share */}
            <div className="flex flex-wrap gap-2">
              <a
                href={mailtoHref}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
              >
                <Mail className="h-4 w-4" />
                Partager par e‑mail
              </a>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-hairline bg-card px-4 text-xs font-medium text-foreground transition hover:bg-secondary"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground">
              L'envoi automatique d'e‑mails sera activé prochainement. En attendant, votre client mail
              s'ouvre avec un message pré‑rempli.
            </p>

            {/* Liste codes récents */}
            {recent.length > 0 && (
              <div className="rounded-lg border border-hairline">
                <p className="border-b border-hairline px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Codes récents
                </p>
                <ul className="divide-y divide-hairline">
                  {recent.map((inv) => (
                    <li key={inv.id} className="flex items-center gap-3 px-4 py-2.5">
                      <p className="flex-1 truncate font-mono text-sm font-semibold tracking-[0.14em] text-foreground num">
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
                        {inv.uses_count}
                        {inv.max_uses ? `/${inv.max_uses}` : ""} util.
                      </span>
                      {inv.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => revokeM.mutate(inv.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-hairline px-2 text-xs font-medium text-destructive transition hover:bg-destructive/5"
                        >
                          <XCircle className="h-3 w-3" />
                          Révoquer
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}