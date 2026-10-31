import { supabase } from "@/integrations/supabase/client";

export type BidStatus = "active" | "won" | "lost" | "cancelled";

export interface DbTurnBid {
  id: string;
  group_id: string;
  turn_id: string;
  cycle_id: string;
  bidder_user_id: string;
  bidder_name: string | null;
  amount: number;
  status: BidStatus;
  created_at: string;
  updated_at: string;
  turn_number: number;
  due_date: string;
}

export async function listGroupBids(groupId: string): Promise<DbTurnBid[]> {
  const { data, error } = await supabase
    .from("turn_bids_view")
    .select("*")
    .eq("group_id", groupId)
    .order("amount", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbTurnBid[];
}

export async function placeBid(turnId: string, amount: number): Promise<string> {
  const { data, error } = await supabase.rpc("place_bid", {
    _turn_id: turnId,
    _amount: amount,
  });
  if (error) throw error;
  return data as string;
}

export async function cancelMyBid(turnId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_my_bid", { _turn_id: turnId });
  if (error) throw error;
}

export async function closeAuction(turnId: string): Promise<string> {
  const { data, error } = await supabase.rpc("close_auction", { _turn_id: turnId });
  if (error) throw error;
  return data as string;
}

export function subscribeGroupBids(groupId: string, onChange: () => void) {
  const channel = supabase
    .channel(`turn-bids-${groupId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "turn_bids", filter: `group_id=eq.${groupId}` },
      onChange,
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}