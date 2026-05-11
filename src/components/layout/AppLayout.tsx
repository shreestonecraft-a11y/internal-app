import { ReactNode } from "react";
import DesktopSidebar from "./DesktopSidebar";
import BottomNav from "./BottomNav";
import MobileHeader from "./MobileHeader";
import aonami from "@/assets/aonami.svg";

function PoweredByAonami() {
  return (
    <a
      href="https://aonamitech.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <span>Powered by</span>
      <img src={aonami} alt="Aonami" className="h-5 w-auto opacity-80" />
      <span className="font-semibold">Aonami</span>
    </a>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 pb-20 md:pb-0 overflow-x-hidden">
          {children}
          <footer className="px-4 md:px-8 lg:px-10 py-6 flex justify-center">
            <PoweredByAonami />
          </footer>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
