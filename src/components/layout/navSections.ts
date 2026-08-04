import {
  FileCheck2,
  LayoutDashboard,
  type LucideIcon,
  MessageCircle,
  PiggyBank,
  Sparkles,
  User,
  Users,
  Wallet,
  Target,
  Globe2,
  Briefcase,
  Share2,
  Bell,
} from "lucide-react";

export interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  dot?: boolean;
  tourId?: string;
}

export interface NavSection {
  label: string;
  items: NavEntry[];
}

export const navSections: NavSection[] = [
  {
    label: "Essentiel",
    items: [
      { to: "/dashboard", label: "Accueil", icon: LayoutDashboard, tourId: "nav-accueil" },
      { to: "/groupes", label: "Mes tontines", icon: Users, tourId: "nav-tontines" },
      { to: "/discussions", label: "Discussions", icon: MessageCircle, tourId: "nav-discussions" },
      { to: "/cotisations", label: "Payer", icon: Wallet, tourId: "nav-payer" },
      { to: "/solde", label: "Mon solde", icon: PiggyBank },
      { to: "/solo", label: "Épargne Solo", icon: Target },
      { to: "/international", label: "International", icon: Globe2 },
      { to: "/coordinateur/commissions", label: "Mes commissions", icon: Briefcase },
      { to: "/affiliation", label: "Affiliation", icon: Share2 },
      { to: "/recus", label: "Historique & reçus", icon: FileCheck2 },
      { to: "/notifications", label: "Notifications", icon: Bell },
      { to: "/abonnement", label: "Abonnement", icon: Sparkles },
      { to: "/profil", label: "Mon profil", icon: User },
    ],
  },
];