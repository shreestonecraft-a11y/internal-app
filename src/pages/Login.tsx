import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/auth";
import logo from "@/assets/logo.png";
import aonami from "@/assets/aonami.svg";

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) { setError("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address"); return; }
    if (!password) { setError("Password is required"); return; }

    setLoading(true);
    const result = await login(email, password, keepSignedIn);

    if (result.ok) {
      navigate("/", { replace: true });
    } else {
      setLoading(false);
      setError(result.error || "Invalid email or password");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const loginCard = (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className={`w-full max-w-sm ${shake ? "animate-shake" : ""}`}
    >
      <motion.div variants={fadeUp} className="flex flex-col items-center mb-8 md:hidden">
        <img src={logo} alt="SSC" className="h-14 w-14 rounded-2xl mb-4 shadow-lg" />
        <h1 className="font-display text-2xl font-bold text-foreground">Shree Stone Craft</h1>
        <p className="text-sm text-muted-foreground mt-1">Inventory management, simplified</p>
      </motion.div>

      <motion.div variants={fadeUp} className="glass-card rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="hidden md:block mb-6">
          <h2 className="font-display text-xl font-bold text-foreground">Welcome back</h2>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>
        <div className="md:hidden mb-6">
          <h2 className="font-display text-lg font-bold text-foreground text-center">Sign In</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
            <Input
              id="email"
              type="email"
              autoFocus
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              className={`h-11 rounded-xl bg-secondary/50 border-border/50 focus:border-accent focus:ring-accent ${error && !email ? "border-destructive" : ""}`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                className={`h-11 rounded-xl bg-secondary/50 border-border/50 pr-10 focus:border-accent focus:ring-accent ${error && !password ? "border-destructive" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={e => setKeepSignedIn(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
            />
            <span className="text-sm text-foreground">Keep me signed in</span>
          </label>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-destructive font-medium text-center"
            >
              {error}
            </motion.p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg font-semibold text-sm"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</>
            ) : (
              <><LogIn className="h-4 w-4" /> Login</>
            )}
          </Button>
        </form>
      </motion.div>

      <motion.p variants={fadeUp} className="text-xs text-muted-foreground text-center mt-6">
        Internal system — authorized users only
      </motion.p>
      <motion.div variants={fadeUp} className="flex justify-center mt-4">
        <a
          href="https://aonamitech.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Powered by</span>
          <img src={aonami} alt="Aonami" className="h-3.5 w-auto opacity-70" />
        </a>
      </motion.div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile */}
      <div className="flex md:hidden min-h-screen flex-col items-center justify-center px-6 py-10">
        {loginCard}
      </div>

      {/* Desktop: split screen */}
      <div className="hidden md:flex min-h-screen">
        {/* Left branding panel */}
        <div className="w-1/2 hero-bg relative flex flex-col items-center justify-center p-12 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
          <div className="relative z-10 max-w-md text-center">
            <img src={logo} alt="Shree Stone Craft" className="h-16 w-16 rounded-2xl mx-auto mb-6 shadow-xl" />
            <h1 className="font-display text-3xl font-bold text-gradient leading-tight mb-4">
              Manage your stone inventory effortlessly
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: "hsl(0 0% 65%)" }}>
              Track stock, locations, and packing data across all your warehouses in one clean, powerful system built for Shree Stone Craft.
            </p>
            <div className="flex justify-center gap-3 mt-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-1.5 rounded-full bg-accent/40" style={{ width: i === 1 ? 32 : 16, opacity: i === 1 ? 1 : 0.4 }} />
              ))}
            </div>
          </div>
        </div>

        {/* Right login panel */}
        <div className="w-1/2 flex items-center justify-center p-12">
          {loginCard}
        </div>
      </div>
    </div>
  );
}
