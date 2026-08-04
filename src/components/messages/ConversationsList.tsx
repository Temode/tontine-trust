import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageCircle } from "lucide-react";
import { ConversationItem } from "./ConversationItem";
import type { ChatConversation } from "@/lib/api/chat";

type Filter = "all" | "unread" | "active";

interface Props {
  conversations: ChatConversation[];
  activeId: string | null;
  isLoading: boolean;
}

export function ConversationsList({ conversations, activeId, isLoading }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (query && !c.group.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (filter === "unread" && c.unreadCount === 0) return false;
      if (filter === "active" && c.group.status !== "active") return false;
      return true;
    });
  }, [conversations, query, filter]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-hairline px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
              Discussions
            </h1>
            <p className="text-xs text-muted-foreground">
              {conversations.length} tontine{conversations.length > 1 ? "s" : ""}
            </p>
          </div>
          <Link
            to="/nouveau"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-primary transition hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Nouveau
          </Link>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une tontine…"
            className="h-9 w-full rounded-md border border-hairline bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="mt-3 flex gap-1.5">
          {([
            { id: "all", label: "Toutes" },
            { id: "unread", label: "Non lues" },
            { id: "active", label: "Actives" },
          ] as { id: Filter; label: string }[]).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setFilter(p.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition",
                filter === p.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-11 w-11 animate-pulse rounded-full bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-secondary" />
                  <div className="h-2.5 w-4/5 animate-pulse rounded bg-secondary" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!isLoading && filtered.length === 0 && conversations.length === 0 && (
          <EmptyState
            icon={MessageCircle}
            title="Aucune discussion"
            description="Rejoignez ou créez une tontine pour échanger avec vos cercles."
          />
        )}
        {!isLoading && filtered.length === 0 && conversations.length > 0 && (
          <p className="px-5 py-8 text-center text-xs text-muted-foreground">
            Aucun résultat
          </p>
        )}
        <ul>
          {filtered.map((c) => (
            <li key={c.group.id}>
              <ConversationItem conversation={c} active={c.group.id === activeId} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}