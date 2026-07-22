import { useMemo, useState } from "react";
import { Loader2, MessageSquare, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlements } from "@/hooks/useEntitlements";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getActiveSmsPricing, getMySmsWallet, initSmsOrderCheckout,
} from "@/lib/api/smsWallet";

function fmtGnf(n: number) { return new Intl.NumberFormat("fr-FR").format(n) + " GNF"; }

export function SmsRechargePanel({ groupId }: { groupId: string }) {
  const { entitlements } = useEntitlements();
  const isPaying = entitlements.plan_code !== "free";
  const [open, setOpen] = useState(false);
  const [packId, setPackId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const walletQ = useQuery({
    queryKey: ["sms-wallet", "mine"],
    queryFn: getMySmsWallet,
    enabled: isPaying,
  });
  const pricingQ = useQuery({
    queryKey: ["sms-pricing", "active"],
    queryFn: getActiveSmsPricing,
    enabled: open,
  });

  const packs = pricingQ.data?.packs ?? [];
  const selected = useMemo(() => packs.find((p) => p.id === packId) ?? null, [packs, packId]);

  if (!isPaying) return null;

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: prof } = await supabase
        .from("profiles").select("phone_number").eq("id", u.user?.id ?? "").maybeSingle();
      const phone = (prof?.phone_number as string | null) ?? "00224000000000";
      const t = toast.loading("Redirection vers Djomy…");
      const res = await initSmsOrderCheckout({ packId: selected.id, groupId, payerPhone: phone });
      toast.dismiss(t);
      try { sessionStorage.setItem("lastSmsOrderId", res.orderId); } catch { /* noop */ }
      window.location.assign(res.redirectUrl);
    } catch (e) {
      toast.error("Recharge impossible", { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const balance = walletQ.data?.balance_remaining ?? 0;

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-hairline bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Wallet className="h-4 w-4" />
        </div>
        <div className="text-sm">
          <p className="font-semibold text-foreground">Forfait SMS</p>
          <p className="text-xs text-muted-foreground">
            Solde : <span className="font-semibold text-foreground num">{balance}</span> SMS
          </p>
        </div>
      </div>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
        <MessageSquare className="h-3.5 w-3.5" />
        Recharger
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recharger votre forfait SMS</DialogTitle>
          </DialogHeader>
          {pricingQ.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : packs.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Aucun pack SMS disponible pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {packs.map((p) => {
                const isActive = p.id === packId;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setPackId(p.id)}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                      isActive ? "border-primary bg-primary/5" : "border-hairline bg-card hover:bg-secondary"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-foreground">{p.label ?? `${p.qty} SMS`}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.qty} SMS · unitaire {fmtGnf(Math.round(p.price / Math.max(1, p.qty)))}
                      </p>
                    </div>
                    <span className="num font-display text-sm font-semibold text-foreground">{fmtGnf(p.price)}</span>
                  </button>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={!selected || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Payer {selected ? fmtGnf(selected.price) : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}