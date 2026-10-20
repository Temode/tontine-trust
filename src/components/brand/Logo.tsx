import { cn } from "@/lib/utils";
import logoSeal from "@/assets/logo-seal.svg";

interface LogoProps {
  size?: number;
  className?: string;
  shadow?: boolean;
}

/** Logo officiel Tontine Digitale (sceau bleu sarcelle). */
export function Logo({ size = 32, className, shadow }: LogoProps) {
  return (
    <img
      src={logoSeal}
      width={size}
      height={size}
      alt="Tontine Digitale"
      className={cn("shrink-0 select-none", shadow && "drop-shadow-md", className)}
      draggable={false}
    />
  );
}
