import { Bell, Coins, Languages, Mail, MessageSquare, Moon, Smartphone, Sun, SunMoon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";

interface PreferencesPanelProps {
  profile: UserProfile;
}

export function PreferencesPanel({ profile }: PreferencesPanelProps) {
  const [language, setLanguage] = useState(profile.language);
  const [currency] = useState(profile.currency);
  const [theme, setTheme] = useState(profile.theme);
  const [channels, setChannels] = useState(profile.notificationChannels);
  const [cadence, setCadence] = useState(profile.notificationCadence);

  const toggleChannel = (key: keyof typeof channels) => {
    const next = { ...channels, [key]: !channels[key] };
    setChannels(next);
    toast(`Notifications ${key.toUpperCase()} ${next[key] ? "activées" : "désactivées"}`);
  };

  return (
    <div className="space-y-6">
      {/* Language & currency */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-5 py-4 lg:px-6">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Langue et devise</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Affichage des montants et de l'interface
          </p>
        </header>

        <div className="grid grid-cols-1 gap-px border-t border-hairline bg-border lg:grid-cols-2">
          <Field label="Langue d'interface" icon={<Languages className="h-4 w-4" />}>
            <SegmentedControl
              value={language}
              onChange={(v) => {
                setLanguage(v as typeof language);
                toast(v === "fr" ? "Français sélectionné" : "English selected");
              }}
              options={[
                { id: "fr", label: "Français" },
                { id: "en", label: "English" },
              ]}
            />
          </Field>
          <Field
            label="Devise principale"
            icon={<Coins className="h-4 w-4" />}
            hint="GNF est la seule devise supportée pour l'instant. EUR / USD à venir."
          >
            <SegmentedControl
              value={currency}
              onChange={() => undefined}
              options={[
                { id: "GNF", label: "GNF" },
                { id: "EUR", label: "EUR", disabled: true },
                { id: "USD", label: "USD", disabled: true },
              ]}
            />
          </Field>
        </div>
      </article>

      {/* Theme */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-5 py-4 lg:px-6">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Apparence</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Le thème système suit le réglage de votre appareil
          </p>
        </header>
        <div className="px-5 py-5 lg:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ThemeCard
              id="light"
              label="Clair"
              icon={Sun}
              active={theme === "light"}
              onClick={() => setTheme("light")}
            />
            <ThemeCard
              id="dark"
              label="Sombre"
              icon={Moon}
              active={theme === "dark"}
              onClick={() => setTheme("dark")}
            />
            <ThemeCard
              id="system"
              label="Système"
              icon={SunMoon}
              active={theme === "system"}
              onClick={() => setTheme("system")}
            />
          </div>
        </div>
      </article>

      {/* Notifications */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-5 py-4 lg:px-6">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Notifications</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Canaux et fréquence des alertes opérationnelles
          </p>
        </header>

        <ul className="divide-y divide-border/50">
          <ChannelRow
            icon={<MessageSquare className="h-4 w-4" />}
            label="SMS"
            description="Envoyés via Orange / MTN. Recommandé pour les rappels d'échéance."
            active={channels.sms}
            onToggle={() => toggleChannel("sms")}
          />
          <ChannelRow
            icon={<Smartphone className="h-4 w-4" />}
            label="Notifications push"
            description="Alertes en temps réel sur votre application Tontine Digital."
            active={channels.push}
            onToggle={() => toggleChannel("push")}
          />
          <ChannelRow
            icon={<Mail className="h-4 w-4" />}
            label="E-mail"
            description="Récapitulatifs et reçus PDF envoyés à votre adresse vérifiée."
            active={channels.email}
            onToggle={() => toggleChannel("email")}
          />
        </ul>

        <footer className="border-t border-hairline px-5 py-4 lg:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Cadence
          </p>
          <div className="mt-2 inline-flex items-center gap-0.5 rounded-md border border-hairline bg-card p-0.5">
            <CadenceButton
              active={cadence === "real-time"}
              onClick={() => setCadence("real-time")}
              label="Temps réel"
            />
            <CadenceButton
              active={cadence === "daily"}
              onClick={() => setCadence("daily")}
              label="Quotidienne"
            />
            <CadenceButton
              active={cadence === "weekly"}
              onClick={() => setCadence("weekly")}
              label="Hebdomadaire"
            />
          </div>
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Bell className="h-3.5 w-3.5" />
            Les alertes critiques (échec de paiement, KYC) restent envoyées en temps réel quel que soit votre choix.
          </p>
        </footer>
      </article>
    </div>
  );
}

function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card px-5 py-4 lg:px-6">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-primary-50 text-primary">{icon}</span>
        {label}
      </p>
      <div className="mt-3">{children}</div>
      {hint && <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface SegmentedControlProps {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; label: string; disabled?: boolean }>;
}

function SegmentedControl({ value, onChange, options }: SegmentedControlProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-hairline bg-card p-0.5">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onChange(opt.id)}
            aria-pressed={active}
            className={cn(
              "rounded px-3 py-1.5 text-xs font-medium transition",
              active && !opt.disabled
                ? "bg-primary text-primary-foreground"
                : opt.disabled
                ? "cursor-not-allowed text-muted-foreground/50"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ThemeCard({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition",
        active ? "border-primary bg-primary-50/40 ring-1 ring-primary/20" : "border-hairline hover:bg-secondary/40",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md",
          active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
      </div>
    </button>
  );
}

function ChannelRow({
  icon,
  label,
  description,
  active,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-0.5 max-w-prose text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        onClick={onToggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
          active ? "bg-success" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-card shadow-sm transition",
            active ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </li>
  );
}

function CadenceButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded px-3 py-1 text-xs font-medium transition",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
