import { Home, Package, Plus, FileText, BarChart3 } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

// Center "+" now opens the New Dispatch dialog on the Invoices page —
// a dispatch is the only sanctioned way to deduct stock, so this is the
// most common create action. Stones are added from the Inventory page itself.
const items = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/inventory", icon: Package, label: "Inventory" },
  { to: "/invoices?new=dispatch", icon: Plus, label: "Dispatch", isCenter: true, matchPath: "/invoices" },
  { to: "/invoices", icon: FileText, label: "Invoices" },
  { to: "/insights", icon: BarChart3, label: "Insights" },
];

export default function BottomNav() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-around px-2 py-1">
        {items.map(({ to, icon: Icon, label, isCenter, matchPath }) => {
          const active = location.pathname === (matchPath ?? to);
          return (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center gap-0.5 py-1.5 px-3"
            >
              {isCenter ? (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg -mt-5">
                  <Icon className="h-5 w-5" />
                </span>
              ) : (
                <Icon className={`h-5 w-5 transition-colors ${active ? "text-accent" : "text-muted-foreground"}`} />
              )}
              <span className={`text-[10px] font-medium ${active || isCenter ? "text-accent" : "text-muted-foreground"}`}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
