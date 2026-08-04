import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, ChevronRight } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { useAuth } from "@/hooks/useAuth";
import { getGroup } from "@/lib/api/groups";
import { listAdminPermissions } from "@/lib/api/adminPermissions";
import { MembersAdminPanel } from "@/components/group/MembersAdminPanel";

export default function GroupMembers() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const groupQ = useQuery({
    queryKey: ["group", id],
    queryFn: () => getGroup(id as string),
    enabled: !!id,
  });
  const adminsQ = useQuery({
    queryKey: ["group-admin-perms", id],
    queryFn: () => listAdminPermissions(id as string),
    enabled: !!id,
  });

  const isOwner = !!user?.id && !!groupQ.data && groupQ.data.created_by === user.id;
  const myAdmin = useMemo(
    () => (adminsQ.data ?? []).find((r) => r.user_id === user?.id) ?? null,
    [adminsQ.data, user?.id],
  );
  const canAccess = isOwner || !!myAdmin;

  useEffect(() => {
    if (!groupQ.data || !user?.id || adminsQ.isLoading) return;
    if (!canAccess) {
      toast.error("Accès réservé à l'organisateur");
      navigate(`/groupes/${id}`);
    }
  }, [groupQ.data, user?.id, adminsQ.isLoading, canAccess, id, navigate]);

  if (groupQ.isLoading || !groupQ.data || !user?.id) {
    return <div className="px-6 py-12 text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!canAccess) return null;

  const grp = groupQ.data;

  return (
    <div className="animate-fade-in">
      <TopBar title="Gérer les membres" subtitle={`Groupe · ${grp.name}`} />
      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <button
          type="button"
          onClick={() => navigate(`/groupes/${id}`)}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour au groupe
        </button>

        <MembersAdminPanel
          groupId={grp.id}
          currentUserId={user.id}
          ownerUserId={grp.created_by}
        />

        <Link
          to={`/groupes/${id}/co-organisateurs`}
          className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary-50/40 px-4 py-3 text-sm transition hover:bg-primary-50"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold text-foreground">Co-organisateurs</span>
              <span className="text-xs text-muted-foreground">
                Voir et configurer les permissions granulaires
              </span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        <SectionCard title="Aide" bare>
          <p className="px-5 py-4 text-xs text-muted-foreground lg:px-6">
            <strong className="text-foreground">Suspendre</strong> bloque temporairement le membre (chat, enchères, échanges). <strong className="text-foreground">Exclure</strong> est définitif et marque ses tours à venir comme sautés. Les actions sont tracées dans le journal d'audit.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}