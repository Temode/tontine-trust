import { supabase } from "@/integrations/supabase/client";

export interface GroupTerms {
  version: string;
  content: string;
  published_at: string;
  accepted_at: string | null;
  accepted: boolean;
}

/** Conditions générales en vigueur + état d'acceptation de l'utilisateur pour ce groupe. */
export async function getGroupTerms(groupId: string): Promise<GroupTerms> {
  const { data, error } = await supabase.rpc("get_group_terms", { _group_id: groupId });
  if (error) throw error;
  return data as unknown as GroupTerms;
}

/** Enregistre l'acceptation des conditions (horodatée, versionnée). */
export async function acceptGroupTerms(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_group_terms", { _group_id: groupId });
  if (error) throw error;
  return data as unknown as string;
}
