import { Home, Package, PlusCircle, BarChart3, History, Settings, LogOut, FileText } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { logout } from "@/lib/auth";
import logo from "@/assets/logo.png";

const navItems = [
  { to: "/", icon: Home, label: "Dashboard" },
  { to: "/inventory", icon: Package, label: "Inventory" },
  { to: "/add", icon: PlusCircle, label: "Add Stone" },
  { to: "/invoices", icon: FileText, label: "Invoices" },
  { to: "/insights", icon: BarChart3, label: "Insights" },
  { to: "/history", icon: History, label: "History" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function DesktopSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="hidden md:flex md:w-64 lg:w-72 flex-col border-r border-border bg-card h-screen sticky top-0">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <img src={logo} alt="Shree Stone Craft" className="h-10 w-10 rounded-lg object-cover" />
        <div>
          <h1 className="font-display text-base font-bold text-foreground leading-tight">Shree Stone Craft</h1>
          <p className="text-[11px] text-muted-foreground font-medium">Inventory System</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          );
        })}
      </nav>
      <div className="px-3 pb-2">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all w-full"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Logout
        </button>
      </div>
      <div className="px-4 py-4 border-t border-border">
        <p className="text-[11px] text-muted-foreground text-center">© 2026 Shree Stone Craft</p>
      </div>
    </aside>
  );
}
