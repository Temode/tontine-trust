import { useLayoutEffect, useRef, type ReactNode } from "react";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { Branch } from "@radix-ui/react-dismissable-layer";
import { useCallPriority } from "@/lib/callPriority";

/** Pause existing Radix scopes without remounting their forms. */
export function CallSurface({ children, full = true }: { children: ReactNode; full?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!full || !root.current) return;
    const element = root.current;
    const saved = new Map<HTMLElement, { inert: boolean; hidden: string | null }>();
    const suspend = () => {
      for (const node of Array.from(document.body.children)) {
        if (!(node instanceof HTMLElement) || node.contains(element) ||
            node.matches("script, style") || node.querySelector("[data-call-owned]") ||
            node.matches("[data-call-owned]")) continue;
        if (!saved.has(node)) saved.set(node, { inert: node.inert, hidden: node.getAttribute("aria-hidden") });
        node.inert = true;
        node.setAttribute("data-call-suspended", "");
        node.setAttribute("aria-hidden", "true");
      }
      element.removeAttribute("aria-hidden");
    };
    suspend();
    const observer = new MutationObserver(suspend);
    observer.observe(document.body, { childList: true });
    return () => {
      observer.disconnect();
      for (const [node, previous] of saved) {
        node.inert = previous.inert;
        node.removeAttribute("data-call-suspended");
        if (previous.hidden === null) node.removeAttribute("aria-hidden");
        else node.setAttribute("aria-hidden", previous.hidden);
      }
    };
  }, [full]);
  return (
    <FocusScope trapped={full} loop={full} onUnmountAutoFocus={(event) => {
      if (document.querySelector("[data-call-full='true']")) event.preventDefault();
    }} asChild>
      <Branch asChild>
        <div ref={root} data-call-owned data-call-full={full} className="pointer-events-auto" tabIndex={-1}>
          {children}
        </div>
      </Branch>
    </FocusScope>
  );
}

export function preventSuspendedModalDismiss(event: { preventDefault: () => void }) {
  if (document.querySelector("[data-call-full='true']")) event.preventDefault();
}

export function CallPriorityObserver() {
  const { full } = useCallPriority();
  useLayoutEffect(() => {
    document.body.toggleAttribute("data-call-priority", full);
    return () => document.body.removeAttribute("data-call-priority");
  }, [full]);
  return null;
}