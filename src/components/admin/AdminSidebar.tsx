import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Trash2,
  Users,
  Layers,
  ScrollText,
  CreditCard,
  ArrowLeftCircle,
  ShieldAlert,
  KeyRound,
  MessageSquare,
  Send,
  CalendarClock,
  AlertOctagon,
} from "lucide-react";
import { BadgeCheck, Banknote, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/admin/overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { to: "/admin/suppressions", label: "Suppressions", icon: Trash2 },
  { to: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
  { to: "/admin/groupes", label: "Groupes & tontines", icon: Layers },
  { to: "/admin/paiements", label: "Paiements", icon: CreditCard },
  { to: "/admin/audit", label: "Audit", icon: ScrollText },
  { to: "/admin/integrite", label: "Intégrité tontine", icon: ShieldAlert },
  { to: "/admin/defaillants", label: "Défaillants", icon: AlertOctagon },
  { to: "/admin/kyc", label: "Vérifications KYC", icon: BadgeCheck },
  { to: "/admin/cautions", label: "Cautions", icon: Banknote },
  { to: "/admin/contrat", label: "Contrat numérique", icon: FileText },
  { to: "/admin/djomy", label: "Identifiants Djomy", icon: KeyRound },
  { to: "/admin/sms-test", label: "Test SMS", icon: Send },
  { to: "/admin/sms-logs", label: "Journal SMS", icon: MessageSquare },
  { to: "/admin/cron-preview", label: "Aperçu cron rappels", icon: CalendarClock },
];

export function AdminSidebar() {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-slate-900 border-r border-slate-800">
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-amber-400 text-slate-900 grid place-items-center font-bold">T</div>
          <div>
            <div className="font-semibold text-amber-400 leading-tight">Tontine Admin</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Back-office</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-amber-400/10 text-amber-300 border border-amber-400/20"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white",
              )
            }
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-800">
        <NavLink
          to="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <ArrowLeftCircle className="h-4 w-4" />
          Retour à l'app
        </NavLink>
      </div>
    </aside>
  );
}