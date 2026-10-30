import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getMyPresence, setMyPresence, type PresenceStatus } from "@/lib/api/presence";
import { PresenceDot } from "./PresenceDot";
import { cn } from "@/lib/utils";

const OPTIONS: { value: PresenceStatus; label: string; hint: string }[] = [
  { value: "available", label: "Disponible", hint: "Recevra les demandes d'appel" },
  { value: "busy", label: "Occupé", hint: "Affichera un statut occupé" },
  { value: "dnd", label: "Ne pas déranger", hint: "Aucune notification d'appel" },
];

export function PresencePicker() {
  const qc = useQueryClient();
  const { data: status = "available" } = useQuery({
    queryKey: ["my-presence"],
    queryFn: getMyPresence,
    staleTime: 60_000,
  });
  const mut = useMutation({
    mutationFn: setMyPresence,
    onSuccess: (_d, status) => {
      qc.setQueryData(["my-presence"], status);
      qc.invalidateQueries({ queryKey: ["group-presence"] });
    },
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-hairline bg-card px-2 py-1 text-xs text-foreground transition hover:bg-secondary"
          aria-label="Modifier ma disponibilité"
        >
          <PresenceDot status={status} />
          <span>{OPTIONS.find((o) => o.value === status)?.label ?? "Disponible"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        <ul className="space-y-0.5">
          {OPTIONS.map((opt) => {
            const active = status === opt.value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => mut.mutate(opt.value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition",
                    active ? "bg-secondary" : "hover:bg-secondary",
                  )}
                >
                  <PresenceDot status={opt.value} />
                  <span className="flex-1">
                    <span className="block font-medium text-foreground">{opt.label}</span>
                    <span className="block text-[10px] text-muted-foreground">{opt.hint}</span>
                  </span>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}