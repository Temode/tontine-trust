import { Briefcase, Mail, MapPin, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";

interface IdentityCardProps {
  profile: UserProfile;
  /** Number of organized groups (mandates) to display next to the role. */
  organizedCount: number;
  /** Number of participated-in groups. */
  participantCount: number;
  onEdit?: () => void;
}

const KYC_LABEL: Record<UserProfile["kycLevel"], { label: string; tone: string }> = {
  1: { label: "KYC niveau 1", tone: "bg-warning/10 text-warning" },
  2: { label: "KYC niveau 2", tone: "bg-success/10 text-success" },
  3: { label: "KYC niveau 3", tone: "bg-success/10 text-success" },
};

export function IdentityCard({ profile, organizedCount, participantCount, onEdit }: IdentityCardProps) {
  const kyc = KYC_LABEL[profile.kycLevel];

  return (
    <article className="relative overflow-hidden rounded-xl border border-hairline bg-card">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute -right-32 -top-32 h-72 w-72 rounded-full bg-primary-50 blur-3xl" />
        <div className="absolute -bottom-32 -left-12 h-56 w-56 rounded-full bg-accent-50 blur-3xl" />
      </div>

      <div className="relative grid grid-cols-1 gap-6 px-5 py-6 lg:grid-cols-[auto_1fr_auto] lg:items-start lg:gap-8 lg:px-8 lg:py-7">
        {/* Avatar */}
        <div className="flex shrink-0 items-center gap-4 lg:items-start">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card lg:h-24 lg:w-24">
              <span className="font-display text-2xl font-bold tracking-wider lg:text-3xl">
                {profile.initials}
              </span>
            </div>
            <span
              aria-hidden
              className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-success text-success-foreground ring-4 ring-card"
            >
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
          </div>

          {/* Mobile-only inline name */}
          <div className="lg:hidden">
            <h1 className="font-display text-xl font-bold leading-tight text-foreground">
              {profile.fullName}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">{profile.occupation}</p>
          </div>
        </div>

        {/* Identity body */}
        <div className="min-w-0">
          <div className="hidden lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Profil utilisateur
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-foreground lg:text-[28px]">
              {profile.fullName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{profile.occupation}</p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill tone={kyc.tone}>
              <ShieldCheck className="h-3 w-3" />
              {kyc.label}
            </Pill>
            <Pill tone="bg-primary-50 text-primary">
              <Briefcase className="h-3 w-3" />
              {organizedCount} mandats organisateur
            </Pill>
            <Pill tone="bg-secondary text-foreground">
              <Sparkles className="h-3 w-3" />
              {participantCount} cycles participés
            </Pill>
            {profile.badges.slice(0, 1).map((b) => (
              <Pill key={b} tone="bg-accent-50 text-accent-700">
                <Sparkles className="h-3 w-3" />
                Pionnier
              </Pill>
            ))}
          </div>

          <p className="mt-4 max-w-prose text-sm text-muted-foreground">{profile.bio}</p>

          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ContactRow icon={<Phone className="h-3.5 w-3.5" />} label="Numéro" value={profile.phone} mono />
            <ContactRow icon={<Mail className="h-3.5 w-3.5" />} label="E-mail" value={profile.email} />
            <ContactRow
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Localisation"
              value={`${profile.city} · ${profile.country}`}
            />
          </dl>
        </div>

        {/* Right-side metadata */}
        <aside className="rounded-lg border border-hairline bg-secondary/30 p-4 text-sm lg:w-56">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Identifiant
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-foreground">{profile.id.toUpperCase()}</p>

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-2">
            <Meta label="Membre depuis" value={profile.memberSince} />
            <Meta label="Ancienneté" value={`${profile.tenureMonths} mois`} />
            <Meta label="KYC vérifié" value={profile.kycVerifiedOn} mute />
          </div>

          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="mt-4 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-hairline bg-card text-xs font-medium text-foreground transition hover:bg-secondary"
            >
              Modifier
            </button>
          )}
        </aside>
      </div>
    </article>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tone,
      )}
    >
      {children}
    </span>
  );
}

function ContactRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-hairline bg-card px-3 py-2">
      <dt className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className={cn("mt-0.5 truncate text-sm font-semibold text-foreground", mono && "font-mono")}>
        {value}
      </dd>
    </div>
  );
}

function Meta({ label, value, mute }: { label: string; value: string; mute?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-xs font-semibold", mute ? "text-muted-foreground" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}
