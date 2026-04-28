import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Package, Search, MapPin, AlertTriangle, ArrowRight, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";
import { StoneItem, StockLog } from "@/lib/store";
import { useStones } from "@/lib/hooks/useStones";
import { useLocations } from "@/lib/hooks/useLocations";
import { useLogs } from "@/lib/hooks/useLogs";
import logo from "@/assets/logo.png";

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <motion.div variants={fadeUp} className="glass-card rounded-xl p-4 flex items-center gap-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
      </div>
    </motion.div>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <Link to={to} className="glass-card rounded-xl p-3 flex flex-col items-center gap-2 hover:shadow-md transition-shadow text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </Link>
  );
}

function StoneCard({ stone }: { stone: StoneItem }) {
  const isLow = stone.quantity <= 5;
  return (
    <Link to={`/inventory?search=${encodeURIComponent(stone.name)}`} className="glass-card rounded-xl p-4 flex items-center justify-between gap-3 hover:shadow-md transition-shadow">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground text-sm truncate">{stone.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{stone.size} · {stone.packing}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`font-display font-bold text-lg ${isLow ? "text-destructive" : "text-foreground"}`}>{stone.quantity}</p>
        <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{stone.location}</span>
      </div>
    </Link>
  );
}

function LogEntry({ log }: { log: StockLog }) {
  const time = new Date(log.timestamp);
  const rel = getRelativeTime(time);
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground mt-0.5">
        <Clock className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground"><span className="font-semibold">{log.stoneName}</span> — {log.field} updated</p>
        <p className="text-xs text-muted-foreground mt-0.5">{log.oldValue ? `${log.oldValue} → ${log.newValue}` : log.newValue} · {rel}</p>
      </div>
    </div>
  );
}

function getRelativeTime(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function HomePage() {
  const { data: stones = [] } = useStones();
  const { data: locations = [] } = useLocations();
  const { data: logs = [] } = useLogs(8);

  const active = stones.filter(s => s.status === "active");
  const totalQty = active.reduce((a, s) => a + s.quantity, 0);
  const lowStock = active.filter(s => s.quantity <= 5);
  const recent = active.slice(0, 5);

  return (
    <AppLayout>
      {/* Hero */}
      <section className="hero-bg px-5 pt-8 pb-10 md:px-10 md:pt-12 md:pb-14 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <motion.div initial="hidden" animate="visible" variants={stagger} className="relative max-w-4xl">
          <motion.div variants={fadeUp} className="flex items-center gap-3 mb-4 md:hidden">
            <img src={logo} alt="SSC" className="h-10 w-10 rounded-lg" />
          </motion.div>
          <motion.h1 variants={fadeUp} className="font-display text-2xl md:text-4xl font-bold text-gradient leading-tight">
            Shree Stone Craft
          </motion.h1>
          <motion.p variants={fadeUp} className="text-sm md:text-base text-gradient/70 mt-2 max-w-lg" style={{ opacity: 0.7, color: "hsl(0 0% 70%)" }}>
            Manage your stone inventory, stock locations, and packing data in one clean system.
          </motion.p>
          <motion.div variants={fadeUp} className="flex gap-3 mt-6">
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg rounded-xl px-5">
              <Link to="/add"><Plus className="h-4 w-4 mr-2" />Add Stone</Link>
            </Button>
            <Button asChild variant="ghost" className="border border-white/20 text-white hover:bg-white/10 rounded-xl px-5">
              <Link to="/inventory"><Package className="h-4 w-4 mr-2" />View Inventory</Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      <div className="px-4 md:px-8 lg:px-10 -mt-6 relative z-10 max-w-7xl mx-auto">
        {/* Stats */}
        <motion.div initial="hidden" animate="visible" variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard label="Total Items" value={active.length} icon={Package} color="bg-accent/10 text-accent" />
          <StatCard label="Total Qty" value={totalQty.toLocaleString()} icon={TrendingUp} color="bg-success/10 text-success" />
          <StatCard label="Locations" value={locations.length} icon={MapPin} color="bg-primary/10 text-primary" />
          <StatCard label="Low Stock" value={lowStock.length} icon={AlertTriangle} color="bg-warning/10 text-warning" />
        </motion.div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground mb-3">Quick Actions</h2>
              <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                <QuickAction to="/add" icon={Plus} label="Add Stone" />
                <QuickAction to="/inventory" icon={Search} label="Search" />
                <QuickAction to="/inventory" icon={Package} label="Update Qty" />
                <QuickAction to="/locations" icon={MapPin} label="Locations" />
              </div>
            </div>

            {/* Inventory Preview */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-lg font-semibold text-foreground">Recent Inventory</h2>
                <Link to="/inventory" className="text-xs text-accent font-medium flex items-center gap-1 hover:underline">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {recent.length > 0 ? recent.map(s => <StoneCard key={s.id} stone={s} />) : (
                  <div className="glass-card rounded-xl p-8 text-center">
                    <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No inventory items yet.</p>
                    <Button asChild className="mt-3 bg-accent text-accent-foreground rounded-xl" size="sm">
                      <Link to="/add">Add your first stone</Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Low Stock Alerts */}
            {lowStock.length > 0 && (
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" /> Low Stock Alerts
                </h2>
                <div className="space-y-2">
                  {lowStock.slice(0, 4).map(s => (
                    <div key={s.id} className="glass-card rounded-xl p-3 flex items-center justify-between border-l-4 border-l-warning">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.location}</p>
                      </div>
                      <span className="font-display font-bold text-destructive text-lg">{s.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar: Activity */}
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">Recent Activity</h2>
            <div className="glass-card rounded-xl p-4">
              {logs.length > 0 ? (
                <div className="divide-y divide-border">
                  {logs.slice(0, 8).map(l => <LogEntry key={l.id} log={l} />)}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="h-8" />
    </AppLayout>
  );
}
