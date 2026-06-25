import type { TypingUser } from "@/hooks/useTypingChannel";

interface Props {
  typers: TypingUser[];
}

export function TypingIndicator({ typers }: Props) {
  if (typers.length === 0) return null;
  const names = typers.map((t) => t.name.split(" ")[0]);
  let label = "";
  if (names.length === 1) label = `${names[0]} écrit…`;
  else if (names.length === 2) label = `${names[0]} et ${names[1]} écrivent…`;
  else label = `${names.length} personnes écrivent…`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
      </span>
      {label}
    </div>
  );
}