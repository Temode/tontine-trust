import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("text-current", className)}
      role="img"
      aria-label="Tontine Digital"
    >
      {/* Logo officiel : 5 membres sarcelle + bénéficiaire du tour (or) + caisse centrale (or) */}
      <circle cx="32" cy="10.5" r="6.5" fill="hsl(var(--accent-500))" />
      <circle cx="51.6" cy="21" r="6.5" fill="currentColor" />
      <circle cx="51.6" cy="43" r="6.5" fill="currentColor" />
      <circle cx="32" cy="54" r="6.5" fill="currentColor" />
      <circle cx="12.4" cy="43" r="6.5" fill="currentColor" />
      <circle cx="12.4" cy="21" r="6.5" fill="currentColor" />
      <circle cx="32" cy="32" r="10" fill="hsl(var(--accent-500))" />
    </svg>
  );
}
