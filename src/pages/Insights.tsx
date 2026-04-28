import { useMemo } from "react";
import { BarChart3, Package, MapPin, Tag, Loader2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useStones } from "@/lib/hooks/useStones";
import { useLocations } from "@/lib/hooks/useLocations";

export default function InsightsPage() {
  const { data: stones = [], isLoading } = useStones();
  const { data: locations = [] } = useLocations();

  const active = useMemo(() => stones.filter(s => s.status === "active"), [stones]);
  const totalQty = active.reduce((a, s) => a + s.quantity, 0);
  const lowStock = active.filter(s => s.quantity <= 5).length;
  const incomplete = active.filter(s => !s.size || !s.packing).length;

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

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    active.forEach(s => { if (s.category) map[s.category] = (map[s.category] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [active]);

  const maxLocQty = Math.max(...byLocation.map(([, v]) => v.qty), 1);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 md:px-8 lg:px-10 py-6 max-w-7xl mx-auto">
        <h1 className="font-display text-xl md:text-2xl font-bold text-foreground mb-6">Insights</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total Items", value: active.length, icon: Package, color: "bg-accent/10 text-accent" },
            { label: "Total Quantity", value: totalQty.toLocaleString(), icon: BarChart3, color: "bg-success/10 text-success" },
            { label: "Low Stock", value: lowStock, icon: Package, color: "bg-warning/10 text-warning" },
            { label: "Incomplete", value: incomplete, icon: Tag, color: "bg-destructive/10 text-destructive" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass-card rounded-xl p-4 flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></span>
              <div>
                <p className="text-xl font-display font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2"><MapPin className="h-4 w-4 text-accent" />Stock by Location</h2>
            <div className="space-y-3">
              {byLocation.map(([loc, { count, qty }]) => (
                <div key={loc}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground font-medium">{loc}</span>
                    <span className="text-muted-foreground text-xs">{count} items · {qty} qty</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(qty / maxLocQty) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-xl p-5">
            <h2 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2"><Tag className="h-4 w-4 text-accent" />Items by Category</h2>
            <div className="space-y-2">
              {byCategory.map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-foreground">{cat}</span>
                  <span className="text-sm font-display font-bold text-foreground">{count}</span>
                </div>
              ))}
              {byCategory.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
