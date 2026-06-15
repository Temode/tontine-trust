import { Check, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  ADMIN_PERMISSION_LABELS,
  type AdminPermissionKey,
} from "@/lib/api/adminPermissions";

export const PERMISSION_GROUPS: Array<{
  title: string;
  keys: AdminPermissionKey[];
}> = [
  {
    title: "Membres",
    keys: ["can_approve_members", "can_suspend_member", "can_kick_member"],
  },
  {
    title: "Opérations",
    keys: [
      "can_edit_settings",
      "can_manage_invitations",
      "can_confirm_payments",
      "can_pause_cycle",
    ],
  },
  {
    title: "Communication & finance",
    keys: ["can_send_announcements", "can_waive_penalty"],
  },
];

interface Props {
  values: Record<AdminPermissionKey, boolean>;
  mode?: "readonly" | "editable";
  onChange?: (key: AdminPermissionKey, value: boolean) => void;
}

export function PermissionsMatrix({ values, mode = "readonly", onChange }: Props) {
  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.title}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.keys.map((k) => {
              const active = !!values[k];
              if (mode === "editable") {
                return (
                  <label
                    key={k}
                    className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-card px-3 py-2 text-sm"
                  >
                    <span className="text-foreground">{ADMIN_PERMISSION_LABELS[k]}</span>
                    <Switch
                      checked={active}
                      onCheckedChange={(v) => onChange?.(k, v)}
                    />
                  </label>
                );
              }
              return (
                <div
                  key={k}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                    active
                      ? "border-primary/30 bg-primary-50 text-primary-700"
                      : "border-hairline bg-card text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      active ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{ADMIN_PERMISSION_LABELS[k]}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}