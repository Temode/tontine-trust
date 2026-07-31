import { cn } from "@/lib/utils";

const URL_RE = /(https?:\/\/[^\s]+)/g;

function pretty(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 18 ? `${u.pathname.slice(0, 18)}…` : u.pathname;
    return `${u.host}${path === "/" ? "" : path}`;
  } catch {
    return url;
  }
}

export function MessageText({ body, mine }: { body: string; mine: boolean }) {
  const parts = body.split(URL_RE);
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.45]">
      {parts.map((part, i) =>
        URL_RE.test(part) && /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(
              "underline underline-offset-2",
              mine ? "text-chat-out-foreground" : "text-primary",
            )}
          >
            {pretty(part)}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}