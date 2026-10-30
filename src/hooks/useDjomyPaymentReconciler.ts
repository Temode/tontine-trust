import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getDjomyPaymentStatus } from "@/lib/api/djomy";

const PASS_THROTTLE_MS = 4_000;
const TX_DEDUPE_MS = 10_000;
const MAX_PARALLEL = 5;

const lastPassAt = new Map<string, number>(); // key: userId
const lastTxAt = new Map<string, number>(); // key: transactionId

type ReconRow = {
  id: string;
  djomy_transaction_id: string | null;
  status: string;
  initiated_at: string | null;
};

function invalidatePaymentQueries(qc: QueryClient) {
  ["contributions", "payments", "dashboard", "turns", "receipts", "payments-history"].forEach(
    (key) => qc.invalidateQueries({ queryKey: [key] }),
  );
}

/**
 * Force une passe de réconciliation Djomy. Renvoie le nombre de paiements
 * dont le statut a été remis à jour (utile pour un toast manuel).
 */
export async function reconcileDjomyPayments(
  userId: string,
  options: { force?: boolean } = {},
): Promise<{ checked: number; updated: number }> {
  const now = Date.now();
  const last = lastPassAt.get(userId) ?? 0;
  if (!options.force && now - last < PASS_THROTTLE_MS) {
    return { checked: 0, updated: 0 };
  }
  lastPassAt.set(userId, now);

  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("payments")
    .select("id, djomy_transaction_id, status, initiated_at")
    .eq("user_id", userId)
    .in("status", ["initiated", "pending"])
    .not("djomy_transaction_id", "is", null)
    .gte("initiated_at", since)
    .order("initiated_at", { ascending: false })
    .limit(20);
  if (error) {
    console.warn("[djomy-reconcile] list payments failed", error);
    return { checked: 0, updated: 0 };
  }

  const rows = (data ?? []) as ReconRow[];
  if (rows.length === 0) return { checked: 0, updated: 0 };

  let updated = 0;
  // Process in batches of MAX_PARALLEL
  for (let i = 0; i < rows.length; i += MAX_PARALLEL) {
    const batch = rows.slice(i, i + MAX_PARALLEL);
    const results = await Promise.all(
      batch.map(async (row) => {
        const tx = row.djomy_transaction_id;
        if (!tx) return null;
        const lastTx = lastTxAt.get(tx) ?? 0;
        if (!options.force && Date.now() - lastTx < TX_DEDUPE_MS) return null;
        lastTxAt.set(tx, Date.now());
        try {
          const res = await getDjomyPaymentStatus(tx);
          return res.status !== row.status ? res : null;
        } catch (e) {
          console.warn("[djomy-reconcile] status check failed", tx, e);
          return null;
        }
      }),
    );
    updated += results.filter(Boolean).length;
  }
  return { checked: rows.length, updated };
}

/**
 * Hook global : déclenche une passe de réconciliation Djomy au montage,
 * sur visibilitychange/focus/online, et abonne l'utilisateur aux UPDATE
 * de ses paiements pour invalider les caches React Query en temps réel.
 * À monter une seule fois dans AppShell.
 */
export function useDjomyPaymentReconciler() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const lastStatusRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    let cancelled = false;

    const runPass = (force = false) => {
      if (cancelled) return;
      void reconcileDjomyPayments(userId, { force }).then((res) => {
        if (res.updated > 0) invalidatePaymentQueries(qc);
      });
    };

    // Première passe immédiate
    runPass(true);

    const onVisibility = () => {
      if (document.visibilityState === "visible") runPass();
    };
    const onFocus = () => runPass();
    const onOnline = () => runPass(true);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    // Realtime : tout UPDATE sur payments du user → invalidation + toast
    const suffix =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const channel = supabase
      .channel(`djomy-recon:${userId}:${suffix}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payments",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; status: string } | null;
          if (!row) return;
          const previous =
            lastStatusRef.current.get(row.id) ??
            (payload.old as { status?: string } | null)?.status ??
            null;
          lastStatusRef.current.set(row.id, row.status);
          invalidatePaymentQueries(qc);
          if (
            row.status === "succeeded" &&
            (previous === "pending" || previous === "initiated" || previous === null)
          ) {
            toast.success("✓ Paiement confirmé", {
              description: "Votre cotisation est à jour.",
            });
          } else if (row.status === "failed" && previous !== "failed") {
            toast.error("Paiement échoué", {
              description: "Réessayez ou contactez le support.",
            });
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);
}