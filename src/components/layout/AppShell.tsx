import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";
import { useNotificationsRealtime } from "@/hooks/useNotifications";

export function AppShell({ children }: { children: ReactNode }) {
  useNotificationsRealtime();
  return (
    <div className="min-h-screen bg-background">
      <DesktopSidebar />
      <div className="lg:pl-72">
        <main className="pb-20 lg:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
