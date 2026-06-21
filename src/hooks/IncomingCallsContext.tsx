import { createContext, ReactNode, useContext } from "react";
import { useIncomingCalls, IncomingCall, IncomingCallsStatus } from "./useIncomingCalls";

interface Ctx {
  current: IncomingCall | null;
  dismiss: () => void;
  status: IncomingCallsStatus;
  groupCount: number;
  lastEventAt: number | null;
}

const IncomingCallsCtx = createContext<Ctx | null>(null);

export function IncomingCallsProvider({ children }: { children: ReactNode }) {
  const value = useIncomingCalls();
  return (
    <IncomingCallsCtx.Provider value={value}>
      {children}
    </IncomingCallsCtx.Provider>
  );
}

export function useIncomingCallsContext(): Ctx {
  const v = useContext(IncomingCallsCtx);
  if (!v) {
    return {
      current: null,
      dismiss: () => {},
      status: "idle",
      groupCount: 0,
      lastEventAt: null,
    };
  }
  return v;
}