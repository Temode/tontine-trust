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
      <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <circle cx="32" cy="12" r="6" fill="hsl(var(--accent-500))" />
      <circle cx="49" cy="24" r="6" fill="currentColor" />
      <circle cx="49" cy="44" r="6" fill="currentColor" />
      <circle cx="32" cy="52" r="6" fill="currentColor" />
      <circle cx="15" cy="44" r="6" fill="currentColor" />
      <circle cx="15" cy="24" r="6" fill="currentColor" />
      <circle cx="32" cy="32" r="10" fill="hsl(var(--accent-500))" />
    </svg>
  );
}
