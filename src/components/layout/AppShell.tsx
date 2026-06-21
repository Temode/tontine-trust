import { ReactNode, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";
import { useNotificationsRealtime } from "@/hooks/useNotifications";
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
  const location = useLocation();
  return (
    <GuidedTourProvider>
      <QuickActionsProvider>
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
        </div>
      </QuickActionsProvider>
    </GuidedTourProvider>
  );
}
