/**
 * Implémentation TypeScript de référence — miroir 1:1 de la fonction
 * SQL `public.compute_hold_until(turn_id uuid)` introduite au Chantier 4.
 */

export type Frequency = "quotidienne" | "hebdomadaire" | "quinzaine" | "mensuelle";

export interface HoldConfig {
  standard_days: number;
  penalty_extra_days: number;
}

export const DEFAULT_HOLD_CONFIG: Record<Frequency, HoldConfig> = {
  quotidienne: { standard_days: 0, penalty_extra_days: 7 },
  hebdomadaire: { standard_days: 7, penalty_extra_days: 7 },
  quinzaine: { standard_days: 7, penalty_extra_days: 7 },
  mensuelle: { standard_days: 7, penalty_extra_days: 7 },
};

const DAY_MS = 86_400_000;

export interface ComputeHoldInput {
  frequency: Frequency;
  paid_at: Date | null;
  was_late_in_cycle: boolean;
  now?: Date;
  config?: Partial<Record<Frequency, HoldConfig>>;
}

export function computeHoldUntil(input: ComputeHoldInput): Date {
  const merged = { ...DEFAULT_HOLD_CONFIG, ...(input.config ?? {}) };
  const cfg = merged[input.frequency] ?? { standard_days: 7, penalty_extra_days: 7 };
  const base = (input.paid_at ?? input.now ?? new Date()).getTime();
  const extra = input.was_late_in_cycle ? cfg.penalty_extra_days : 0;
  return new Date(base + (cfg.standard_days + extra) * DAY_MS);
}