import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star } from "lucide-react";
import {
  submitReview,
  listGroupReviews,
  listMyReviewsGivenForGroup,
  getGroupReviewSummary,
} from "@/lib/api/reviews";
import { listGroupMembers } from "@/lib/api/members";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ReviewsPanel({
  groupId,
  currentUserId,
}: {
  groupId: string;
  currentUserId: string | null;
}) {
  const qc = useQueryClient();

  const membersQ = useQuery({
    queryKey: ["group", groupId, "members"],
    queryFn: () => listGroupMembers(groupId),
  });
  const givenQ = useQuery({
    queryKey: ["group", groupId, "reviews-given"],
    queryFn: () => listMyReviewsGivenForGroup(groupId),
  });
  const reviewsQ = useQuery({
    queryKey: ["group", groupId, "reviews"],
    queryFn: () => listGroupReviews(groupId),
  });
  const summaryQ = useQuery({
    queryKey: ["group", groupId, "review-summary"],
    queryFn: () => getGroupReviewSummary(groupId),
  });

  const givenIds = useMemo(
    () => new Set((givenQ.data ?? []).map((r) => r.reviewed_user_id)),
    [givenQ.data],
  );

  const otherMembers = useMemo(
    () =>
      (membersQ.data ?? []).filter(
        (m) => m.status === "active" && m.user_id !== currentUserId,
      ),
    [membersQ.data, currentUserId],
  );

  const summaryByUser = useMemo(() => {
    const m = new Map<string, { avg: number; count: number }>();
    for (const s of summaryQ.data ?? []) {
      m.set(s.user_id, { avg: s.avg_rating, count: s.reviews_count });
    }
    return m;
  }, [summaryQ.data]);

  return (
    <div className="space-y-4">
      <SectionCard
        title="Donner mon avis"
        subtitle="Évaluez le sérieux et l'engagement des autres membres pour ce cycle."
      >
        {otherMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun membre à évaluer.</p>
        ) : (
          <ul className="space-y-3">
            {otherMembers.map((m) => {
              const already = givenIds.has(m.user_id);
              const summary = summaryByUser.get(m.user_id);
              return (
                <li
                  key={m.user_id}
                  className="rounded-lg border border-hairline p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700">
                        {getInitials(m.profile?.full_name ?? "··")}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {m.profile?.full_name ?? "Membre"}
                        </p>
                        {summary && (
                          <p className="text-xs text-muted-foreground">
                            ★ {summary.avg.toFixed(1)} ({summary.count} avis)
                          </p>
                        )}
                      </div>
                    </div>
                    {already && (
                      <span className="text-xs font-medium text-success">Avis envoyé</span>
                    )}
                  </div>
                  {!already && (
                    <ReviewForm
                      onSubmit={async (rating, comment) => {
                        try {
                          await submitReview({
                            groupId,
                            reviewedUserId: m.user_id,
                            rating,
                            comment,
                          });
                          toast.success("Avis enregistré");
                          qc.invalidateQueries({ queryKey: ["group", groupId, "reviews-given"] });
                          qc.invalidateQueries({ queryKey: ["group", groupId, "reviews"] });
                          qc.invalidateQueries({ queryKey: ["group", groupId, "review-summary"] });
                        } catch (e) {
                          toast.error("Avis refusé", { description: (e as Error).message });
                        }
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Avis dans ce groupe"
        subtitle="Affichés sans le nom des auteurs."
      >
        {(reviewsQ.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun avis pour l'instant.</p>
        ) : (
          <ul className="space-y-2">
            {(reviewsQ.data ?? []).map((r) => (
              <li key={r.id} className="rounded-md border border-hairline p-3">
                <div className="flex items-center gap-2">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
                {r.comment && (
                  <p className="mt-1.5 text-sm text-foreground">{r.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function Stars({ rating, onChange }: { rating: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={cn(
            "transition",
            onChange ? "cursor-pointer hover:scale-110" : "cursor-default",
          )}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              "h-4 w-4",
              n <= rating ? "fill-accent-500 text-accent-500" : "text-muted-foreground",
            )}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewForm({
  onSubmit,
}: {
  onSubmit: (rating: number, comment?: string) => void | Promise<void>;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (rating < 1) {
          toast.error("Choisissez une note de 1 à 5 étoiles");
          return;
        }
        setSending(true);
        await onSubmit(rating, comment.trim() || undefined);
        setSending(false);
        setRating(0);
        setComment("");
      }}
      className="mt-3 space-y-2"
    >
      <Stars rating={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Commentaire (optionnel)…"
        className="w-full rounded-md border border-hairline bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <button
        type="submit"
        disabled={sending}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-60"
      >
        Envoyer l'avis
      </button>
    </form>
  );
}