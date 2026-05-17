import { Archive, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";
import { CATEGORY_VISUALS, SEVERITY_VISUALS } from "./notificationVisuals";

interface NotificationRowProps {
  notification: Notification;
  onMarkRead?: (id: string) => void;
  onArchive?: (id: string) => void;
}

export function NotificationRow({ notification, onMarkRead, onArchive }: NotificationRowProps) {
  const cv = CATEGORY_VISUALS[notification.category];
  const sv = SEVERITY_VISUALS[notification.severity];
  const Icon = cv.Icon;
  const isUnread = notification.status === "unread";
  const isArchived = notification.status === "archived";

  return (
    <article
      className={cn(
        "relative rounded-xl border px-5 py-4 transition lg:px-6",
        isUnread
          ? "border-primary/20 bg-primary-50/40"
          : isArchived
          ? "border-hairline bg-card opacity-70"
          : "border-hairline bg-card",
      )}
    >
      {isUnread && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r bg-primary"
        />
      )}

      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
            cv.bg,
            cv.fg,
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isUnread && (
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-primary" />
            )}
            <p
              className={cn(
                "min-w-0 truncate text-sm",
                isUnread ? "font-bold text-foreground" : "font-semibold text-foreground",
              )}
            >
              {notification.title}
            </p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                sv.className,
              )}
            >
              {sv.label}
            </span>
            {notification.requiresAction && !isArchived && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
                Action requise
              </span>
            )}
          </div>

          <p className="mt-1.5 text-sm text-muted-foreground">{notification.description}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 font-medium uppercase tracking-wider">
              {notification.source}
            </span>
            <span aria-hidden className="text-border">·</span>
            <span className="num">{notification.timestamp}</span>
            <span aria-hidden className="text-border">·</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <ShieldCheck className="h-3 w-3 text-success" />
              {notification.signature}
            </span>
          </div>

          {(notification.actionLabel || notification.secondaryActionLabel) && !isArchived && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {notification.actionLabel && notification.actionUrl && (
                <Link
                  to={notification.actionUrl}
                  onClick={() => onMarkRead?.(notification.id)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition",
                    notification.severity === "critical"
                      ? "bg-destructive text-destructive-foreground hover:opacity-90"
                      : notification.severity === "warning"
                      ? "bg-warning text-warning-foreground hover:opacity-90"
                      : "bg-primary text-primary-foreground hover:bg-primary-700",
                  )}
                >
                  {notification.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
              {notification.secondaryActionLabel && notification.secondaryActionUrl && (
                <Link
                  to={notification.secondaryActionUrl}
                  onClick={() => onMarkRead?.(notification.id)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-foreground transition hover:bg-secondary"
                >
                  {notification.secondaryActionLabel}
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isUnread && onMarkRead && (
            <button
              type="button"
              onClick={() => onMarkRead(notification.id)}
              aria-label="Marquer comme lu"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
          {!isArchived && onArchive && (
            <button
              type="button"
              onClick={() => onArchive(notification.id)}
              aria-label="Archiver"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
