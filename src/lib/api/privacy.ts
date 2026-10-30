import { supabase } from "@/integrations/supabase/client";

export async function updatePhoneVisibility(visible: boolean): Promise<void> {
  const { error } = await supabase.rpc("update_phone_visibility", { _visible: visible });
  if (error) throw error;
}

export interface MyPrivacy {
  phone_visible_in_groups: boolean;
}

export async function getMyPrivacy(): Promise<MyPrivacy> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("AUTH_REQUIRED");
  const { data, error } = await supabase
    .from("profiles")
    .select("phone_visible_in_groups")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  return { phone_visible_in_groups: !!data?.phone_visible_in_groups };
}

const DELETE_ERROR_LABELS: Record<string, string> = {
  AUTH_REQUIRED: "Vous devez être connecté.",
  OWNS_ACTIVE_GROUPS:
    "Vous êtes encore propriétaire d'un ou plusieurs groupes actifs. Transférez ou archivez-les d'abord.",
  INVALID_TOKEN: "Session invalide. Reconnectez-vous.",
};

export async function deleteMyAccount(reason?: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { reason: reason ?? null },
  });
  if (error) {
    const msg = (error as Error).message ?? "";
    const key = Object.keys(DELETE_ERROR_LABELS).find((k) => msg.includes(k));
    throw new Error(key ? DELETE_ERROR_LABELS[key] : msg || "Suppression impossible.");
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    const err = (data as { error: string }).error;
    const key = Object.keys(DELETE_ERROR_LABELS).find((k) => err.includes(k));
    throw new Error(key ? DELETE_ERROR_LABELS[key] : err);
  }
}

export const CURRENT_TERMS_VERSION = "v1.0";