import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Lazy-loaded pages : un import cassé n'efface plus toute l'app.
const Auth = lazy(() => import("@/pages/Auth"));
const Index = lazy(() => import("@/pages/Index"));
const CreateGroup = lazy(() => import("@/pages/CreateGroup"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const GroupDetail = lazy(() => import("@/pages/GroupDetail"));
const InviteMembers = lazy(() => import("@/pages/InviteMembers"));
const JoinGroup = lazy(() => import("@/pages/JoinGroup"));
const MyGroups = lazy(() => import("@/pages/MyGroups"));
const MyContributions = lazy(() => import("@/pages/MyContributions"));
const Receipts = lazy(() => import("@/pages/Receipts"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Profile = lazy(() => import("@/pages/Profile"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
    mutations: { retry: 0 },
  },
});

function AppSuspense() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

const App = () => (
  <ErrorBoundary fallbackTitle="Tontine Digital a rencontré un problème">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<AppSuspense />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route
                  path="/auth"
                  element={
                    <ErrorBoundary fallbackTitle="L'écran de connexion a rencontré un problème">
                      <Auth />
                    </ErrorBoundary>
                  }
                />
                <Route element={<ProtectedRoute />}>
                  <Route
                    element={
                      <AppShell>
                        <Outlet />
                      </AppShell>
                    }
                  >
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/groupes" element={<MyGroups />} />
                    <Route path="/groupes/:id" element={<GroupDetail />} />
                    <Route path="/cotisations" element={<MyContributions />} />
                    <Route path="/recus" element={<Receipts />} />
                    <Route path="/recus/:id" element={<Receipts />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/nouveau" element={<CreateGroup />} />
                    <Route path="/rejoindre" element={<JoinGroup />} />
                    <Route path="/inviter" element={<InviteMembers />} />
                    <Route path="/profil" element={<Profile />} />
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
