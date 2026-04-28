import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Package, MapPin, Tag, Loader2, TrendingUp, Truck, Clock, ChevronRight, Send } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import AppLayout from "@/components/layout/AppLayout";
import { useStones } from "@/lib/hooks/useStones";
import { useLocations } from "@/lib/hooks/useLocations";
import { useInvoices } from "@/lib/hooks/useInvoices";
import { useLogs } from "@/lib/hooks/useLogs";

interface ClickableStat {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  to?: string;
  hint?: string;
}

function StatCard({ s }: { s: ClickableStat }) {
  const navigate = useNavigate();
  const Tag = s.to ? "button" : "div";
  return (
    <Tag
      type={s.to ? "button" : undefined}
      onClick={s.to ? () => navigate(s.to!) : undefined}
      className={`glass-card rounded-xl p-4 flex items-center gap-3 w-full text-left ${s.to ? "hover:shadow-md hover:border-accent/30 transition-all cursor-pointer" : ""}`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0 ${s.color}`}>
        <s.icon className="h-5 w-5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xl font-display font-bold text-foreground">{s.value}</p>
        <p className="text-xs text-muted-foreground truncate">{s.label}</p>
        {s.hint && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{s.hint}</p>}
      </div>
      {s.to && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
    </Tag>
  );
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function monthLabel(d: Date) { return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }); }
function daysSince(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }

export default function InsightsPage() {
  const navigate = useNavigate();
  const { data: stones = [], isLoading: stonesLoading } = useStones();
  const { data: locations = [] } = useLocations();
  const { data: invoices = [] } = useInvoices();
  const { data: logs = [] } = useLogs(500);

  const active = useMemo(() => stones.filter(s => s.status === "active"), [stones]);
  const totalQty = active.reduce((a, s) => a + s.quantity, 0);
  const lowStock = active.filter(s => s.quantity <= 5).length;
  const incomplete = active.filter(s => !s.size || !s.packing).length;

  // ---- Dispatched this month ----
  const thisMonthStart = useMemo(() => startOfMonth(new Date()), []);
  const dispatchThisMonth = useMemo(() => {
    const filtered = invoices.filter(i => new Date(i.date) >= thisMonthStart);
    const qty = filtered.reduce((a, i) => a + i.items.reduce((b, it) => b + it.quantity, 0), 0);
    return { count: filtered.length, qty };
  }, [invoices, thisMonthStart]);

  // ---- Last 6 months trend ----
  const monthly = useMemo(() => {
    const months: { label: string; qty: number; count: number; ym: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${d.getMonth()}`;
      months.push({ label: monthLabel(d), ym, qty: 0, count: 0 });
    }
    invoices.forEach(inv => {
      const d = new Date(inv.date);
      const ym = `${d.getFullYear()}-${d.getMonth()}`;
      const slot = months.find(m => m.ym === ym);
      if (slot) {
        slot.qty += inv.items.reduce((a, it) => a + it.quantity, 0);
        slot.count += 1;
      }
    });
    return months;
  }, [invoices]);

  // ---- Top dispatched items (by qty) ----
  const topDispatched = useMemo(() => {
    const map: Record<string, { name: string; qty: number; count: number; stoneId?: string }> = {};
    invoices.forEach(inv => {
      inv.items.forEach(it => {
        const key = it.stoneId || it.name;
        if (!map[key]) map[key] = { name: it.name, qty: 0, count: 0, stoneId: it.stoneId };
        map[key].qty += it.quantity;
        map[key].count += 1;
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [invoices]);

  // ---- Slow movers: stones with no log activity in 30+ days ----
  const slowMovers = useMemo(() => {
    const lastTouch: Record<string, string> = {};
    logs.forEach(l => {
      if (!l.stoneId) return;
      if (!lastTouch[l.stoneId] || lastTouch[l.stoneId] < l.timestamp) {
        lastTouch[l.stoneId] = l.timestamp;
      }
    });
    const result = active.map(s => {
      const lastIso = lastTouch[s.id] || s.updatedAt || s.createdAt;
      return { stone: s, days: daysSince(lastIso) };
    });
    return result
      .filter(r => r.days >= 30 && r.stone.quantity > 0)
      .sort((a, b) => b.days - a.days)
      .slice(0, 10);
  }, [active, logs]);

  // ---- Stock by location ----
  const byLocation = useMemo(() => {
    const map: Record<string, { count: number; qty: number }> = {};
    locations.forEach(l => map[l] = { count: 0, qty: 0 });
    active.forEach(s => {
      if (!map[s.location]) map[s.location] = { count: 0, qty: 0 };
      map[s.location].count++;
      map[s.location].qty += s.quantity;
    });
    return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
  }, [active, locations]);

  const maxLocQty = Math.max(...byLocation.map(([, v]) => v.qty), 1);

  // ---- Items by category ----
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    active.forEach(s => {
      const cat = s.category?.trim() || "Uncategorized";
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [active]);

  if (stonesLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  const stats: ClickableStat[] = [
    { label: "Total Items", value: active.length, icon: Package, color: "bg-accent/10 text-accent", to: "/inventory" },
    { label: "Total Quantity", value: totalQty.toLocaleString(), icon: BarChart3, color: "bg-success/10 text-success" },
    { label: "Low Stock (≤5)", value: lowStock, icon: Package, color: "bg-warning/10 text-warning", to: "/inventory?filter=lowStock" },
    { label: "Incomplete", value: incomplete, icon: Tag, color: "bg-destructive/10 text-destructive", to: "/inventory?filter=incomplete", hint: "Missing size or packing" },
  ];

  return (
    <AppLayout>
      <div className="px-4 md:px-8 lg:px-10 py-6 max-w-7xl mx-auto space-y-6">
        <h1 className="font-display text-xl md:text-2xl font-bold text-foreground">Insights</h1>

        {/* Top stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(s => <StatCard key={s.label} s={s} />)}
        </div>

        {/* Dispatch summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate("/invoices")}
            className="glass-card rounded-xl p-5 text-left hover:shadow-md hover:border-accent/30 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Truck className="h-5 w-5" />
              </span>
              <h2 className="font-display text-base font-semibold text-foreground">Dispatched This Month</h2>
            </div>
            <div className="flex items-baseline gap-3 mt-3">
              <p className="text-3xl font-display font-bold text-foreground">{dispatchThisMonth.qty.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">across {dispatchThisMonth.count} note{dispatchThisMonth.count !== 1 ? "s" : ""}</p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Tap to view all dispatch notes</p>
          </button>

          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                <TrendingUp className="h-5 w-5" />
              </span>
              <h2 className="font-display text-base font-semibold text-foreground">All-Time Dispatched</h2>
            </div>
            <div className="flex items-baseline gap-3 mt-3">
              <p className="text-3xl font-display font-bold text-foreground">
                {invoices.reduce((a, i) => a + i.items.reduce((b, it) => b + it.quantity, 0), 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">across {invoices.length} note{invoices.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>

        {/* Month-over-month trend */}
        <div className="glass-card rounded-xl p-5">
          <h2 className="font-display text-base font-semibold text-foreground mb-1 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-accent" />Dispatch Trend — Last 6 Months
          </h2>
          <p className="text-xs text-muted-foreground mb-4">Total quantity dispatched per month.</p>
          {invoices.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No dispatch notes yet — once you create some, the trend appears here.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--accent) / 0.1)" }}
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                    formatter={(v: number) => [`${v.toLocaleString()} qty`, "Dispatched"]}
                  />
                  <Bar dataKey="qty" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top dispatched + Slow movers — side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top dispatched */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-display text-base font-semibold text-foreground mb-1 flex items-center gap-2">
              <Send className="h-4 w-4 text-accent" />Top Dispatched Items
            </h2>
            <p className="text-xs text-muted-foreground mb-4">Most-moved stones by total qty.</p>
            {topDispatched.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No dispatches yet.</p>
            ) : (
              <div className="space-y-2">
                {topDispatched.map((d, i) => (
                  <div key={d.name + i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-bold flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{d.name}</p>
                      <p className="text-[11px] text-muted-foreground">{d.count} dispatch{d.count !== 1 ? "es" : ""}</p>
                    </div>
                    <span className="font-display font-bold text-foreground flex-shrink-0">{d.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Slow movers */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-display text-base font-semibold text-foreground mb-1 flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />Slow Movers
            </h2>
            <p className="text-xs text-muted-foreground mb-4">Stones with no activity in 30+ days.</p>
            {slowMovers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">All your stock is moving — nice.</p>
            ) : (
              <div className="space-y-2">
                {slowMovers.map(({ stone, days }) => (
                  <button
                    key={stone.id}
                    onClick={() => navigate(`/inventory?search=${encodeURIComponent(stone.name)}`)}
                    className="w-full flex items-center gap-3 py-2 border-b border-border last:border-0 hover:bg-secondary/40 rounded-lg px-2 -mx-2 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{stone.name}</p>
                      <p className="text-[11px] text-muted-foreground">{stone.location} · stock {stone.quantity}</p>
                    </div>
                    <span className="text-xs font-medium text-warning bg-warning/10 px-2 py-1 rounded-full flex-shrink-0">{days}d</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stock by location — clickable */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" />Stock by Location
            </h2>
            <div className="space-y-3">
              {byLocation.map(([loc, { count, qty }]) => (
                <button
                  key={loc}
                  onClick={() => navigate(`/inventory?location=${encodeURIComponent(loc)}`)}
                  className="block w-full text-left hover:bg-secondary/40 rounded-lg p-2 -mx-2 transition-colors"
                >
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground font-medium">{loc}</span>
                    <span className="text-muted-foreground text-xs">{count} items · {qty} qty</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(qty / maxLocQty) * 100}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Items by category */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Tag className="h-4 w-4 text-accent" />Items by Category
            </h2>
            <div className="space-y-1">
              {byCategory.map(([cat, count]) => (
                <button
                  key={cat}
                  onClick={() => cat !== "Uncategorized" && navigate(`/inventory?category=${encodeURIComponent(cat)}`)}
                  disabled={cat === "Uncategorized"}
                  className="w-full flex items-center justify-between py-2 border-b border-border last:border-0 text-left hover:bg-secondary/40 rounded-lg px-2 -mx-2 disabled:opacity-60 disabled:cursor-default"
                >
                  <span className="text-sm text-foreground">{cat}</span>
                  <span className="text-sm font-display font-bold text-foreground">{count}</span>
                </button>
              ))}
              {byCategory.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
