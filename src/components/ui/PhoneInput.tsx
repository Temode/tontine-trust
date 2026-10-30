import { useMemo } from "react";
import { COUNTRIES, findCountryByDial, isValidNational, type CountryDef } from "@/lib/phone";
import { cn } from "@/lib/utils";

export interface PhoneInputValue {
  dial: string;      // sans "+"
  national: string;  // partie nationale, chiffres uniquement
}

interface PhoneInputProps {
  id?: string;
  value: PhoneInputValue;
  onChange: (v: PhoneInputValue) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
}

export function PhoneInput({
  id,
  value,
  onChange,
  className,
  disabled,
  required,
  autoComplete = "tel",
}: PhoneInputProps) {
  const country = useMemo<CountryDef>(
    () => findCountryByDial(value.dial) ?? COUNTRIES[0],
    [value.dial],
  );

  const isValid = value.national === "" || isValidNational(value.national, country);
  const hint = getCountryHint(country);

  const handleNational = (raw: string) => {
    let digits = raw.replace(/[^\d+]/g, "");
    // Si l'utilisateur colle un numéro complet, on tente d'extraire le pays
    if (digits.startsWith("+") || digits.startsWith("00")) {
      const stripped = digits.replace(/^\+/, "").replace(/^00/, "");
      const match = [...COUNTRIES]
        .sort((a, b) => b.dial.length - a.dial.length)
        .find((c) => stripped.startsWith(c.dial));
      if (match) {
        onChange({ dial: match.dial, national: stripped.slice(match.dial.length) });
        return;
      }
    }
    digits = digits.replace(/\D/g, "").replace(/^0+/, "");
    onChange({ dial: country.dial, national: digits });
  };

  return (
    <div className={className}>
      <div className="flex items-stretch gap-2">
        <select
          aria-label="Indicatif pays"
          value={country.code}
          disabled={disabled}
          onChange={(e) => {
            const next = COUNTRIES.find((c) => c.code === e.target.value) ?? COUNTRIES[0];
            onChange({ dial: next.dial, national: value.national });
          }}
          className="h-11 rounded-md border border-foreground/10 bg-background px-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} +{c.dial} {c.name}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          value={value.national}
          onChange={(e) => handleNational(e.target.value)}
          placeholder={country.code === "GN" ? "611 59 93 95" : "Numéro national"}
          className={cn(
            "h-11 flex-1 rounded-md border bg-background px-3 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2",
            isValid
              ? "border-foreground/10 focus:border-primary focus:ring-primary/15"
              : "border-destructive/60 focus:border-destructive focus:ring-destructive/20",
          )}
        />
      </div>
      <p className={cn("mt-1.5 text-[11px]", isValid ? "text-foreground/40" : "text-destructive")}>
        {isValid ? hint : `Format ${country.name} invalide — ${hint}`}
      </p>
    </div>
  );
}

function getCountryHint(country: CountryDef): string {
  const lens = Array.isArray(country.nationalLength)
    ? country.nationalLength.join(" ou ")
    : String(country.nationalLength);
  const prefix = country.nationalPrefixes?.length
    ? ` commençant par ${country.nationalPrefixes.join("/")}`
    : "";
  return `${country.name} : ${lens} chiffres${prefix} — stocké au format +${country.dial}…`;
}