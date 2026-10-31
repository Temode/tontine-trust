import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PaymentTracker } from "@/components/payment/PaymentTracker";
import { SectionCard } from "@/components/dashboard/SectionCard";

async function fetchInFlightPayments(userId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("id, status, initiated_at")
    .eq("user_id", userId)
    .in("status", ["initiated", "pending"])
    .order("initiated_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; status: string; initiated_at: string | null }>;
}

export function InFlightPaymentsCard({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["payments", "in-flight", userId],
    queryFn: () => fetchInFlightPayments(userId as string),
    enabled: !!userId,
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`payments-in-flight-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["payments", "in-flight", userId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  if (!userId || !q.data || q.data.length === 0) return null;

  return (
    <SectionCard
      title="Paiements en cours"
      subtitle={`${q.data.length} en attente de confirmation`}
      bare
    >
      <div className="space-y-2 px-5 py-4 lg:px-6">
        {q.data.map((p) => (
          <PaymentTracker key={p.id} paymentId={p.id} compact />
        ))}
      </div>
    </SectionCard>
  );
}
