import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <DesktopSidebar />
      <div className="md:pl-64">
        <main className="pb-24 md:pb-12">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
