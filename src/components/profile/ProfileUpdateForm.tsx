import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  full_name: z.string().trim().min(2, "Nom trop court").max(100, "Nom trop long"),
  phone_number: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-]{6,20}$/, "Numéro invalide")
    .or(z.literal("")),
});

export function ProfileUpdateForm() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [initial, setInitial] = useState({ full_name: "", phone_number: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone_number")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast.error("Impossible de charger le profil.");
      } else if (data) {
        const fn = data.full_name ?? "";
        const ph = data.phone_number ?? "";
        setFullName(fn);
        setPhone(ph);
        setInitial({ full_name: fn, phone_number: ph });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const dirty = fullName !== initial.full_name || phone !== initial.phone_number;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ full_name: fullName, phone_number: phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        phone_number: parsed.data.phone_number || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setInitial({ full_name: parsed.data.full_name, phone_number: parsed.data.phone_number });
    toast.success("Profil mis à jour.");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-hairline bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement du profil...
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-hairline bg-card p-6"
    >
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">
          Informations personnelles
        </h3>
        <p className="text-sm text-muted-foreground">
          Mets à jour ton nom complet et ton numéro de téléphone Mobile Money.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pu-name">Nom complet</Label>
        <Input
          id="pu-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pu-phone">Téléphone</Label>
        <Input
          id="pu-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          placeholder="+224 6XX XX XX XX"
        />
        <p className="text-xs text-muted-foreground">Format international, ex. +224 620 00 00 00.</p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
