import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Bell,
  Crown,
  Flag,
  Gavel,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CalendarEventType } from "@/lib/types";

export interface EventVisual {
  Icon: LucideIcon;
  /** Foreground color for icons / accents (Tailwind class). */
  fg: string;
  /** Background tint for chips / pill (Tailwind class). */
  bg: string;
  /** Solid colour used for dots / accent stripes (Tailwind class). */
  dot: string;
  label: string;
}

export const EVENT_VISUALS: Record<CalendarEventType, EventVisual> = {
  contribution: {
    Icon: ArrowUpRight,
    fg: "text-foreground",
    bg: "bg-secondary",
    dot: "bg-foreground/60",
    label: "Cotisation",
  },
  "your-turn": {
    Icon: Crown,
    fg: "text-accent-700",
    bg: "bg-accent-50",
    dot: "bg-accent-500",
    label: "Votre tour",
  },
  turn: {
    Icon: ArrowDownLeft,
    fg: "text-primary",
    bg: "bg-primary-50",
    dot: "bg-primary",
    label: "Tour bénéficiaire",
  },
  meeting: {
    Icon: Users,
    fg: "text-primary",
    bg: "bg-primary-50",
    dot: "bg-primary",
    label: "Réunion",
  },
  "cycle-start": {
    Icon: Sparkles,
    fg: "text-success",
    bg: "bg-success/10",
    dot: "bg-success",
    label: "Démarrage",
  },
  "cycle-end": {
    Icon: Flag,
    fg: "text-muted-foreground",
    bg: "bg-muted",
    dot: "bg-muted-foreground/60",
    label: "Clôture",
  },
  "swap-deadline": {
    Icon: ArrowRightLeft,
    fg: "text-warning",
    bg: "bg-warning/10",
    dot: "bg-warning",
    label: "Échange",
  },
  "rule-vote": {
    Icon: Gavel,
    fg: "text-destructive",
    bg: "bg-destructive/10",
    dot: "bg-destructive",
    label: "Vote",
  },
  reminder: {
    Icon: Bell,
    fg: "text-warning",
    bg: "bg-warning/10",
    dot: "bg-warning",
    label: "Rappel",
  },
};

export const EVENT_TYPES_ORDERED: CalendarEventType[] = [
  "your-turn",
  "contribution",
  "turn",
  "meeting",
  "rule-vote",
  "swap-deadline",
  "cycle-start",
  "cycle-end",
  "reminder",
];
