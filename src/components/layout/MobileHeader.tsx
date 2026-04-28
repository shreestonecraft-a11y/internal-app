import { NavLink } from "react-router-dom";
import { UserCircle2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/lib/auth";

export default function MobileHeader() {
  const { profile } = useAuth();
  const initials = (profile?.full_name || profile?.email || "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase())
    .join("") || "?";

  return (
    <header className="md:hidden sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between px-4 h-14">
        <NavLink to="/" className="flex items-center gap-2">
          <img src={logo} alt="SSC" className="h-8 w-8 rounded-lg" />
          <span className="font-display font-bold text-sm text-foreground">Shree Stone Craft</span>
        </NavLink>

        <NavLink
          to="/settings"
          className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-secondary transition-colors"
          aria-label="Open Settings"
        >
          {profile ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent text-xs font-semibold">
              {initials}
            </span>
          ) : (
            <UserCircle2 className="h-7 w-7 text-muted-foreground" />
          )}
        </NavLink>
      </div>
    </header>
  );
}
