import { Checkbox } from "@/components/ui/checkbox";
import { CURRENT_TERMS_VERSION } from "@/lib/api/privacy";

interface Props {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}

export function TermsAcceptanceCheckbox({ checked, onCheckedChange }: Props) {
  return (
    <label className="flex items-start gap-3 text-sm text-foreground">
      <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} />
      <span>
        J'ai lu et j'accepte les{" "}
        <a
          href="/cgu"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-primary underline underline-offset-2"
        >
          conditions générales d'utilisation
        </a>{" "}
        (version {CURRENT_TERMS_VERSION}).
      </span>
    </label>
  );
}