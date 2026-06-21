import { ReactNode, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";
import { useNotificationsRealtime } from "@/hooks/useNotifications";
import { useChatToasts } from "@/hooks/useChatToasts";
import { IncomingCallScreen } from "@/components/messages/IncomingCallScreen";
import { CallDiagnosticPanel } from "@/components/messages/CallDiagnosticPanel";
import { IncomingCallsProvider } from "@/hooks/IncomingCallsContext";
import { usePrimeCallChannel } from "@/hooks/usePrimeCallChannel";
import { useDjomyPaymentReconciler } from "@/hooks/useDjomyPaymentReconciler";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GuidedTourProvider } from "@/components/tour/GuidedTour";
import { QuickActionsProvider } from "@/components/quick-actions/QuickActionsProvider";

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useNotificationsRealtime();
  useChatToasts();
  usePrimeCallChannel();
  useDjomyPaymentReconciler();
  const location = useLocation();
  return (
    <GuidedTourProvider>
      <QuickActionsProvider>
        <IncomingCallsProvider>
        <div className="min-h-screen bg-background">
          <DesktopSidebar />
          <div className="lg:pl-72">
            <main className="pb-20 lg:pb-0">
              <ErrorBoundary
                resetKey={location.pathname}
                fallbackTitle="Cet écran a rencontré une erreur"
              >
                <Suspense fallback={<RouteFallback />}>{children}</Suspense>
              </ErrorBoundary>
            </main>
          </div>
          <BottomNav />
          <IncomingCallScreen />
          <CallDiagnosticPanel />
        </div>
        </IncomingCallsProvider>
      </QuickActionsProvider>
    </GuidedTourProvider>
  );
}
