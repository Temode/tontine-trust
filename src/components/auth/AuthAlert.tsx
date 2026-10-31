import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

type Variant = "info" | "success" | "error" | "loading";

interface AuthAlertProps {
  variant: Variant;
  title?: string;
  children?: ReactNode;
  className?: string;
}

const CONFIG: Record<Variant, { icon: typeof Info; wrap: string; iconWrap: string; title: string }> = {
  info: {
    icon: Info,
    wrap: "border-foreground/10 bg-foreground/[0.02]",
    iconWrap: "bg-foreground/5 text-foreground/60",
    title: "text-foreground",
  },
  success: {
    icon: CheckCircle2,
    wrap: "border-primary/20 bg-primary/5",
    iconWrap: "bg-primary/10 text-primary",
    title: "text-primary",
  },
  error: {
    icon: AlertTriangle,
    wrap: "border-destructive/25 bg-destructive/5",
    iconWrap: "bg-destructive/10 text-destructive",
    title: "text-destructive",
  },
  loading: {
    icon: Loader2,
    wrap: "border-foreground/10 bg-foreground/[0.02]",
    iconWrap: "bg-foreground/5 text-foreground/70",
    title: "text-foreground",
  },
};

/**
 * Bloc de statut unifié pour toutes les pages /auth :
 * loading / succès / erreur / info avec la même géométrie et
 * les mêmes tokens (Infrastructure Calme).
 */
export function AuthAlert({ variant, title, children, className }: AuthAlertProps) {
  const cfg = CONFIG[variant];
  const Icon = cfg.icon;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3 text-sm",
        cfg.wrap,
        className,
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          cfg.iconWrap,
        )}
      >
        <Icon className={cn("h-4 w-4", variant === "loading" && "animate-spin")} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className={cn("text-sm font-semibold", cfg.title)}>{title}</p>}
        {children && (
          <div className={cn("text-[13px] leading-relaxed text-foreground/70", title && "mt-0.5")}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
