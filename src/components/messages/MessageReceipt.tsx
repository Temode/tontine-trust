import { Check, CheckCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReceiptStatus } from "@/hooks/useMessageReceipts";

interface Props {
  status: ReceiptStatus;
  seenBy: number;
  audience: number;
  pending?: boolean;
  className?: string;
}

export function MessageReceipt({ status, seenBy, audience, pending, className }: Props) {
  if (pending) {
    return <Loader2 className={cn("h-3.5 w-3.5 animate-spin opacity-60", className)} />;
  }

  const label =
    status === "read"
      ? "Vu par tous"
      : status === "delivered"
        ? `Vu par ${seenBy}${audience ? `/${audience}` : ""}`
        : "Envoyé";

  return (
    <span title={label} aria-label={label} role="img" className={cn("inline-flex", className)}>
      {status === "sent" ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <CheckCheck className={cn("h-3.5 w-3.5", status === "read" && "text-sky-400")} />
      )}
    </span>
  );
}
