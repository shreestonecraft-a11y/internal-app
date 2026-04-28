import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Plus, Filter, Package, Edit2, Trash2, X, ImageIcon, Loader2, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AppLayout from "@/components/layout/AppLayout";
import QtyControls from "@/components/QtyControls";
import { StoneItem, CATEGORIES } from "@/lib/store";
import { useStones, useUpdateStone, useDeleteStone } from "@/lib/hooks/useStones";
import { useLocations } from "@/lib/hooks/useLocations";
import { parseSearchQuery } from "@/lib/searchQuery";
import { toast } from "sonner";

function Thumb({ src, name, size = "h-12 w-12" }: { src?: string; name: string; size?: string }) {
  if (src) return <img src={src} alt={name} className={`${size} rounded-lg object-cover border border-border flex-shrink-0`} />;
  return (
    <div className={`${size} rounded-lg bg-secondary flex items-center justify-center flex-shrink-0`}>
      <ImageIcon className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

export default function InventoryPage() {
  const [searchParams] = useSearchParams();
  const { data: stones = [], isLoading } = useStones();
  const { data: locations = [] } = useLocations();
  const updateStone = useUpdateStone();
  const deleteStone = useDeleteStone();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [filterLoc, setFilterLoc] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [sortBy, setSortBy] = useState<"recent" | "name-asc" | "qty-asc" | "qty-desc" | "qty-low-only" | "qty-high-only">("recent");
  const [editItem, setEditItem] = useState<StoneItem | null>(null);
  const [editQty, setEditQty] = useState("");

  const parsed = useMemo(() => parseSearchQuery(search), [search]);

  const filtered = useMemo(() => {
    let res = stones.filter(s => s.status === "active");
    if (parsed.min !== null) res = res.filter(s => s.quantity >= parsed.min!);
    if (parsed.text) {
      const q = parsed.text.toLowerCase();
      res = res.filter(s =>
        s.name.toLowerCase().includes(q) || s.size.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) ||
        s.sku.toLowerCase().includes(q)
      );
    }
    if (filterLoc !== "all") res = res.filter(s => s.location === filterLoc);
    if (filterCat !== "all") res = res.filter(s => s.category === filterCat);

    // Quantity-based filters
    if (sortBy === "qty-low-only") res = res.filter(s => s.quantity <= 5);
    if (sortBy === "qty-high-only") res = res.filter(s => s.quantity >= 100);

    // Sorting
    const sorted = [...res];
    if (sortBy === "name-asc") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "qty-asc") sorted.sort((a, b) => a.quantity - b.quantity);
    else if (sortBy === "qty-desc") sorted.sort((a, b) => b.quantity - a.quantity);
    return sorted;
  }, [stones, parsed, filterLoc, filterCat, sortBy]);

  function commitQty(id: string, newQ: number) {
    const s = stones.find(x => x.id === id);
    if (!s || s.quantity === newQ) return;
    updateStone.mutate({ id, updates: { quantity: newQ } }, {
      onSuccess: () => toast.success(`${s.name} → ${newQ}`),
      onError: (e) => toast.error(`Update failed: ${(e as Error).message}`),
    });
  }

  function handleSetQty() {
    if (!editItem) return;
    const q = parseInt(editQty);
    if (isNaN(q) || q < 0) { toast.error("Invalid quantity"); return; }
    updateStone.mutate({ id: editItem.id, updates: { quantity: q } }, {
      onSuccess: () => { setEditItem(null); toast.success("Quantity updated"); },
      onError: (e) => toast.error(`Update failed: ${(e as Error).message}`),
    });
  }

  function handleDelete(id: string) {
    deleteStone.mutate(id, {
      onSuccess: () => toast.success("Item deleted"),
      onError: (e) => toast.error(`Delete failed: ${(e as Error).message}`),
    });
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 md:px-8 lg:px-10 py-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-xl md:text-2xl font-bold text-foreground">Inventory</h1>
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl" size="sm">
            <Link to="/add"><Plus className="h-4 w-4 mr-1" />Add</Link>
          </Button>
        </div>

        {/* Search & Filter */}
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder='Search e.g. "mint" or "100sft" for ≥100 stock'
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 rounded-xl bg-card border-border"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Select value={filterLoc} onValueChange={setFilterLoc}>
              <SelectTrigger className="w-40 rounded-xl text-xs h-9 flex-shrink-0"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-36 rounded-xl text-xs h-9 flex-shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-44 rounded-xl text-xs h-9 flex-shrink-0"><ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently added</SelectItem>
                <SelectItem value="name-asc">Name: A → Z</SelectItem>
                <SelectItem value="qty-asc">Quantity: Low → High</SelectItem>
                <SelectItem value="qty-desc">Quantity: High → Low</SelectItem>
                <SelectItem value="qty-high-only">Show 100+ stock only</SelectItem>
                <SelectItem value="qty-low-only">Show low stock only (≤5)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs text-muted-foreground">{filtered.length} items</p>
          {parsed.min !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">
              ≥ {parsed.min} sft
              <button onClick={() => setSearch(parsed.text)} className="hover:opacity-70"><X className="h-3 w-3" /></button>
            </span>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="glass-card rounded-xl p-10 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No items found.</p>
            <Button asChild className="mt-4 bg-accent text-accent-foreground rounded-xl" size="sm">
              <Link to="/add">Add Stone</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block glass-card rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-16"></th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Stone</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Size</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Packing</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Qty</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Location</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Category</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(s => (
                    <tr key={s.id} className="hover:bg-secondary/30 transition-colors group">
                      <td className="px-4 py-2"><Thumb src={s.image} name={s.name} /></td>
                      <td className="px-4 py-3 font-semibold text-foreground">{s.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.size}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.packing}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end">
                          <QtyControls quantity={s.quantity} onCommit={(q) => commitQty(s.id, q)} />
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">{s.location}</span></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{s.category}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditItem(s); setEditQty(String(s.quantity)); }} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {filtered.map(s => (
                <div key={s.id} className="glass-card rounded-xl p-3 flex gap-3">
                  <Thumb src={s.image} name={s.name} size="h-16 w-16" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground text-sm truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.size} · {s.packing} · {s.category}</p>
                      </div>
                      <button onClick={() => { setEditItem(s); setEditQty(String(s.quantity)); }} className="p-1.5 text-muted-foreground">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">{s.location}</span>
                      <QtyControls quantity={s.quantity} onCommit={(q) => commitQty(s.id, q)} size="md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Update Quantity</DialogTitle>
          </DialogHeader>
          {editItem && (
            <form onSubmit={(e) => { e.preventDefault(); handleSetQty(); }} className="space-y-4">
              <p className="text-sm text-muted-foreground">{editItem.name} — {editItem.size}</p>
              <Input
                type="number"
                inputMode="numeric"
                value={editQty}
                onChange={e => setEditQty(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSetQty(); } }}
                className="rounded-xl text-center text-lg font-display font-bold"
                autoFocus
              />
              <div className="grid grid-cols-4 gap-2">
                {[1, 10, 50, 100].map(n => (
                  <Button key={n} type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setEditQty(String(Math.max(0, parseInt(editQty || "0") + n)))}>+{n}</Button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[-1, -10, -50].map(n => (
                  <Button key={n} type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setEditQty(String(Math.max(0, parseInt(editQty || "0") + n)))}>{n}</Button>
                ))}
              </div>
              <Button type="submit" disabled={updateStone.isPending} className="w-full bg-accent text-accent-foreground rounded-xl">
                {updateStone.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Save
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
