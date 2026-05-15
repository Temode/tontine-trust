import { BookOpen, Eye, EyeOff, Plus, RefreshCcw, ShieldCheck, Trash2, Webhook } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ApiKey, WebhookEndpoint } from "@/lib/types";

interface ApiSectionProps {
  apiKeys: ApiKey[];
  webhooks: WebhookEndpoint[];
}

const STATUS_VISUAL = {
  active: { label: "Active", className: "bg-success/10 text-success" },
  revoked: { label: "Révoquée", className: "bg-destructive/10 text-destructive" },
} as const;

export function ApiSection({ apiKeys: initialKeys, webhooks: initialWebhooks }: ApiSectionProps) {
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [keys, setKeys] = useState(initialKeys);
  const [webhooks, setWebhooks] = useState(initialWebhooks);

  const toggleReveal = (id: string) => setReveal((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleRotate = (id: string) => {
    setKeys((prev) =>
      prev.map((k) =>
        k.id === id
          ? {
              ...k,
              maskedSuffix: Math.random().toString(36).slice(2, 6).toUpperCase(),
              lastUsedOn: undefined,
            }
          : k,
      ),
    );
    toast.success("Clé tournée", {
      description: "L'ancienne clé reste valide 24h pour permettre la migration.",
    });
  };

  const handleRevoke = (id: string) => {
    setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, status: "revoked" } : k)));
    toast("Clé révoquée", { description: "Les appels avec cette clé seront rejetés sous 60 secondes." });
  };

  const handleWebhookToggle = (id: string) => {
    setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)));
  };

  const handleWebhookTest = () => {
    toast.success("Événement test envoyé", { description: "Vérifiez votre journal de réception côté serveur." });
  };

  return (
    <div className="space-y-6">
      {/* API keys */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
          <div>
            <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Clés API</h2>
            <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
              Accès machine au registre Tontine Digital · environnements Production et Sandbox
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                toast("Documentation API", { description: "tontine.digital/docs · disponible à la prochaine livraison." });
              }}
              className="hidden h-9 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:inline-flex"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Documentation
            </a>
            <button
              type="button"
              onClick={() =>
                toast("Nouvelle clé", {
                  description: "Le générateur de clé sera disponible dans la prochaine livraison.",
                })
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Générer
            </button>
          </div>
        </header>

        <ul className="divide-y divide-border/50">
          {keys.map((k) => {
            const sv = STATUS_VISUAL[k.status];
            const isRevoked = k.status === "revoked";
            const isLive = k.environment === "live";
            return (
              <li key={k.id} className={cn("px-5 py-5 lg:px-6", isRevoked && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold",
                      isLive ? "bg-destructive/10 text-destructive" : "bg-primary-50 text-primary",
                    )}
                  >
                    {isLive ? "LIVE" : "TEST"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{k.label}</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", sv.className)}>
                        {sv.label}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-foreground">
                      {k.prefix}
                      {reveal[k.id] ? "kJfQ72hP1zR9aXt..." + k.maskedSuffix : "•••••••••••••" + k.maskedSuffix}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Créée le {k.createdOn}
                      {k.lastUsedOn && (
                        <>
                          <span className="mx-1.5">·</span>
                          dernière utilisation {k.lastUsedOn}
                        </>
                      )}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {k.scopes.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center rounded-md border border-hairline bg-secondary/40 px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>

                    {!isRevoked && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleReveal(k.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-foreground transition hover:bg-secondary"
                        >
                          {reveal[k.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {reveal[k.id] ? "Masquer" : "Révéler"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotate(k.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Régénérer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevoke(k.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 text-xs font-medium text-destructive transition hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Révoquer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <footer className="flex items-center gap-2 border-t border-hairline bg-secondary/30 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Les clés sont signées HMAC et journalisées à chaque appel. Stockage chiffré AES-256.
        </footer>
      </article>

      {/* Webhooks */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
          <div>
            <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Webhooks</h2>
            <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
              Notifications HTTPS push vers vos systèmes · retries exponentiels et signature HMAC-SHA256
            </p>
          </div>
          <button
            type="button"
            onClick={handleWebhookTest}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary"
          >
            <Webhook className="h-3.5 w-3.5" />
            Envoyer un événement test
          </button>
        </header>

        <ul className="divide-y divide-border/50">
          {webhooks.map((w) => {
            const statusTone =
              w.lastDeliveryStatus === "success"
                ? "bg-success/10 text-success"
                : w.lastDeliveryStatus === "retrying"
                ? "bg-warning/10 text-warning"
                : "bg-destructive/10 text-destructive";
            return (
              <li key={w.id} className="px-5 py-4 lg:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-medium text-foreground">{w.url}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {w.events.slice(0, 4).map((e) => (
                        <span
                          key={e}
                          className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                    {w.lastDeliveryOn && (
                      <p className="mt-2 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", statusTone)}>
                          {w.lastDeliveryStatus === "success"
                            ? "Livré"
                            : w.lastDeliveryStatus === "retrying"
                            ? "Retry"
                            : "Échec"}
                        </span>
                        Dernière livraison {w.lastDeliveryOn}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={w.enabled}
                    onClick={() => handleWebhookToggle(w.id)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
                      w.enabled ? "bg-success" : "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 transform rounded-full bg-card shadow-sm transition",
                        w.enabled ? "translate-x-5" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </article>
    </div>
  );
}
