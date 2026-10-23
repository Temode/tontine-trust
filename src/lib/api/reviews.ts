import { supabase } from "@/integrations/supabase/client";

export interface DbMemberReview {
  id: string;
  group_id: string;
  cycle_id: string;
  reviewer_user_id: string;
  reviewed_user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface DbReviewSummary {
  user_id: string;
  group_id: string;
  avg_rating: number;
  reviews_count: number;
}

export async function submitReview(args: {
  groupId: string;
  reviewedUserId: string;
  rating: number;
  comment?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("submit_review", {
    _group_id: args.groupId,
    _reviewed_user_id: args.reviewedUserId,
    _rating: args.rating,
    _comment: args.comment ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function listGroupReviews(groupId: string): Promise<DbMemberReview[]> {
  const { data, error } = await supabase
    .from("member_reviews")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbMemberReview[];
}

export async function listMyReviewsGivenForGroup(groupId: string): Promise<DbMemberReview[]> {
  const { data, error } = await supabase
    .from("my_reviews_given")
    .select("*")
    .eq("group_id", groupId);
  if (error) throw error;
  return (data ?? []) as DbMemberReview[];
}

export async function getGroupReviewSummary(groupId: string): Promise<DbReviewSummary[]> {
  const { data, error } = await supabase
    .from("member_review_summary")
    .select("*")
    .eq("group_id", groupId);
  if (error) throw error;
  return (data ?? []) as DbReviewSummary[];
}