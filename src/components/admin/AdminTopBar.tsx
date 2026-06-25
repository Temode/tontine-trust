import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/admin/overview": { title: "Vue d'ensemble", subtitle: "Indicateurs plateforme en temps réel" },
  "/admin/suppressions": { title: "Demandes de suppression", subtitle: "File d'attente Tontine — décisions finales" },
  "/admin/utilisateurs": { title: "Utilisateurs & rôles", subtitle: "Recherche, suspension et promotions" },
  "/admin/groupes": { title: "Groupes & tontines", subtitle: "Supervision, pause, archivage" },
  "/admin/paiements": { title: "Paiements", subtitle: "Transactions Djomy et preuves externes" },
  "/admin/audit": { title: "Journal d'audit", subtitle: "Historique global des actions" },
};

export function AdminTopBar() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { signOut, user } = useAuth();
  const match = Object.keys(TITLES).find((k) => pathname.startsWith(k));
  const { title, subtitle } = (match && TITLES[match]) || { title: "Admin", subtitle: "" };

  return (
    <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 text-xs font-semibold uppercase tracking-wider">
          <ShieldAlert className="h-3.5 w-3.5" /> Super admin
        </span>
        <span className="hidden md:inline text-sm text-slate-400">{user?.email}</span>
        <Button
          variant="outline"
          size="sm"
          className="bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800"
          onClick={async () => {
            await signOut();
            nav("/auth");
          }}
        >
          <LogOut className="h-4 w-4 mr-1" /> Quitter
        </Button>
      </div>
    </header>
  );
}