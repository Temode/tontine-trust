import { supabase } from "@/integrations/supabase/client";

export interface RenewalStatus {
  cycle_id?: string;
  cycle_number?: number;
  open: boolean;
  expired?: boolean;
  deadline?: string | null;
  min_members?: number | null;
  eligible?: number;
  accepted?: number;
  declined?: number;
  pending?: number;
  my_vote?: boolean | null;
  is_organizer?: boolean;
  contribution_amount?: number;
  frequency?: string;
  projected_payout?: number;
  projected_turns?: number;
  previous_members?: number;
  previous_payout?: number;
  confirmed_names?: (string | null)[];
}

const ERRORS: Record<string, string> = {
  AUTH_REQUIRED: "Vous devez être connecté.",
  FORBIDDEN: "Action réservée à l'organisateur.",
  NO_CYCLE: "Aucun cycle trouvé pour ce groupe.",
  CYCLE_NOT_FINISHED: "Le cycle en cours n'est pas terminé.",
  RENEWAL_ALREADY_OPEN: "Une demande de relance est déjà en cours.",
  RENEWAL_NOT_OPEN: "Aucune demande de relance en cours.",
  RENEWAL_DEADLINE_PASSED: "Le délai de réponse est dépassé.",
  MIN_MEMBERS_TOO_LOW: "Le seuil doit être d'au moins 2 participants.",
  MIN_MEMBERS_TOO_HIGH: "Le seuil dépasse le nombre de membres du cycle précédent.",
  MIN_MEMBERS_NOT_REACHED: "Le seuil de participants n'est pas encore atteint.",
  DEADLINE_IN_PAST: "La date limite doit être dans le futur.",
  QUORUM_NOT_REACHED: "Il faut au moins 2 participants confirmés.",
  CONTRACT_NOT_SIGNED: "Tous les participants doivent avoir signé le contrat du groupe.",
};

function translate(message: string): Error {
  const key = Object.keys(ERRORS).find((k) => message.includes(k));
  return new Error(key ? ERRORS[key] : message);
}

export async function getRenewalStatus(groupId: string): Promise<RenewalStatus> {
  const { data, error } = await supabase.rpc("renewal_status", { _group_id: groupId });
  if (error) throw translate(error.message);
  return (data ?? { open: false }) as unknown as RenewalStatus;
}

export async function openCycleRenewal(
  groupId: string,
  minMembers: number,
  deadlineIso: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("open_cycle_renewal", {
    _group_id: groupId,
    _min_members: minMembers,
    _deadline: deadlineIso,
  });
  if (error) throw translate(error.message);
  return data as unknown as string;
}

export async function voteRenewal(cycleId: string, agreed: boolean): Promise<void> {
  const { error } = await supabase.rpc("vote_cycle_renewal", {
    _cycle_id: cycleId,
    _agreed: agreed,
  });
  if (error) throw translate(error.message);
}

export async function extendRenewal(
  cycleId: string,
  deadlineIso: string,
  minMembers?: number,
): Promise<void> {
  const { error } = await supabase.rpc("extend_cycle_renewal", {
    _cycle_id: cycleId,
    _deadline: deadlineIso,
    _min_members: minMembers ?? null,
  });
  if (error) throw translate(error.message);
}

export async function cancelRenewal(cycleId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_cycle_renewal", { _cycle_id: cycleId });
  if (error) throw translate(error.message);
}

export async function startRenewedCycle(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc("start_renewed_cycle", { _group_id: groupId });
  if (error) throw translate(error.message);
  return data as unknown as string;
}

export interface RenewalVoteRow {
  user_id: string;
  agreed: boolean;
  voted_at: string;
  full_name: string | null;
}

export async function listRenewalVoteDetails(cycleId: string): Promise<RenewalVoteRow[]> {
  const { data, error } = await supabase.rpc("list_renewal_votes", { _cycle_id: cycleId });
  if (error) throw translate(error.message);
  return (data ?? []) as unknown as RenewalVoteRow[];
}