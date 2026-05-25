import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qinagmsvcvkoihdthmlx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_F_YkKdJWmlPZc5pZ2Xy1bQ_M6m3U4b1";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: localStorage,
  },
});

export type AppRole = "admin" | "organisateur" | "participant";