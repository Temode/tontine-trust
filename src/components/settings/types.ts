import type { LucideIcon } from "lucide-react";
import { CreditCard, FileBadge2, Gauge, Plug, ShieldCheck, Webhook } from "lucide-react";

export type SettingsSectionId =
  | "subscription"
  | "limits"
  | "mobile-money"
  | "api"
  | "privacy"
  | "compliance";

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "subscription",
    label: "Abonnement",
    icon: CreditCard,
    description: "Plan, facturation et fonctionnalités incluses",
  },
  {
    id: "limits",
    label: "Limites & quotas",
    icon: Gauge,
    description: "Plafonds de débit et capacité du compte",
  },
  {
    id: "mobile-money",
    label: "Mobile Money",
    icon: Plug,
    description: "Connexions Orange Money et MTN, débits automatiques",
  },
  {
    id: "api",
    label: "API & intégrations",
    icon: Webhook,
    description: "Clés d'accès, webhooks et journaux d'appel",
  },
  {
    id: "privacy",
    label: "Confidentialité",
    icon: ShieldCheck,
    description: "Partage de données, télémétrie, communications",
  },
  {
    id: "compliance",
    label: "Conformité",
    icon: FileBadge2,
    description: "Documents juridiques signés, agréments BCG",
  },
];
