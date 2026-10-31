import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

export function PushToggle() {
  const qc = useQueryClient();
  const { data: enabled = true } = useQuery({
    queryKey: ["push-enabled"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_push_enabled" as never);
      if (error) throw error;
      return data as unknown as boolean;
    },
  });
  const m = useMutation({
    mutationFn: async (v: boolean) => {
      const { error } = await supabase.rpc("set_push_enabled" as never, { _enabled: v } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["push-enabled"] }),
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-hairline bg-card p-4">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">Notifications push</p>
          <p className="text-xs text-muted-foreground">
            Alertes sur votre téléphone, même quand l'application mobile est fermée.
          </p>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={(v) => m.mutate(v)} aria-label="Notifications push" />
    </div>
  );
}
