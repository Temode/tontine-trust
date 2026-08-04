import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { invokeAuthOtp, mapAuthOtpError } from "@/lib/authOtp";

export type AppRole = Database["public"]["Enums"]["app_role"];
import { setAuthSnapshot } from "@/lib/diagnostics/crashLogger";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  rolesLoading: boolean;
  // `requiresVerification` cible les comptes legacy (créés avant l'OTP obligatoire) :
  // credentials corrects mais `otp_verified !== true` → redirection vers /auth/verifier-email.
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; requiresVerification?: boolean; email?: string }>;
  signUp: (args: {
    email: string;
    password: string;
    fullName: string;
    phoneNumber?: string;
  }) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Email ou mot de passe incorrect.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Cet email est déjà utilisé. Connecte-toi.";
  if (m.includes("weak password") || m.includes("password should"))
    return "Mot de passe trop faible (au moins 8 caractères).";
  if (m.includes("email address") && m.includes("invalid")) return "Email invalide.";
  if (m.includes("over_email_send_rate_limit") || m.includes("email rate limit"))
    return "Trop d'emails envoyés. Patiente quelques minutes ou désactive la confirmation email dans Supabase pour tester.";
  if (m.includes("rate limit")) return "Trop de tentatives. Réessaie dans un instant.";
  if (m.includes("database error saving new user"))
    return "Erreur DB : la migration SQL (profiles/user_roles/trigger) n'a probablement pas été exécutée dans Supabase.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "Les inscriptions sont désactivées dans la config Supabase.";
  if (m.includes("email not confirmed"))
    return "Email non confirmé. Vérifie ta boîte mail.";
  if ([
    "invalid_action",
    "invalid_email",
    "invalid_payload",
    "weak_password",
    "email_exists",
    "rate_limited",
    "email_send_failed",
    "email_not_configured",
    "server_error",
  ].includes(m)) return mapAuthOtpError(m);
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  // Démarre à true : tant qu'on n'a pas confirmé l'absence de session OU chargé les rôles,
  // on ne laisse aucun garde décider d'une redirection.
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let lastUserId: string | null = null;

    const loadRoles = (uid: string) => {
      setRolesLoading(true);
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .then(({ data, error }) => {
          if (!mounted) return;
          if (error) {
            console.error("[useAuth] loadRoles error", error);
            setRoles([]);
            setAuthSnapshot({ userId: uid, roles: [] });
          } else {
            const next = (data ?? []).map((r: { role: AppRole }) => r.role);
            setRoles(next);
            setAuthSnapshot({ userId: uid, roles: next });
          }
          setRolesLoading(false);
        });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      // Garde-fou : refuse toute session dont l'OTP n'a pas été validé,
      // même si un chemin natif Supabase parvenait à établir un session token.
      const otpVerified = newSession?.user?.user_metadata?.otp_verified;
      if (newSession && otpVerified !== true) {
        console.warn("[useAuth] session refusée : OTP non validé");
        supabase.auth.signOut().catch(() => undefined);
        setSession(null);
        setUser(null);
        setRoles([]);
        setRolesLoading(false);
        setLoading(false);
        lastUserId = null;
        return;
      }
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      const uid = newSession?.user?.id ?? null;
      setAuthSnapshot({ userId: uid, roles: [] });
      if (uid && uid !== lastUserId) {
        lastUserId = uid;
        // On marque rolesLoading immédiatement pour qu'aucun garde ne décide
        // pendant la fenêtre où loadRoles n'est pas encore parti (setTimeout 0).
        setRolesLoading(true);
        setTimeout(() => loadRoles(uid), 0);
        // M8: enregistre le parrainage capturé sur la landing (?ref=CODE), si présent.
        try {
          const code = localStorage.getItem("pending_referral_code");
          if (code) {
            void (async () => {
              try {
                await supabase.rpc("register_referral", { _code: code });
              } catch { /* ignore */ }
              localStorage.removeItem("pending_referral_code");
            })();
          }
        } catch { /* localStorage unavailable */ }
      } else if (!uid) {
        lastUserId = null;
        setRoles([]);
        setRolesLoading(false);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (msg.includes("refresh token")) {
            // Session locale invalide : on nettoie pour revenir à /auth proprement.
            supabase.auth.signOut().catch(() => undefined);
          }
          setSession(null);
          setUser(null);
          setLoading(false);
          setRolesLoading(false);
          return;
        }
        setSession(data.session);
        const initialOtpVerified = data.session?.user?.user_metadata?.otp_verified;
        if (data.session && initialOtpVerified !== true) {
          console.warn("[useAuth] session initiale refusée : OTP non validé");
          supabase.auth.signOut().catch(() => undefined);
          setSession(null);
          setUser(null);
          setRoles([]);
          setRolesLoading(false);
          setLoading(false);
          return;
        }
        setUser(data.session?.user ?? null);
        const uid = data.session?.user?.id ?? null;
        if (uid && uid !== lastUserId) {
          lastUserId = uid;
          loadRoles(uid);
        } else if (!uid) {
          setRolesLoading(false);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setLoading(false);
        setRolesLoading(false);
      });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: mapAuthError(error.message) };
    const verified = data.user?.user_metadata?.otp_verified;
    if (verified !== true) {
      await supabase.auth.signOut();
      return { error: null, requiresVerification: true, email: data.user?.email ?? email };
    }
    return { error: null };
  };

  const signUp: AuthContextValue["signUp"] = async ({ email, password, fullName, phoneNumber }) => {
    const { error } = await invokeAuthOtp({
      action: "signup_start",
      email,
      password,
      fullName,
      phoneNumber: phoneNumber ?? null,
    });
    if (error) return { error: mapAuthError(error), needsEmailConfirmation: false };
    return { error: null, needsEmailConfirmation: true };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
  };

  return (
    <AuthContext.Provider value={{ user, session, roles, loading, rolesLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useHasRole(...roles: AppRole[]) {
  const { roles: userRoles } = useAuth();
  return roles.some((r) => userRoles.includes(r));
}