import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/TopBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Switch } from "@/components/ui/switch";
import { KIND_LABEL, type NotificationKind } from "@/lib/api/notifications";
import {
  CHANNEL_HINT,
  CHANNEL_LABEL,
  listMyNotificationPreferences,
  updateNotificationPreferences,
  type NotificationChannel,
  type NotificationPreference,
} from "@/lib/api/notificationPreferences";

const CHANNELS: NotificationChannel[] = ["in_app", "email", "sms"];

// Ordre d'affichage des types (les plus importants d'abord)
const ORDERED_KINDS: NotificationKind[] = [
  "contribution_due",
  "contribution_confirmed",
  "contribution_received",
  "payout_released",
  "receipt_ready",
  "turn_started",
  "turn_paid",
  "cycle_started",
  "group_completed",
  "cycle_completed" as NotificationKind,
  "invitation_received",
  "invitation_accepted",
  "member_joined",
  "reliability_changed",
  "announcement",
  "system",
];

type Matrix = Record<string, boolean>;

const key = (t: NotificationKind, c: NotificationChannel) => `${t}::${c}`;

export default function NotificationPreferences() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: listMyNotificationPreferences,
  });

  const [matrix, setMatrix] = useState<Matrix>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    const next: Matrix = {};
    data.forEach((p) => {
      next[key(p.notif_type, p.channel)] = p.enabled;
    });
    setMatrix(next);
    setDirty(false);
  }, [data]);

  const kinds = useMemo(() => {
    const seen = new Set<string>();
    const list: NotificationKind[] = [];
    ORDERED_KINDS.forEach((k) => {
      if (!seen.has(k)) {
        list.push(k);
        seen.add(k);
      }
    });
    // ajoute d'éventuels types renvoyés mais non listés
    data?.forEach((p) => {
      if (!seen.has(p.notif_type)) {
        list.push(p.notif_type);
        seen.add(p.notif_type);
      }
    });
    return list;
  }, [data]);

  const saveM = useMutation({
    mutationFn: () => {
      const payload: NotificationPreference[] = [];
      kinds.forEach((t) =>
        CHANNELS.forEach((c) => {
          payload.push({ notif_type: t, channel: c, enabled: !!matrix[key(t, c)] });
        }),
      );
      return updateNotificationPreferences(payload);
    },
    onSuccess: () => {
      toast.success("Préférences enregistrées");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
    onError: (e: Error) => toast.error("Échec de l'enregistrement", { description: e.message }),
  });

  const toggle = (t: NotificationKind, c: NotificationChannel) => {
    setMatrix((m) => ({ ...m, [key(t, c)]: !m[key(t, c)] }));
    setDirty(true);
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Préférences de notification"
        subtitle="Choisissez les canaux pour chaque type d'événement."
      />
      <div className="space-y-5 px-5 py-6 lg:px-8 lg:py-8">
        <SectionCard
          title="Canaux"
          subtitle={CHANNELS.map((c) => CHANNEL_LABEL[c]).join(" · ")}
          bare
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {kinds.map((t) => (
                <li key={t} className="px-5 py-4 lg:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-foreground">{KIND_LABEL[t] ?? t}</p>
                    <div className="flex items-center gap-5">
                      {CHANNELS.map((c) => (
                        <label
                          key={c}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                          title={CHANNEL_HINT[c]}
                        >
                          <span className="uppercase tracking-wide">{CHANNEL_LABEL[c]}</span>
                          <Switch
                            checked={!!matrix[key(t, c)]}
                            onCheckedChange={() => toggle(t, c)}
                            aria-label={`${KIND_LABEL[t] ?? t} via ${CHANNEL_LABEL[c]}`}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-hairline bg-card p-4">
          <p className="text-xs text-muted-foreground">
            Le canal SMS sera activable dès le branchement des paiements mobiles (Orange / MTN Money).
          </p>
          <button
            type="button"
            disabled={!dirty || saveM.isPending}
            onClick={() => saveM.mutate()}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {saveM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}