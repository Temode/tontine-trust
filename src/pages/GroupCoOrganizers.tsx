import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Crown, ShieldCheck, UserPlus, Trash2, Pencil, Info,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { getGroup } from "@/lib/api/groups";
import { listGroupMembers } from "@/lib/api/members";
import {
  listAdminPermissions, grantAdminPermissions, revokeAdminPermissions,
  ADMIN_PERMISSION_KEYS,
  type AdminPermissionKey, type AdminPermissionsRow,
} from "@/lib/api/adminPermissions";
import { PermissionsMatrix } from "@/components/group/PermissionsMatrix";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";

type EditState =
  | { kind: "create"; userId: string; name: string }
  | { kind: "edit"; row: AdminPermissionsRow; name: string };

function emptyPerms(): Record<AdminPermissionKey, boolean> {
  const v = {} as Record<AdminPermissionKey, boolean>;
  ADMIN_PERMISSION_KEYS.forEach((k) => { v[k] = false; });
  return v;
}

function rowToPerms(row: AdminPermissionsRow): Record<AdminPermissionKey, boolean> {
  const v = emptyPerms();
  ADMIN_PERMISSION_KEYS.forEach((k) => { v[k] = !!row[k]; });
  return v;
}

export default function GroupCoOrganizers() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const groupQ = useQuery({
    queryKey: ["group", id],
    queryFn: () => getGroup(id as string),
    enabled: !!id,
  });
  const membersQ = useQuery({
    queryKey: ["group-members-admin", id],
    queryFn: () => listGroupMembers(id as string),
    enabled: !!id,
  });
  const adminsQ = useQuery({
    queryKey: ["group-admin-perms", id],
    queryFn: () => listAdminPermissions(id as string),
    enabled: !!id,
  });

  const [edit, setEdit] = useState<EditState | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AdminPermissionsRow | null>(null);
  const [promoteUserId, setPromoteUserId] = useState<string>("");

  const isOwner = !!user?.id && !!groupQ.data && groupQ.data.created_by === user.id;
  const myAdminRow = useMemo(
    () => (adminsQ.data ?? []).find((r) => r.user_id === user?.id) ?? null,
    [adminsQ.data, user?.id],
  );
  const isCoOrganizer = !!myAdminRow;

  // Membre simple -> redirige
  useEffect(() => {
    if (!groupQ.data || !user?.id) return;
    if (!isOwner && !isCoOrganizer && !adminsQ.isLoading) {
      toast.error("Accès réservé à l'organisateur");
      navigate(`/groupes/${id}`);
    }
  }, [groupQ.data, user?.id, isOwner, isCoOrganizer, adminsQ.isLoading, id, navigate]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["group-admin-perms", id] });
    qc.invalidateQueries({ queryKey: ["group-members-admin", id] });
  };

  const revokeM = useMutation({
    mutationFn: (userId: string) => revokeAdminPermissions(id as string, userId),
    onSuccess: () => {
      toast.success("Co-organisateur révoqué");
      invalidate();
      setRevokeTarget(null);
    },
    onError: (e: Error) => toast.error("Révocation impossible", { description: e.message }),
  });

  if (groupQ.isLoading || !groupQ.data) {
    return <div className="px-6 py-12 text-sm text-muted-foreground">Chargement…</div>;
  }

  const grp = groupQ.data;
  const admins = adminsQ.data ?? [];
  const members = (membersQ.data ?? []).filter((m) => m.status === "active");
  const adminUserIds = new Set(admins.map((a) => a.user_id));
  const activeNonOwner = members.filter((m) => m.user_id !== grp.created_by);
  const promotables = members.filter(
    (m) => m.user_id !== grp.created_by && !adminUserIds.has(m.user_id),
  );

  const viewerBadge = isOwner
    ? { label: "Organisateur principal", className: "border-accent-300 bg-accent-50 text-accent-700", Icon: Crown }
    : { label: "Co-organisateur", className: "border-primary/30 bg-primary-50 text-primary-700", Icon: ShieldCheck };

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Co-organisateurs"
        subtitle={`Groupe · ${grp.name}`}
      />
      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(`/groupes/${id}`)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour au groupe
          </button>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
              viewerBadge.className,
            )}
          >
            <viewerBadge.Icon className="h-3.5 w-3.5" />
            {viewerBadge.label}
          </span>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary-50/50 px-4 py-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-foreground">
            Un co-organisateur peut aider à gérer le groupe avec les droits que vous lui
            accordez. {isOwner ? "Vous pouvez modifier ou retirer ces droits à tout moment." : "Seul l'organisateur principal peut modifier ces droits."}
          </p>
        </div>

        {isOwner && (
          <SectionCard
            title="Promouvoir un membre"
            subtitle="Choisissez le membre à qui confier des droits supplémentaires"
          >
            {activeNonOwner.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Aucun membre éligible. Invitez d'abord des participants au
                  groupe, puis revenez ici pour leur confier des droits.
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate(`/groupes/${id}`)}>
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Inviter des membres
                </Button>
              </div>
            ) : promotables.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tous les membres actifs sont déjà co-organisateurs.
              </p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Membre
                  </label>
                  <Select value={promoteUserId} onValueChange={setPromoteUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un membre" />
                    </SelectTrigger>
                    <SelectContent>
                      {promotables.map((m) => (
                        <SelectItem key={m.id} value={m.user_id}>
                          {m.profile?.full_name ?? "Membre"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  disabled={!promoteUserId}
                  onClick={() => {
                    const m = promotables.find((x) => x.user_id === promoteUserId);
                    if (!m) return;
                    setEdit({
                      kind: "create",
                      userId: m.user_id,
                      name: m.profile?.full_name ?? "Membre",
                    });
                  }}
                >
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Configurer les droits
                </Button>
              </div>
            )}
          </SectionCard>
        )}

        <SectionCard
          title="Co-organisateurs actuels"
          subtitle={`${admins.length} co-organisateur${admins.length > 1 ? "s" : ""}`}
        >
          {adminsQ.isLoading && (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          )}
          {!adminsQ.isLoading && admins.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Aucun co-organisateur pour le moment
              </p>
              <p className="text-xs text-muted-foreground">
                {isOwner
                  ? "Promouvez un membre pour partager la gestion du groupe."
                  : "L'organisateur principal n'a confié aucun droit pour l'instant."}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {admins.map((row) => {
              const isSelf = row.user_id === user?.id;
              const initials = getInitials(row.full_name ?? "") || "··";
              return (
                <div
                  key={row.user_id}
                  className={cn(
                    "rounded-lg border p-4",
                    isSelf ? "border-primary/40 bg-primary-50/30" : "border-hairline bg-card",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-bold text-foreground">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <span className="truncate">{row.full_name ?? "Membre"}</span>
                          {isSelf && (
                            <span className="rounded-full border border-primary/30 bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                              Vous
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.phone_number ?? "—"} · depuis le{" "}
                          {new Date(row.granted_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                    {isOwner && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEdit({
                              kind: "edit",
                              row,
                              name: row.full_name ?? "Membre",
                            })
                          }
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Modifier
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/5"
                          onClick={() => setRevokeTarget(row)}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Retirer
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <PermissionsMatrix values={rowToPerms(row)} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {!isOwner && (
          <p className="text-xs text-muted-foreground">
            Pour transférer la propriété ou révoquer un co-organisateur, demandez à l'organisateur principal{" "}
            <Link to={`/groupes/${id}`} className="text-primary underline">
              dans le groupe
            </Link>
            .
          </p>
        )}
      </div>

      {edit && (
        <EditPermissionsDialog
          groupId={id as string}
          state={edit}
          onClose={() => {
            setEdit(null);
            if (edit.kind === "create") setPromoteUserId("");
          }}
          onSaved={() => {
            invalidate();
            setEdit(null);
            setPromoteUserId("");
          }}
        />
      )}

      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer le rôle de co-organisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.full_name ?? "Ce membre"} redeviendra un membre standard du
              groupe. Toutes ses permissions d'administration seront supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeTarget && revokeM.mutate(revokeTarget.user_id)}
            >
              Retirer le rôle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditPermissionsDialog({
  groupId, state, onClose, onSaved,
}: {
  groupId: string;
  state: EditState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [perms, setPerms] = useState<Record<AdminPermissionKey, boolean>>(
    state.kind === "edit" ? rowToPerms(state.row) : emptyPerms(),
  );
  const userId = state.kind === "edit" ? state.row.user_id : state.userId;
  const isCreate = state.kind === "create";

  const saveM = useMutation({
    mutationFn: () => grantAdminPermissions(groupId, userId, perms),
    onSuccess: () => {
      toast.success(isCreate ? "Co-organisateur ajouté" : "Permissions mises à jour");
      onSaved();
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  const anyChecked = ADMIN_PERMISSION_KEYS.some((k) => perms[k]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? "Nouveau co-organisateur" : "Modifier les permissions"} ·{" "}
            {state.name}
          </DialogTitle>
          <DialogDescription>
            Cochez chaque action que ce co-organisateur pourra réaliser. Vous pourrez
            modifier ces droits à tout moment.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <PermissionsMatrix
            values={perms}
            mode="editable"
            onChange={(k, v) => setPerms((p) => ({ ...p, [k]: v }))}
          />
        </div>
        {!anyChecked && (
          <p className="text-xs text-warning">
            Aucune permission sélectionnée : le membre restera standard.
          </p>
        )}
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