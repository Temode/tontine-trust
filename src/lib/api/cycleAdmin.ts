import { supabase } from "@/integrations/supabase/client";

export async function pauseCycle(groupId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("pause_cycle", { _group_id: groupId, _reason: reason ?? null });
  if (error) throw error;
}

export async function resumeCycle(groupId: string): Promise<number> {
  const { data, error } = await supabase.rpc("resume_cycle", { _group_id: groupId });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function shiftDueDate(turnId: string, newDate: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("shift_due_date", {
    _turn_id: turnId,
    _new_date: newDate,
    _reason: reason ?? null,
  });
  if (error) throw error;
}

export async function archiveGroup(groupId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("archive_group", { _group_id: groupId, _reason: reason ?? null });
  if (error) throw error;
}