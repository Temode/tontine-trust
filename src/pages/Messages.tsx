import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { GroupChat } from "@/components/group/GroupChat";
import { ConversationsList } from "@/components/messages/ConversationsList";
import { ConversationHeader } from "@/components/messages/ConversationHeader";
import {
  listConversationsForUser,
  markGroupRead,
  subscribeAllUserConversations,
} from "@/lib/api/chat";
import { cn } from "@/lib/utils";

export default function Messages() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: listConversationsForUser,
    refetchOnMount: true,
  });

  useEffect(() => {
    const ch = subscribeAllUserConversations(() => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    });
    return () => {
      ch.unsubscribe();
    };
  }, [qc]);

  const activeConv = useMemo(
    () => (groupId ? conversations.find((c) => c.group.id === groupId) ?? null : null),
    [conversations, groupId],
  );

  // Marquer comme lu à l'ouverture
  useEffect(() => {
    if (groupId) {
      markGroupRead(groupId)
        .then(() => qc.invalidateQueries({ queryKey: ["conversations"] }))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Si groupId invalide, retour à la liste
  useEffect(() => {
    if (!isLoading && groupId && !activeConv && conversations.length > 0) {
      navigate("/discussions", { replace: true });
    }
  }, [isLoading, groupId, activeConv, conversations.length, navigate]);

  return (
    <div className="h-[calc(100vh-5rem)] lg:h-[calc(100vh-0rem)]">
      <div className="flex h-full">
        {/* Liste */}
        <aside
          className={cn(
            "w-full border-r border-hairline bg-card lg:w-[360px] lg:shrink-0",
            groupId ? "hidden lg:flex lg:flex-col" : "flex flex-col",
          )}
        >
          <ConversationsList
            conversations={conversations}
            activeId={groupId ?? null}
            isLoading={isLoading}
          />
        </aside>

        {/* Conversation */}
        <section
          className={cn(
            "flex-1 flex-col bg-background",
            groupId ? "flex" : "hidden lg:flex",
          )}
        >
          {activeConv ? (
            <>
              <ConversationHeader group={activeConv.group} />
              <div className="flex-1 overflow-hidden p-3 lg:p-4">
                <div className="h-full">
                  <GroupChat groupId={activeConv.group.id} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                icon={MessageCircle}
                title="Sélectionnez une discussion"
                description="Choisissez une tontine à gauche pour discuter avec ses membres."
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}