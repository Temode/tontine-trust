import { Link } from "react-router-dom";
import {
  Bell, CheckCircle2, Coins, FileCheck2, Mail, Megaphone, RefreshCw, Sparkles, UserPlus, Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_LABEL, resolveNotificationLink, type DbNotification, type NotificationKind } from "@/lib/api/notifications";

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  invitation_received: Mail,
  invitation_accepted: Mail,
  cycle_started: Sparkles,
  contribution_due: Coins,
  contribution_received: Coins,
  contribution_confirmed: CheckCircle2,
  turn_started: Sparkles,
  turn_paid: Wallet,
  payout_released: Wallet,
  receipt_ready: FileCheck2,
  reliability_changed: RefreshCw,
  member_joined: UserPlus,
  group_completed: CheckCircle2,
  announcement: Megaphone,
  system: Bell,
};

interface Props {
  notification: DbNotification;
  onClick?: (n: DbNotification) => void;
  dense?: boolean;
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `il y a ${j} j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

export function NotificationItem({ notification: n, onClick, dense }: Props) {
  const Icon = KIND_ICON[n.kind] ?? Bell;
  const unread = !n.read_at;
  const inner = (
    <div
      className={cn(
        "flex items-start gap-3 border-l-2 px-4 py-3 transition",
        unread ? "border-primary bg-primary/5" : "border-transparent",
        onClick && "cursor-pointer hover:bg-secondary/60",
        dense && "py-2.5",
      )}
    >
      <div className={cn(
        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        unread ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn("truncate text-sm", unread ? "font-semibold text-foreground" : "text-foreground")}>
            {n.title}
          </p>
          {unread && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
        </div>
        {n.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
        )}
        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {KIND_LABEL[n.kind] ?? n.kind} · {relativeTime(n.created_at)}
        </p>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={() => onClick(n)} className="block w-full text-left">
        {inner}
      </button>
    );
  }
  return <Link to={resolveNotificationLink(n)} className="block">{inner}</Link>;
}