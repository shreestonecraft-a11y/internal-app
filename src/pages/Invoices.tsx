import { useState, useEffect, useMemo } from "react";
import { Plus, FileText, Download, Trash2, X, Search, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AppLayout from "@/components/layout/AppLayout";
import { Invoice, InvoiceLineItem, StoneItem } from "@/lib/store";
import {
  useInvoices, useCreateInvoice, useDeleteInvoice, useNextInvoiceNumber,
} from "@/lib/hooks/useInvoices";
import { useStones } from "@/lib/hooks/useStones";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import { parseSearchQuery } from "@/lib/searchQuery";
import { toast } from "sonner";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function InvoicesPage() {
  const { data: invoices = [], isLoading } = useInvoices();
  const deleteInvoice = useDeleteInvoice();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Invoice | null>(null);

  function handleDelete(id: string) {
    if (!confirm("Delete this dispatch note? Stock already deducted will not be restored.")) return;
    deleteInvoice.mutate(id, {
      onSuccess: () => toast.success("Deleted"),
      onError: (e) => toast.error(`Delete failed: ${(e as Error).message}`),
    });
  }

  return (
    <AppLayout>
      <div className="px-4 md:px-8 lg:px-10 py-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-xl md:text-2xl font-bold text-foreground">Dispatch Notes</h1>
            <p className="text-xs text-muted-foreground mt-1">{invoices.length} total</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl" size="sm">
            <Plus className="h-4 w-4 mr-1" />New
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : invoices.length === 0 ? (
          <div className="glass-card rounded-xl p-10 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No dispatch notes yet.</p>
            <Button onClick={() => setOpen(true)} className="mt-4 bg-accent text-accent-foreground rounded-xl" size="sm">
              Create First
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {invoices.map(inv => {
              const totalQty = inv.items.reduce((s, it) => s + it.quantity, 0);
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => setViewing(inv)}
                  className="glass-card rounded-xl p-4 flex items-center gap-4 w-full text-left hover:shadow-md hover:border-accent/30 transition-all"
                >
                  <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display font-bold text-foreground">{inv.number}</p>
                      <span className="text-xs text-muted-foreground">· {formatDate(inv.date)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {inv.items.length} item{inv.items.length !== 1 ? "s" : ""} · {totalQty} qty
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); downloadInvoicePdf(inv); }}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); downloadInvoicePdf(inv); } }}
                      className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Download PDF"
                    >
                      <Download className="h-4 w-4" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); handleDelete(inv.id); }}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleDelete(inv.id); } }}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <NewInvoiceDialog open={open} onOpenChange={setOpen} />
      <ViewInvoiceDialog invoice={viewing} onClose={() => setViewing(null)} onDelete={(id) => { handleDelete(id); setViewing(null); }} />
    </AppLayout>
  );
}

function ViewInvoiceDialog({ invoice, onClose, onDelete }: { invoice: Invoice | null; onClose: () => void; onDelete: (id: string) => void; }) {
  if (!invoice) return null;
  const totalQty = invoice.items.reduce((s, it) => s + it.quantity, 0);

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            {invoice.number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Date</p>
              <p className="font-medium text-foreground">{formatDate(invoice.date)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Total Qty</p>
              <p className="font-display font-bold text-foreground text-lg">{totalQty}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Items ({invoice.items.length})</p>
            <div className="space-y-2">
              {invoice.items.map(it => (
                <div key={it.id} className="border border-border rounded-xl p-3 bg-card flex gap-3 items-center">
                  {it.image ? (
                    <img src={it.image} alt={it.name} className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{it.size}{it.packing ? ` · ${it.packing}` : ""}</p>
                  </div>
                  <span className="font-display font-bold text-lg text-foreground flex-shrink-0">{it.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {invoice.notes && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap bg-secondary/40 rounded-lg p-3">{invoice.notes}</p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-border">
            <Button variant="ghost" className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(invoice.id)}>
              <Trash2 className="h-4 w-4 mr-1" />Delete
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={onClose}>Close</Button>
            <Button className="bg-accent text-accent-foreground rounded-xl" onClick={() => downloadInvoicePdf(invoice)}>
              <Download className="h-4 w-4 mr-1" />Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewInvoiceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void; }) {
  const { data: allStones = [] } = useStones();
  const stones = useMemo(() => allStones.filter(s => s.status === "active"), [allStones]);
  const { data: nextNumber } = useNextInvoiceNumber(open);
  const createInvoice = useCreateInvoice();
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10));
      setNotes("");
      setItems([]);
    }
  }, [open]);

  useEffect(() => { if (nextNumber) setNumber(nextNumber); }, [nextNumber]);

  const totalQty = useMemo(() => items.reduce((s, it) => s + it.quantity, 0), [items]);

  function addFromStone(s: StoneItem) {
    if (items.find(it => it.stoneId === s.id)) {
      toast.info("Already added — adjust the quantity instead");
      setPickerOpen(false);
      return;
    }
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      stoneId: s.id,
      name: s.name,
      size: s.size,
      packing: s.packing,
      quantity: 1,
      image: s.image,
    }]);
    setPickerOpen(false);
    setPickerSearch("");
  }

  function updateItem(id: string, patch: Partial<InvoiceLineItem>) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id !== id));
  }

  function adjustQty(id: string, delta: number) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it));
  }

  function handleCreate(downloadAfter: boolean) {
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    createInvoice.mutate({
      number: number.trim(),
      date: new Date(date).toISOString(),
      notes: notes.trim(),
      items,
    }, {
      onSuccess: (created) => {
        toast.success(`${created.number} created · stock updated`);
        onOpenChange(false);
        if (downloadAfter) downloadInvoicePdf(created);
      },
      onError: (e) => toast.error(`Create failed: ${(e as Error).message}`),
    });
  }

  const pickerParsed = useMemo(() => parseSearchQuery(pickerSearch), [pickerSearch]);
  const filteredStones = useMemo(() => {
    let res = stones;
    if (pickerParsed.min !== null) res = res.filter(s => s.quantity >= pickerParsed.min!);
    if (pickerParsed.text) {
      const q = pickerParsed.text.toLowerCase();
      res = res.filter(s =>
        s.name.toLowerCase().includes(q) || s.size.toLowerCase().includes(q) || s.location.toLowerCase().includes(q)
      );
    }
    return res;
  }, [stones, pickerParsed]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />New Dispatch Note
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Note #</Label>
              <Input value={number} onChange={e => setNumber(e.target.value)} className="rounded-xl font-mono" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl" />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold text-muted-foreground">Items</Label>
              <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setPickerOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Pick from Inventory
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
                No items yet. Pick stones from inventory.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map(it => (
                  <div key={it.id} className="border border-border rounded-xl p-3 bg-card flex gap-3 items-center">
                    {it.image ? (
                      <img src={it.image} alt={it.name} className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{it.name}</p>
                      <p className="text-xs text-muted-foreground">{it.size}{it.packing ? ` · ${it.packing}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button type="button" onClick={() => adjustQty(it.id, -1)} className="h-8 w-8 rounded bg-secondary text-foreground text-sm font-bold hover:bg-destructive hover:text-destructive-foreground transition-colors">−</button>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={it.quantity}
                        onChange={e => updateItem(it.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="rounded-lg h-8 text-center text-sm font-bold w-16 px-1"
                      />
                      <button type="button" onClick={() => adjustQty(it.id, 1)} className="h-8 w-8 rounded bg-secondary text-foreground text-sm font-bold hover:bg-success hover:text-success-foreground transition-colors">+</button>
                    </div>
                    <button type="button" onClick={() => removeItem(it.id)} className="text-muted-foreground hover:text-destructive p-1 flex-shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Sent to customer X via Truck Y" className="rounded-xl min-h-[60px]" />
          </div>

          {/* Total qty */}
          {items.length > 0 && (
            <div className="flex justify-end">
              <div className="bg-foreground text-background rounded-xl px-5 py-3 min-w-[200px] flex items-center justify-between gap-4">
                <span className="text-[11px] uppercase opacity-70 font-semibold">Total Qty</span>
                <span className="font-display font-bold text-2xl text-accent">{totalQty}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={createInvoice.isPending}>Cancel</Button>
            <Button variant="outline" className="rounded-xl" onClick={() => handleCreate(false)} disabled={createInvoice.isPending}>
              {createInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Save
            </Button>
            <Button className="bg-accent text-accent-foreground rounded-xl" onClick={() => handleCreate(true)} disabled={createInvoice.isPending}>
              <Download className="h-4 w-4 mr-1" />Save & Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Inventory picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="rounded-2xl max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">Select Stone</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder='Search e.g. "mint" or "100sft" for ≥100 stock'
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
          <div className="overflow-y-auto space-y-1 -mx-2 px-2">
            {filteredStones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No stones found.</p>
            ) : filteredStones.map(s => (
              <button
                key={s.id}
                onClick={() => addFromStone(s)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary text-left"
              >
                {s.image ? (
                  <img src={s.image} alt={s.name} className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.size} · {s.location} · stock {s.quantity}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
