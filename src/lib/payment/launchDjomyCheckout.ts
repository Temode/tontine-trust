import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface InitPaymentResponse {
  paymentId: string;
  transactionId: string;
  redirectUrl: string;
}

/**
 * Démarre un paiement Djomy et redirige immédiatement vers le portail Djomy
 * (Orange Money / MTN MoMo / Visa - le payeur choisit sur place).
 *
 * Pas de modale intermédiaire : un clic = une redirection.
 */
export async function launchDjomyCheckout(contributionId: string): Promise<void> {
  // Récupère le numéro du payeur (utilisé en pré-remplissage côté Djomy ; optionnel).
  let payerPhone: string | null = null;
  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("phone_number")
      .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .maybeSingle();
    payerPhone = (prof?.phone_number ?? null) as string | null;
  } catch {
    /* profil optionnel */
  }

  const base =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? window.location.origin
      : ((import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/$/, "") ??
        "https://tontine-digitale.lovable.app");

  const t = toast.loading("Redirection vers Djomy…");
  try {
    const { data, error } = await supabase.functions.invoke<InitPaymentResponse | { error: string }>(
      "djomy-init-payment",
      {
        body: {
          contributionId,
          payerPhone: payerPhone ?? "00224000000000",
          returnUrl: `${base}/payment/return`,
          cancelUrl: `${base}/payment/cancel`,
        },
      },
    );
    if (error) throw new Error(error.message ?? "DJOMY_INIT_FAILED");
    if (!data || "error" in data) throw new Error((data as { error?: string })?.error ?? "DJOMY_INIT_FAILED");

    try {
      sessionStorage.setItem("lastDjomyPaymentId", data.paymentId);
    } catch {
      /* sessionStorage indisponible (Safari privé, etc.) — ignore */
    }
    toast.dismiss(t);
    window.location.assign(data.redirectUrl);
  } catch (e) {
    toast.dismiss(t);
    const raw = (e as Error).message ?? "Erreur inconnue";
    const friendly =
      raw.includes("GROUP_PAUSED")
        ? "Ce groupe est en pause : les paiements sont suspendus jusqu'à la reprise du cycle."
        : raw.includes("GROUP_ARCHIVED")
        ? "Ce groupe est archivé : les paiements ne sont plus acceptés."
        : raw.includes("GROUP_DELETED")
        ? "Ce groupe a été supprimé."
        : raw.includes("GROUP_NOT_ACTIVE")
        ? "Le cycle de ce groupe est terminé : aucun nouveau paiement n'est accepté."
        : raw.includes("ALREADY_PAID")
        ? "Cette cotisation est déjà confirmée."
        : raw;
    toast.error("Paiement impossible", { description: friendly, duration: 8000 });
  }
}