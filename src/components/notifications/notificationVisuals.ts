import {
  Gavel,
  Settings2,
  ShieldAlert,
  UserPlus2,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotificationCategory, NotificationSeverity } from "@/lib/types";

export interface CategoryVisual {
  Icon: LucideIcon;
  label: string;
  /** Background tint. */
  bg: string;
  /** Foreground / icon. */
  fg: string;
  /** Solid dot color. */
  dot: string;
}

export const CATEGORY_VISUALS: Record<NotificationCategory, CategoryVisual> = {
  financial: {
    Icon: Wallet,
    label: "Financier",
    bg: "bg-primary-50",
    fg: "text-primary",
    dot: "bg-primary",
  },
  governance: {
    Icon: Gavel,
    label: "Gouvernance",
    bg: "bg-accent-50",
    fg: "text-accent-700",
    dot: "bg-accent-600",
  },
  security: {
    Icon: ShieldAlert,
    label: "Sécurité",
    bg: "bg-warning/10",
    fg: "text-warning",
    dot: "bg-warning",
  },
  system: {
    Icon: Settings2,
    label: "Système",
    bg: "bg-secondary",
    fg: "text-foreground",
    dot: "bg-foreground/70",
  },
  social: {
    Icon: UserPlus2,
    label: "Social",
    bg: "bg-success/10",
    fg: "text-success",
    dot: "bg-success",
  },
};

export const SEVERITY_VISUALS: Record<NotificationSeverity, { label: string; className: string }> = {
  info: { label: "Info", className: "bg-secondary text-muted-foreground" },
  warning: { label: "Attention", className: "bg-warning/10 text-warning" },
  critical: { label: "Critique", className: "bg-destructive/10 text-destructive" },
  success: { label: "OK", className: "bg-success/10 text-success" },
};

export const CATEGORY_ORDERED: NotificationCategory[] = [
  "financial",
  "governance",
  "security",
  "social",
  "system",
];
