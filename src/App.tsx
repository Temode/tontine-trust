import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import Calendar from "@/pages/Calendar";
import Contributions from "@/pages/Contributions";
import Dashboard from "@/pages/Dashboard";
import GroupDetail from "@/pages/GroupDetail";
import History from "@/pages/History";
import MyGroups from "@/pages/MyGroups";
import NotFound from "@/pages/NotFound";
import Rotations from "@/pages/Rotations";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/groupes" element={<MyGroups />} />
            <Route path="/groupes/:id" element={<GroupDetail />} />
            <Route path="/cotisations" element={<Contributions />} />
            <Route path="/rotations" element={<Rotations />} />
            <Route path="/historique" element={<History />} />
            <Route path="/calendrier" element={<Calendar />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
