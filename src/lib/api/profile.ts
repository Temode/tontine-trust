import { supabase } from "@/integrations/supabase/client";

export interface DbProfile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  avatar_url: string | null;
}

export async function getMyProfile(): Promise<DbProfile | null> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone_number, avatar_url")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as DbProfile | null;
}

export async function updateMyProfile(input: {
  full_name?: string | null;
  phone_number?: string | null;
}): Promise<DbProfile> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Non authentifié");
  const patch: { full_name?: string | null; phone_number?: string | null } = {};
  if (input.full_name !== undefined) patch.full_name = input.full_name?.trim() || null;
  if (input.phone_number !== undefined) patch.phone_number = input.phone_number?.trim() || null;
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", uid)
    .select("id, full_name, phone_number, avatar_url")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Profil introuvable");
  return data as DbProfile;
}

async function resizeImage(file: File, maxSize = 512): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const ratio = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * ratio);
  const h = Math.round(bmp.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.drawImage(bmp, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Conversion image impossible"))),
      "image/webp",
      0.88,
    );
  });
}

export async function uploadAvatar(file: File): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Non authentifié");
  if (file.size > 5 * 1024 * 1024) throw new Error("Fichier trop volumineux (max 5 Mo)");

  const blob = await resizeImage(file, 512);
  const path = `${uid}/avatar-${Date.now()}.webp`;
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { upsert: true, contentType: "image/webp", cacheControl: "3600" });
  if (upErr) throw upErr;

  // Le bucket "avatars" est privé (politique workspace) : on stocke une URL signée
  // longue durée (1 an) pour que <img src=...> fonctionne sans en-tête d'auth.
  const { data: signed, error: signErr } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr) throw signErr;
  const url = signed.signedUrl;

  const { error: updErr } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", uid);
  if (updErr) throw updErr;

  return url;
}

/**
 * Extrait le chemin d'objet à partir d'une URL Supabase Storage (publique ou signée).
 * Retourne null si l'URL ne pointe pas vers le bucket avatars ou n'est pas reconnue.
 */
export function extractAvatarPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:sign|public)\/avatars\/([^?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Régénère une URL signée (1 an) pour l'avatar de l'utilisateur courant à partir
 * de l'URL stockée, puis met à jour `profiles.avatar_url`. Utile pour les avatars
 * uploadés avant le passage aux URLs signées, ou dont le token a expiré.
 * Retourne la nouvelle URL, ou null si aucun avatar n'est connu.
 */
export async function refreshAvatarSignedUrl(): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Non authentifié");

  const profile = await getMyProfile();
  const path = extractAvatarPath(profile?.avatar_url);
  if (!path) return null;

  const { data: signed, error: signErr } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr) throw signErr;
  const url = signed.signedUrl;

  const { error: updErr } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", uid);
  if (updErr) throw updErr;
  return url;
}