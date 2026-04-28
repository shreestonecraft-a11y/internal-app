import { ReactNode } from "react";
import DesktopSidebar from "./DesktopSidebar";
import BottomNav from "./BottomNav";
import MobileHeader from "./MobileHeader";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 pb-20 md:pb-0 overflow-x-hidden">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
