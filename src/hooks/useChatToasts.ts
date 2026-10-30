import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Toasts in-app pour tout nouveau message reçu hors de la conversation active.
 */
export function useChatToasts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel("chat-toasts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages" },
        async (payload) => {
          const msg = payload.new as {
            id: string;
            group_id: string;
            author_user_id: string;
            body: string;
            attachment_type: string | null;
          };
          if (msg.author_user_id === user.id) return;
          if (pathRef.current === `/discussions/${msg.group_id}`) {
            // Conversation ouverte : on rafraîchit silencieusement.
            qc.invalidateQueries({ queryKey: ["chat", msg.group_id] });
            return;
          }
          // Hydrate avec nom de groupe + auteur
          const [{ data: g }, { data: a }] = await Promise.all([
            supabase.from("groups").select("name").eq("id", msg.group_id).maybeSingle(),
            supabase
              .from("profiles")
              .select("full_name")
              .eq("id", msg.author_user_id)
              .maybeSingle(),
          ]);
          const groupName = (g?.name as string | undefined) ?? "Tontine";
          const authorName =
            (a?.full_name as string | undefined)?.split(" ")[0] ?? "Membre";
          const preview = msg.attachment_type
            ? msg.attachment_type.startsWith("image/")
              ? "📷 Image"
              : "📄 Document"
            : (msg.body || "").trim().slice(0, 80);
          toast(groupName, {
            description: `${authorName} : ${preview}`,
            action: {
              label: "Voir",
              onClick: () => navigate(`/discussions/${msg.group_id}`),
            },
          });
          qc.invalidateQueries({ queryKey: ["conversations"] });
        },
      )
      .subscribe();
    return () => {
      ch.unsubscribe();
    };
  }, [user?.id, navigate, qc]);
}