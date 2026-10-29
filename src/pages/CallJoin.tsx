import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2, PhoneOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCall } from "@/hooks/CallContext";
import { respondCallRequest } from "@/lib/api/calls";
import { Capacitor } from "@capacitor/core";
import { getMicState, incomingMicMuted } from "@/lib/micPermission";
import { createPortal } from "react-dom";
import { useRegisterCallPriority } from "@/lib/callPriority";
import { CallSurface } from "@/components/messages/CallSurface";

export default function CallJoin() {
  const { callId } = useParams<{ callId: string }>();
  const [search] = useSearchParams();
  const declining = search.get("action") === "decline";
  const navigate = useNavigate();
  const { startCall } = useCall();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  useRegisterCallPriority(!error, !error);

  useEffect(() => {
    if (!callId || startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;

    (async () => {
      const { data, error: dbError } = await supabase
        .from("call_requests")
        .select("id, group_id, status, group:groups!call_requests_group_id_fkey(name)")
        .eq("id", callId)
        .maybeSingle();
      if (cancelled) return;
      if (dbError || !data) {
        setError("Cet appel est introuvable ou vous n'y avez pas accès.");
        return;
      }
      if (["ended", "cancelled", "declined", "missed"].includes(data.status)) {
        setError("Cet appel est terminé.");
        return;
      }
      if (declining) {
        try { await respondCallRequest(data.id, "declined"); } catch { /* déjà traité */ }
        navigate(`/discussions/${data.group_id}`, { replace: true });
        return;
      }
      const groupName = (data as { group?: { name?: string } | null }).group?.name;
      startCall({
        callId: data.id,
        groupId: data.group_id,
        groupName,
        manageLifecycle: true,
        // Décrochage depuis une notification ou un lien profond : c'est un
        // appel audio. La vidéo ne s'allume que si l'utilisateur appuie sur
        // Vidéo dans le dock, et l'aiguillage bascule alors vers la grille.
        // Micro non accordé : on rejoint micro coupé, aucune boîte système
        // ne s'ouvre pendant un appel entrant.
        prefs: {
          micMuted: incomingMicMuted(Capacitor.isNativePlatform(), getMicState()),
          camOff: true,
          screenShare: false,
        },
      });
      navigate(`/discussions/${data.group_id}`, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [callId, declining, navigate, startCall]);

  if (!error) {
    // Même surface sombre que l'écran d'appel : aucune page ne transparaît
    // entre le décrochage et l'ouverture de la communication.
    return createPortal(
      <CallSurface>
      <div className="call-surface fixed inset-0 z-call flex flex-col items-center justify-center gap-3 px-4 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-300" />
        <p className="text-body-sm text-primary-foreground/80">
          {declining ? "Refus de l'appel…" : "Connexion à l'appel…"}
        </p>
      </div>
      </CallSurface>, document.body
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <PhoneOff className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-semibold text-foreground">{error}</p>
      <button
        type="button"
        onClick={() => navigate("/discussions", { replace: true })}
        className="h-10 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-700"
      >
        Retour aux discussions
      </button>
    </div>
  );
}
