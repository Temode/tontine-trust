import { Mic } from "lucide-react";
import type { TypingUser } from "@/hooks/useTypingChannel";

interface Props {
  typers: TypingUser[];
}

function firstNames(list: TypingUser[]): string[] {
  return list.map((t) => t.name.split(" ")[0]);
}

function phrase(names: string[], singular: string, plural: string): string {
  if (names.length === 1) return `${names[0]} ${singular}`;
  if (names.length === 2) return `${names[0]} et ${names[1]} ${plural}`;
  return `${names.length} personnes ${plural}`;
}

export function TypingIndicator({ typers }: Props) {
  if (typers.length === 0) return null;
  const recording = typers.filter((t) => t.kind === "recording");
  const writing = typers.filter((t) => t.kind !== "recording");

  const parts: string[] = [];
  if (recording.length > 0) {
    parts.push(
      phrase(firstNames(recording), "enregistre un vocal…", "enregistrent un vocal…"),
    );
  }
  if (writing.length > 0) {
    parts.push(phrase(firstNames(writing), "écrit…", "écrivent…"));
  }

  return (
    <div
      aria-live="polite"
      className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground"
    >
      {recording.length > 0 ? (
        <Mic className="h-3.5 w-3.5 animate-pulse text-destructive" aria-hidden />
      ) : (
        <span className="flex gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        </span>
      )}
      {parts.join(" · ")}
    </div>
  );
}
