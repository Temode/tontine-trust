import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "@/pages/Auth";
import Index from "@/pages/Index";
import CreateGroup from "@/pages/CreateGroup";
import Dashboard from "@/pages/Dashboard";
import GroupDetail from "@/pages/GroupDetail";
import InviteMembers from "@/pages/InviteMembers";
import JoinGroup from "@/pages/JoinGroup";
import MyGroups from "@/pages/MyGroups";
import MyContributions from "@/pages/MyContributions";
import Receipts from "@/pages/Receipts";
import Notifications from "@/pages/Notifications";
import NotFound from "@/pages/NotFound";
import Profile from "@/pages/Profile";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
