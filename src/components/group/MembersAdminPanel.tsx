import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MoreVertical, UserMinus, UserCheck, ShieldOff, Settings2,
  Crown, ShieldCheck, AlertTriangle, X,
} from "lucide-react";
import {
  listGroupMembers, suspendMember, reactivateMember, kickMember,
  setMemberPermissions, transferOwnership,
} from "@/lib/api/members";
import {
  listAdminPermissions, grantAdminPermissions, revokeAdminPermissions,
  ADMIN_PERMISSION_KEYS, ADMIN_PERMISSION_LABELS,
  type AdminPermissionKey, type AdminPermissionsRow,
} from "@/lib/api/adminPermissions";
import type { DbGroupMember } from "@/lib/api/types";
import { SectionCard } from "@/components/dashboard/SectionCard";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  groupId: string;
  currentUserId: string;
  ownerUserId: string;
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-success/10 text-success border-success/30",
  pending: "bg-warning/10 text-warning border-warning/30",
  suspended: "bg-destructive/10 text-destructive border-destructive/30",
  removed: "bg-muted text-muted-foreground border-hairline",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Actif", pending: "En attente",
  suspended: "Suspendu", removed: "Exclu", invited: "Invité", left: "Parti",
};

export function MembersAdminPanel({ groupId, currentUserId, ownerUserId }: Props) {
  const qc = useQueryClient();
  const isOwner = currentUserId === ownerUserId;

  const membersQ = useQuery({
    queryKey: ["group-members-admin", groupId],
    queryFn: () => listGroupMembers(groupId),
  });
  const adminPermsQ = useQuery({
    queryKey: ["group-admin-perms", groupId],
    queryFn: () => listAdminPermissions(groupId),
  });

  const permsByUser = useMemo(() => {
    const map = new Map<string, AdminPermissionsRow>();
    (adminPermsQ.data ?? []).forEach((p) => map.set(p.user_id, p));
    return map;
  }, [adminPermsQ.data]);

  const [confirm, setConfirm] = useState<
    | { kind: "suspend" | "kick" | "transfer"; member: DbGroupMember; reason: string }
    | null
  >(null);
  const [memberPermsDialog, setMemberPermsDialog] = useState<DbGroupMember | null>(null);
  const [adminPermsDialog, setAdminPermsDialog] = useState<DbGroupMember | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["group-members-admin", groupId] });
    qc.invalidateQueries({ queryKey: ["group-admin-perms", groupId] });
    qc.invalidateQueries({ queryKey: ["group-members", groupId] });
    qc.invalidateQueries({ queryKey: ["group", groupId] });
  };

  const suspendM = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => suspendMember(id, reason),
    onSuccess: () => { toast.success("Membre suspendu"); invalidate(); setConfirm(null); },
    onError: (e: Error) => toast.error("Suspension impossible", { description: e.message }),
  });
  const reactivateM = useMutation({
    mutationFn: (id: string) => reactivateMember(id),
    onSuccess: () => { toast.success("Membre réactivé"); invalidate(); },
    onError: (e: Error) => toast.error("Réactivation impossible", { description: e.message }),
  });
  const kickM = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => kickMember(id, reason),
    onSuccess: () => { toast.success("Membre exclu"); invalidate(); setConfirm(null); },
    onError: (e: Error) => toast.error("Exclusion impossible", { description: e.message }),
  });
  const transferM = useMutation({
    mutationFn: (userId: string) => transferOwnership(groupId, userId),
    onSuccess: () => { toast.success("Propriété transférée"); invalidate(); setConfirm(null); },
    onError: (e: Error) => toast.error("Transfert impossible", { description: e.message }),
  });

  const members = (membersQ.data ?? []).filter((m) => m.status !== "removed");

  return (
    <>
      <SectionCard
        title="Gestion des membres"
        subtitle={`${members.length} membre${members.length > 1 ? "s" : ""} actif${members.length > 1 ? "s" : ""}`}
      >
        <ul className="divide-y divide-border/60">
          {membersQ.isLoading && (
            <li className="py-4 text-sm text-muted-foreground">Chargement…</li>
          )}
          {members.map((m) => {
            const isSelf = m.user_id === currentUserId;
            const isOwnerRow = m.user_id === ownerUserId;
            const hasCoOrg = permsByUser.has(m.user_id);
            return (
              <li key={m.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {m.profile?.full_name ?? "Membre"}
                    </span>
                    {isOwnerRow && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-accent-300 bg-accent-50 px-2 py-0.5 text-[10px] font-semibold text-accent-700">
                        <Crown className="h-3 w-3" /> Propriétaire
                      </span>
                    )}
                    {!isOwnerRow && hasCoOrg && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                        <ShieldCheck className="h-3 w-3" /> Co-organisateur
                      </span>
                    )}
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      STATUS_BADGE[m.status] ?? "bg-muted text-muted-foreground border-hairline",
                    )}>
                      {STATUS_LABEL[m.status] ?? m.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {m.profile?.phone_number ?? "—"}
                    {m.position ? ` · Position ${m.position}` : ""}
                  </p>
                  {m.status === "suspended" && m.suspended_reason && (
                    <p className="mt-1 text-xs text-destructive flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{m.suspended_reason}</span>
                    </p>
                  )}
                </div>

                {!isSelf && !isOwnerRow && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 rounded-md border border-hairline text-muted-foreground hover:bg-secondary inline-flex items-center justify-center">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      {m.status === "active" && (
                        <DropdownMenuItem onClick={() => setConfirm({ kind: "suspend", member: m, reason: "" })}>
                          <ShieldOff className="mr-2 h-4 w-4" /> Suspendre
                        </DropdownMenuItem>
                      )}
                      {m.status === "suspended" && (
                        <DropdownMenuItem onClick={() => reactivateM.mutate(m.id)}>
                          <UserCheck className="mr-2 h-4 w-4" /> Réactiver
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setMemberPermsDialog(m)}>
                        <Settings2 className="mr-2 h-4 w-4" /> Permissions membre
                      </DropdownMenuItem>
                      {isOwner && m.status === "active" && (
                        <DropdownMenuItem onClick={() => setAdminPermsDialog(m)}>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          {hasCoOrg ? "Droits co-organisateur" : "Promouvoir co-org."}
                        </DropdownMenuItem>
                      )}
                      {isOwner && m.status === "active" && (
                        <DropdownMenuItem onClick={() => setConfirm({ kind: "transfer", member: m, reason: "" })}>
                          <Crown className="mr-2 h-4 w-4" /> Transférer la propriété
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setConfirm({ kind: "kick", member: m, reason: "" })}
                      >
                        <UserMinus className="mr-2 h-4 w-4" /> Exclure définitivement
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
          {!membersQ.isLoading && members.length === 0 && (
            <li className="py-4 text-sm text-muted-foreground">Aucun membre.</li>
          )}
        </ul>
      </SectionCard>

      {/* Dialogue confirm suspend / kick / transfer */}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "suspend" && "Suspendre ce membre ?"}
              {confirm?.kind === "kick" && "Exclure définitivement ce membre ?"}
              {confirm?.kind === "transfer" && "Transférer la propriété ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "suspend" && "Le membre ne pourra plus participer (chat, enchères, échanges) tant qu'il est suspendu."}
              {confirm?.kind === "kick" && "Cette action est irréversible. Les tours à venir du membre seront marqués comme sautés."}
              {confirm?.kind === "transfer" && "Vous resterez co-organisateur avec tous les droits, mais le nouveau propriétaire pourra modifier les permissions."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(confirm?.kind === "suspend" || confirm?.kind === "kick") && (
            <Textarea
              placeholder="Motif (facultatif) — sera communiqué au membre"
              value={confirm?.reason ?? ""}
              onChange={(e) => confirm && setConfirm({ ...confirm, reason: e.target.value })}
              className="mt-2"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className={confirm?.kind === "kick" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => {
                if (!confirm) return;
                if (confirm.kind === "suspend") suspendM.mutate({ id: confirm.member.id, reason: confirm.reason });
                else if (confirm.kind === "kick") kickM.mutate({ id: confirm.member.id, reason: confirm.reason });
                else if (confirm.kind === "transfer") transferM.mutate(confirm.member.user_id);
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {memberPermsDialog && (
        <MemberPermsDialog
          member={memberPermsDialog}
          onClose={() => setMemberPermsDialog(null)}
          onSaved={invalidate}
        />
      )}
      {adminPermsDialog && (
        <AdminPermsDialog
          groupId={groupId}
          member={adminPermsDialog}
          existing={permsByUser.get(adminPermsDialog.user_id)}
          onClose={() => setAdminPermsDialog(null)}
          onSaved={invalidate}
        />
      )}
    </>
  );
}

function MemberPermsDialog({
  member, onClose, onSaved,
}: { member: DbGroupMember; onClose: () => void; onSaved: () => void }) {
  const [perms, setPerms] = useState({
    can_chat: member.can_chat ?? true,
    can_bid: member.can_bid ?? true,
    can_swap: member.can_swap ?? true,
    can_invite: member.can_invite ?? false,
  });
  const saveM = useMutation({
    mutationFn: () => setMemberPermissions(member.id, perms),
    onSuccess: () => { toast.success("Permissions enregistrées"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });
  const ROWS: Array<{ key: keyof typeof perms; label: string; desc: string }> = [
    { key: "can_chat", label: "Participer au chat", desc: "Envoyer des messages dans le groupe" },
    { key: "can_bid", label: "Enchérir", desc: "Placer des enchères sur les tours" },
    { key: "can_swap", label: "Demander des échanges", desc: "Proposer un swap de tour" },
    { key: "can_invite", label: "Inviter des membres", desc: "Créer/partager des invitations" },
  ];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permissions de {member.profile?.full_name ?? "ce membre"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {ROWS.map((r) => (
            <label key={r.key} className="flex items-start justify-between gap-3 rounded-md border border-hairline p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </div>
              <Switch
                checked={perms[r.key]}
                onCheckedChange={(v) => setPerms((p) => ({ ...p, [r.key]: v }))}
              />
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            {saveM.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminPermsDialog({
  groupId, member, existing, onClose, onSaved,
}: {
  groupId: string; member: DbGroupMember;
  existing?: AdminPermissionsRow; onClose: () => void; onSaved: () => void;
}) {
  const [perms, setPerms] = useState<Record<AdminPermissionKey, boolean>>(() => {
    const init = {} as Record<AdminPermissionKey, boolean>;
    ADMIN_PERMISSION_KEYS.forEach((k) => { init[k] = existing ? !!existing[k] : false; });
    return init;
  });
  const saveM = useMutation({
    mutationFn: () => grantAdminPermissions(groupId, member.user_id, perms),
    onSuccess: () => { toast.success("Permissions co-organisateur enregistrées"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });
  const revokeM = useMutation({
    mutationFn: () => revokeAdminPermissions(groupId, member.user_id),
    onSuccess: () => { toast.success("Co-organisateur révoqué"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Co-organisateur · {member.profile?.full_name ?? "membre"}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Cochez les actions que ce co-organisateur peut effectuer. Aucune permission cochée = il reste membre standard.
        </p>
        <div className="space-y-2">
          {ADMIN_PERMISSION_KEYS.map((k) => (
            <label key={k} className="flex items-center justify-between gap-3 rounded-md border border-hairline px-3 py-2">
              <span className="text-sm text-foreground">{ADMIN_PERMISSION_LABELS[k]}</span>
              <Switch
                checked={perms[k]}
                onCheckedChange={(v) => setPerms((p) => ({ ...p, [k]: v }))}
              />
            </label>
          ))}
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between">
          {existing ? (
            <Button variant="destructive" onClick={() => revokeM.mutate()} disabled={revokeM.isPending}>
              <X className="mr-1 h-4 w-4" /> Révoquer
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
              {saveM.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}