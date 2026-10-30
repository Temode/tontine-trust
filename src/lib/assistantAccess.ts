/** Règle d'accès à l'assistant IA : abonnement Premium/Business actif uniquement. */
export function canUseAssistant(planCode: string, status: string): boolean {
  return planCode !== "free" && (status === "active" || status === "trialing");
}
