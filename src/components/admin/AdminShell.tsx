import { ReactNode, Suspense } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopBar } from "./AdminTopBar";
import { toast } from "sonner";
import { useEffect } from "react";

function Fallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { roles, loading, user } = useAuth();
  const location = useLocation();
  const isSuper = roles.includes("super_admin" as AppRole);

  useEffect(() => {
    if (!loading && user && !isSuper) {
      toast.error("Accès réservé", { description: "Cette zone est réservée aux administrateurs Tontine." });
    }
  }, [loading, user, isSuper]);

  if (loading) return <Fallback />;
  if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  if (!isSuper) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />
      <div className="lg:pl-64">
        <AdminTopBar />
        <main className="p-6">
          <ErrorBoundary resetKey={location.pathname} fallbackTitle="Erreur back-office">
            <Suspense fallback={<Fallback />}>{children}</Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}