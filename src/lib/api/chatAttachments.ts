import { supabase } from "@/integrations/supabase/client";

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
];

export interface UploadedAttachment {
  path: string;
  url: string;
  type: string;
  name: string;
  size: number;
}

export async function uploadChatAttachment(
  groupId: string,
  file: File,
): Promise<UploadedAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Fichier trop volumineux (max 8 Mo)");
  }
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
    throw new Error("Format non autorisé (image ou PDF)");
  }
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Non authentifié");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `${groupId}/${uid}/${uuid}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("chat-attachments")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;
  return {
    path,
    url: path, // store path; signed URL is fetched on display
    type: file.type,
    name: file.name,
    size: file.size,
  };
}

export async function getAttachmentSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from("chat-attachments")
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}