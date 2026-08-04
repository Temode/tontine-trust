import { supabase } from "@/integrations/supabase/client";

export async function waivePenalty(contributionId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("waive_penalty", {
    _contribution_id: contributionId,
    _reason: reason ?? null,
  });
  if (error) throw error;
}

export async function adjustPenalty(
  contributionId: string,
  newAmount: number,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc("adjust_penalty", {
    _contribution_id: contributionId,
    _new_amount: newAmount,
    _reason: reason ?? null,
  });
  if (error) throw error;
}