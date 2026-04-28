import { Package, MapPin, Loader2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useStones } from "@/lib/hooks/useStones";
import { useLocations } from "@/lib/hooks/useLocations";

export default function LocationsPage() {
  const { data: stones = [], isLoading: stonesLoading } = useStones();
  const { data: locations = [], isLoading: locsLoading } = useLocations();

  const active = stones.filter(s => s.status === "active");
  const isLoading = stonesLoading || locsLoading;

  return (
    <AppLayout>
      <div className="px-4 md:px-8 lg:px-10 py-6 max-w-7xl mx-auto">
        <h1 className="font-display text-xl md:text-2xl font-bold text-foreground mb-6">Locations</h1>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map(loc => {
              const items = active.filter(s => s.location === loc);
              const totalQty = items.reduce((a, s) => a + s.quantity, 0);
              const lowCount = items.filter(s => s.quantity <= 5).length;
              return (
                <div key={loc} className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <MapPin className="h-5 w-5" />
                    </span>
                    <h2 className="font-display font-semibold text-foreground">{loc}</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-display font-bold text-foreground">{items.length}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">Items</p>
                    </div>
                    <div>
                      <p className="text-lg font-display font-bold text-foreground">{totalQty}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">Total Qty</p>
                    </div>
                    <div>
                      <p className={`text-lg font-display font-bold ${lowCount > 0 ? "text-warning" : "text-success"}`}>{lowCount}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">Low Stock</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {locations.length === 0 && (
              <div className="glass-card rounded-xl p-10 text-center col-span-full">
                <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No locations set up yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
