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