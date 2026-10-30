import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTION_LABEL, listGroupAudit } from "@/lib/api/audit";
import { SectionCard } from "@/components/dashboard/SectionCard";

interface Props {
  groupId: string;
}

const SEVERITY: Record<string, string> = {
  start_cycle: "bg-primary-50 text-primary-700",
  release_payout: "bg-success/10 text-success",
  update_group_settings: "bg-accent-100 text-accent-700",
  approve_member: "bg-success/10 text-success",
  reject_member: "bg-destructive/10 text-destructive",
  record_payment: "bg-secondary text-foreground",
};

export function AuditLog({ groupId }: Props) {
  const [filter, setFilter] = useState<string>("");
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["audit", groupId],
    queryFn: () => listGroupAudit(groupId),
  });

  const actions = Array.from(new Set(entries.map((e) => e.action)));
  const filtered = filter ? entries.filter((e) => e.action === filter) : entries;

  return (
    <SectionCard
      title="Journal d'audit"
      subtitle={`${entries.length} évènement${entries.length > 1 ? "s" : ""}`}
      bare
    >
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 py-2 lg:px-6">
          <button
            type="button"
            onClick={() => setFilter("")}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition",
              filter === "" ? "border-primary bg-primary text-primary-foreground" : "border-hairline text-muted-foreground hover:text-foreground",
            )}
          >
            Toutes
          </button>
          {actions.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setFilter(a)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition",
                filter === a ? "border-primary bg-primary text-primary-foreground" : "border-hairline text-muted-foreground hover:text-foreground",
              )}
            >
              {ACTION_LABEL[a] ?? a}
            </button>
          ))}
        </div>
      )}

      <ul className="divide-y divide-border/60">
        {isLoading && (
          <li className="px-5 py-4 text-xs text-muted-foreground">Chargement…</li>
        )}
        {!isLoading && filtered.length === 0 && (
          <li className="px-5 py-4 text-xs text-muted-foreground">Aucun évènement enregistré.</li>
        )}
        {filtered.map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-5 py-3 lg:px-6">
            <span className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
              SEVERITY[e.action] ?? "bg-secondary text-foreground",
            )}>
              <ScrollText className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {ACTION_LABEL[e.action] ?? e.action}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString("fr-FR", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
                {e.actor_name ? ` · ${e.actor_name}` : ""}
                {e.entity_type ? ` · ${e.entity_type}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}