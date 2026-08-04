import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, PhoneOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCall } from "@/hooks/CallContext";

export default function CallJoin() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { startCall } = useCall();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

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
      const groupName = (data as { group?: { name?: string } | null }).group?.name;
      startCall({
        callId: data.id,
        groupId: data.group_id,
        groupName,
        prefs: { micMuted: false, camOff: false, screenShare: false },
      });
      navigate(`/discussions/${data.group_id}`, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [callId, navigate, startCall]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      {error ? (
        <>
          <PhoneOff className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/discussions", { replace: true })}
            className="h-10 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-700"
          >
            Retour aux discussions
          </button>
        </>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Connexion à l'appel…</p>
        </>
      )}
    </div>
  );
}