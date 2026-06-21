import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { JoinGroupDialog } from "./JoinGroupDialog";
import { PayContributionsDialog } from "./PayContributionsDialog";

interface QuickActionsContextValue {
  openCreate: () => void;
  openJoin: () => void;
  openPay: () => void;
}

const QuickActionsContext = createContext<QuickActionsContextValue | null>(null);

export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const value: QuickActionsContextValue = {
    openCreate: useCallback(() => setCreateOpen(true), []),
    openJoin: useCallback(() => setJoinOpen(true), []),
    openPay: useCallback(() => setPayOpen(true), []),
  };

  return (
    <QuickActionsContext.Provider value={value}>
      {children}
      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JoinGroupDialog open={joinOpen} onOpenChange={setJoinOpen} />
      <PayContributionsDialog open={payOpen} onOpenChange={setPayOpen} />
    </QuickActionsContext.Provider>
  );
}

export function useQuickActions(): QuickActionsContextValue {
  const ctx = useContext(QuickActionsContext);
  if (!ctx) {
    // Graceful no-op fallback so a component outside the provider doesn't crash.
    // eslint-disable-next-line no-console
    console.warn("[useQuickActions] called outside QuickActionsProvider");
    return {
      openCreate: () => {},
      openJoin: () => {},
      openPay: () => {},
    };
  }
  return ctx;
}