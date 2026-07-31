import { Speaker, Volume2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAudioOutput, classifyOutput } from "@/hooks/useAudioOutput";
import { cn } from "@/lib/utils";

type Variant = "full" | "mini" | "banner";

const sizes: Record<Variant, string> = {
  full: "h-9 w-9",
  mini: "h-8 w-8",
  banner: "h-6 w-6",
};

const iconSizes: Record<Variant, string> = {
  full: "h-4 w-4",
  mini: "h-3.5 w-3.5",
  banner: "h-3.5 w-3.5",
};

/**
 * Sélection de la sortie audio, disponible en mode full, mini et PiP (bandeau).
 * Clic simple : bascule haut-parleur / oreillette. Menu : choix explicite.
 */
export function AudioOutputControl({ variant = "full" }: { variant?: Variant }) {
  const { supported, devices, currentId, currentKind, select, toggleSpeaker } = useAudioOutput();

  if (!supported || devices.length === 0) return null;

  const Icon = currentKind === "speaker" ? Volume2 : Speaker;

  return (
    <DropdownMenu>
      <div className="inline-flex items-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void toggleSpeaker();
          }}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full text-white transition",
            variant === "banner"
              ? "text-primary-foreground hover:bg-black/10"
              : "bg-white/10 hover:bg-white/20",
            sizes[variant],
          )}
          aria-label={
            currentKind === "speaker" ? "Basculer sur l'oreillette" : "Basculer sur le haut-parleur"
          }
          title="Sortie audio"
        >
          <Icon className={iconSizes[variant]} />
        </button>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "ml-0.5 inline-flex h-6 w-4 shrink-0 items-center justify-center rounded-full text-[10px] text-white/70 hover:text-white",
              variant === "banner" && "text-primary-foreground/80",
            )}
            aria-label="Choisir la sortie audio"
          >
            ▾
          </button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="end" className="z-[95] w-64">
        <DropdownMenuLabel>Sortie audio</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {devices.map((d) => (
          <DropdownMenuItem key={d.deviceId} onClick={() => void select(d.deviceId)}>
            <span
              className={cn("truncate", currentId === d.deviceId && "font-semibold text-primary")}
            >
              {d.label ||
                (classifyOutput(d.label) === "speaker" ? "Haut-parleur" : "Périphérique audio")}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
