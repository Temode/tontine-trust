import { Link } from "react-router-dom";
import { type ReactNode } from "react";

interface AuthShellProps {
  children: ReactNode;
  leftTitle?: string;
  leftSubtitle?: string;
  kpis?: Array<{ value: string; label: string }>;
}

const DEFAULT_KPIS = [
  { value: "12 000+", label: "Cotisations sécurisées" },
  { value: "99,9%", label: "Disponibilité" },
];

/**
 * Coquille partagée par toutes les pages /auth.
 * Direction "Infrastructure Calme" — split 5/12 · 7/12, teal + or, hairlines.
 */
export function AuthShell({
  children,
  leftTitle = "L'infrastructure de confiance pour l'épargne collective.",
  leftSubtitle = "Rejoignez des milliers de groupes qui gèrent leur tontine avec la sécurité et la clarté d'une institution financière moderne.",
  kpis = DEFAULT_KPIS,
}: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground md:sticky md:top-0 md:flex md:h-screen md:w-5/12 md:flex-col md:justify-between lg:w-1/2 lg:p-16">
        <Link to="/" className="relative z-10 flex items-center gap-3">
          <span className="h-8 w-8 rounded-sm bg-accent" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">Tontine Digitale</span>
        </Link>

        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-tight lg:text-5xl">
            {leftTitle}
          </h2>
          <p className="mt-6 text-base leading-relaxed text-primary-foreground/75 lg:text-lg">
            {leftSubtitle}
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-10 border-t border-primary-foreground/10 pt-8">
          {kpis.map((k) => (
            <div key={k.label} className="flex flex-col">
              <span className="num text-2xl font-semibold text-accent">{k.value}</span>
              <span className="mt-1 text-[11px] uppercase tracking-[0.14em] text-primary-foreground/50">
                {k.label}
              </span>
            </div>
          ))}
        </div>

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          aria-hidden
          style={{
            backgroundImage: "radial-gradient(currentColor 0.6px, transparent 0.6px)",
            backgroundSize: "22px 22px",
          }}
        />
      </aside>

      <section className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10 sm:py-14 md:px-16 md:py-16 lg:px-24">
        <div className="w-full max-w-[420px]">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 md:hidden">
            <span className="h-6 w-6 rounded-sm bg-primary" aria-hidden />
            <span className="text-base font-semibold tracking-tight">Tontine Digitale</span>
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}

export const authFieldLabel =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/50";

export const authFieldInput =
  "w-full rounded-md border border-foreground/10 bg-white px-4 py-3 text-sm text-foreground placeholder:text-foreground/25 shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60";

export const authPrimaryButton =
  "mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70";

export const authFooterLegal =
  "mt-12 border-t border-foreground/5 pt-8 text-[11px] leading-relaxed text-foreground/40";
