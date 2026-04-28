import { useState } from "react";
import { Package, MapPin, Loader2, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppLayout from "@/components/layout/AppLayout";
import { useStones } from "@/lib/hooks/useStones";
import { useLocations, useSaveLocations } from "@/lib/hooks/useLocations";
import { toast } from "sonner";

export default function LocationsPage() {
  const { data: stones = [], isLoading: stonesLoading } = useStones();
  const { data: locations = [], isLoading: locsLoading } = useLocations();
  const saveLocations = useSaveLocations();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const active = stones.filter(s => s.status === "active");
  const isLoading = stonesLoading || locsLoading;

  function handleAdd() {
    const name = newName.trim();
    if (!name) { toast.error("Name required"); return; }
    if (locations.includes(name)) { toast.error("That location already exists"); return; }
    saveLocations.mutate([...locations, name], {
      onSuccess: () => { setAdding(false); setNewName(""); toast.success(`Added "${name}"`); },
      onError: (e) => toast.error(`Add failed: ${(e as Error).message}`),
    });
  }

  function handleRename(idx: number) {
    const name = editName.trim();
    if (!name) { toast.error("Name required"); return; }
    if (name === locations[idx]) { setEditingIdx(null); return; }
    if (locations.includes(name)) { toast.error("That name already exists"); return; }
    const next = [...locations];
    next[idx] = name;
    saveLocations.mutate(next, {
      onSuccess: () => { setEditingIdx(null); toast.success("Renamed"); },
      onError: (e) => toast.error(`Rename failed: ${(e as Error).message}`),
    });
  }

  function handleDelete(name: string) {
    const itemsHere = active.filter(s => s.location === name).length;
    const msg = itemsHere > 0
      ? `"${name}" has ${itemsHere} item${itemsHere === 1 ? "" : "s"}. Delete anyway? Items will lose their location.`
      : `Delete "${name}"?`;
    if (!confirm(msg)) return;
    saveLocations.mutate(locations.filter(l => l !== name), {
      onSuccess: () => toast.success("Location deleted"),
      onError: (e) => toast.error(`Delete failed: ${(e as Error).message}`),
    });
  }

  return (
    <AppLayout>
      <div className="px-4 md:px-8 lg:px-10 py-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-xl md:text-2xl font-bold text-foreground">Locations</h1>
          {!adding && (
            <Button onClick={() => setAdding(true)} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl">
              <Plus className="h-4 w-4 mr-1" />Add Location
            </Button>
          )}
        </div>

        {/* Add form */}
        {adding && (
          <div className="glass-card rounded-xl p-4 mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-accent flex-shrink-0" />
            <Input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
              placeholder="e.g. Dukaan 4th Line"
              className="rounded-xl h-9"
            />
            <Button size="sm" onClick={handleAdd} disabled={saveLocations.isPending} className="bg-accent text-accent-foreground rounded-xl">
              {saveLocations.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName(""); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map((loc, idx) => {
              const items = active.filter(s => s.location === loc);
              const totalQty = items.reduce((a, s) => a + s.quantity, 0);
              const lowCount = items.filter(s => s.quantity <= 5).length;
              const isEditing = editingIdx === idx;

              return (
                <div key={loc} className="glass-card rounded-xl p-5 group">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent flex-shrink-0">
                      <MapPin className="h-5 w-5" />
                    </span>
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-1">
                        <Input
                          autoFocus
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleRename(idx); if (e.key === "Escape") setEditingIdx(null); }}
                          className="rounded-lg h-8 text-sm font-medium"
                        />
                        <button onClick={() => handleRename(idx)} className="p-1.5 rounded-lg hover:bg-secondary text-success" title="Save">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingIdx(null)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground" title="Cancel">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h2 className="font-display font-semibold text-foreground flex-1 truncate">{loc}</h2>
                        <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity">
                          <button
                            onClick={() => { setEditingIdx(idx); setEditName(loc); }}
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(loc)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
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
            {locations.length === 0 && !adding && (
              <div className="glass-card rounded-xl p-10 text-center col-span-full">
                <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No locations yet.</p>
                <Button onClick={() => setAdding(true)} className="mt-4 bg-accent text-accent-foreground rounded-xl" size="sm">
                  Add First Location
                </Button>
              </div>
            )}
          </div>
        )}

      </div>
    </AppLayout>
  );
}
