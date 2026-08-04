import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pin, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  togglePinAnnouncement,
} from "@/lib/api/announcements";

interface Props {
  groupId: string;
  isOrganizer: boolean;
}

export function AnnouncementsPanel({ groupId, isOrganizer }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["announcements", groupId],
    queryFn: () => listAnnouncements(groupId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["announcements", groupId] });

  const createM = useMutation({
    mutationFn: () => createAnnouncement(groupId, title, body, pinned),
    onSuccess: () => {
      toast.success("Annonce publiée");
      setTitle(""); setBody(""); setPinned(false); setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error("Publication impossible", { description: e.message }),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => { toast.success("Annonce supprimée"); invalidate(); },
    onError: (e: Error) => toast.error("Suppression impossible", { description: e.message }),
  });
  const pinM = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => togglePinAnnouncement(id, pinned),
    onSuccess: invalidate,
  });

  if (items.length === 0 && !isOrganizer) return null;

  return (
    <section className="mt-5 rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-accent-700" />
          <h2 className="font-display text-sm font-bold text-foreground">Annonces</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground num">
            {items.length}
          </span>
        </div>
        {isOrganizer && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-accent-600 px-2.5 text-xs font-semibold text-accent-foreground transition hover:bg-accent-700"
          >
            {open ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {open ? "Annuler" : "Nouvelle"}
          </button>
        )}
      </header>

      {open && isOrganizer && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (title.trim() && body.trim()) createM.mutate(); }}
          className="space-y-2 border-b border-hairline bg-secondary/40 px-5 py-3"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de l'annonce"
            maxLength={120}
            className="w-full rounded-md border border-hairline bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message destiné à tous les membres…"
            maxLength={2000}
            rows={3}
            className="w-full rounded-md border border-hairline bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              Épingler en haut
            </label>
            <button
              type="submit"
              disabled={createM.isPending || !title.trim() || !body.trim()}
              className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {createM.isPending ? "Publication…" : "Publier"}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="px-5 py-4 text-xs text-muted-foreground">Aucune annonce pour l'instant.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((a) => (
            <li
              key={a.id}
              className={cn(
                "px-5 py-3",
                a.pinned && "bg-accent-50/40",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {a.pinned && <Pin className="h-3 w-3 text-accent-700" />}
                    <h3 className="truncate text-sm font-semibold text-foreground">{a.title}</h3>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {a.author?.full_name ?? "Organisateur"} ·{" "}
                    {new Date(a.created_at).toLocaleString("fr-FR", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                {isOrganizer && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => pinM.mutate({ id: a.id, pinned: !a.pinned })}
                      className="rounded-md border border-hairline p-1.5 text-muted-foreground transition hover:text-foreground"
                      aria-label={a.pinned ? "Désépingler" : "Épingler"}
                    >
                      <Pin className={cn("h-3.5 w-3.5", a.pinned && "text-accent-700")} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (confirm("Supprimer cette annonce ?")) deleteM.mutate(a.id); }}
                      className="rounded-md border border-hairline p-1.5 text-muted-foreground transition hover:text-destructive"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}