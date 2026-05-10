import { Fingerprint, Key, LogOut, Monitor, Shield, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SessionDevice, UserProfile } from "@/lib/types";

interface SecurityPanelProps {
  profile: UserProfile;
  devices: SessionDevice[];
}

export function SecurityPanel({ profile, devices }: SecurityPanelProps) {
  const [twoFA, setTwoFA] = useState(profile.twoFactorEnabled);
  const [biometric, setBiometric] = useState(profile.biometricEnabled);
  const [activeDevices, setActiveDevices] = useState(devices);

  const otherDevicesCount = activeDevices.filter((d) => !d.current).length;

  const handleRevoke = (id: string) => {
    setActiveDevices((prev) => prev.filter((d) => d.id !== id));
    toast.success("Session révoquée", { description: "L'appareil a été déconnecté immédiatement." });
  };

  const handleRevokeAll = () => {
    setActiveDevices((prev) => prev.filter((d) => d.current));
    toast.success("Toutes les autres sessions ont été révoquées");
  };

  return (
    <div className="space-y-6">
      {/* Authentication */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-5 py-4 lg:px-6">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Authentification</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Couches de sécurité actives sur votre compte
          </p>
        </header>

        <ul className="divide-y divide-border/50">
          <ToggleRow
            icon={<Shield className="h-4 w-4" />}
            label="Authentification à deux facteurs"
            description="Code OTP envoyé par SMS Orange Money / MTN à chaque connexion sur un nouvel appareil."
            value={twoFA}
            onChange={(next) => {
              setTwoFA(next);
              toast(next ? "2FA activée" : "2FA désactivée", {
                description: next ? "Code OTP requis à chaque nouvelle session." : "Sécurité réduite — pensez à la réactiver.",
              });
            }}
          />
          <ToggleRow
            icon={<Fingerprint className="h-4 w-4" />}
            label="Authentification biométrique"
            description="Face ID / Touch ID pour valider les paiements et la connexion mobile."
            value={biometric}
            onChange={(next) => {
              setBiometric(next);
              toast(next ? "Biométrie activée" : "Biométrie désactivée");
            }}
          />
          <ActionRow
            icon={<Key className="h-4 w-4" />}
            label="Code PIN de paiement"
            description="Code à 6 chiffres requis pour confirmer chaque cotisation."
            actionLabel="Modifier le PIN"
            onAction={() =>
              toast("Modification du PIN", {
                description: "Le module dédié sera disponible dans la prochaine livraison.",
              })
            }
          />
        </ul>
      </article>

      {/* Active sessions */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
          <div>
            <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Sessions actives</h2>
            <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
              Appareils actuellement connectés à votre compte
            </p>
          </div>
          {otherDevicesCount > 0 && (
            <button
              type="button"
              onClick={handleRevokeAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Tout révoquer
            </button>
          )}
        </header>

        <ul className="divide-y divide-border/50">
          {activeDevices.map((device) => (
            <li key={device.id} className="px-5 py-4 lg:px-6">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
                  {device.device.toLowerCase().includes("iphone") || device.device.toLowerCase().includes("pixel") ? (
                    <Smartphone className="h-5 w-5" strokeWidth={1.75} />
                  ) : (
                    <Monitor className="h-5 w-5" strokeWidth={1.75} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{device.device}</p>
                    {device.current && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
                        Session actuelle
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {device.os} · {device.browser}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {device.city} · <span className="font-mono">{device.ip}</span>
                    <span className="mx-1.5">·</span>
                    {device.lastActive}
                  </p>
                </div>
                {!device.current && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(device.id)}
                    aria-label={`Révoquer la session ${device.device}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    Déconnecter
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <footer className="flex items-center gap-2 border-t border-hairline bg-secondary/30 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Toute connexion suspecte déclenche une notification SMS et bloque temporairement le compte
        </footer>
      </article>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
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
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
          value ? "bg-success" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-card shadow-sm transition",
            value ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </li>
  );
}

function ActionRow({
  icon,
  label,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
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
        onClick={onAction}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-foreground transition hover:bg-secondary"
      >
        {actionLabel}
      </button>
    </li>
  );
}
