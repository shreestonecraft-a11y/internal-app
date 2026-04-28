import { useState, useEffect, useMemo } from "react";
import { Plus, FileText, Download, Trash2, X, Search, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import AppLayout from "@/components/layout/AppLayout";
import { InvoiceLineItem, StoneItem } from "@/lib/store";
import {
  useInvoices, useCreateInvoice, useDeleteInvoice, useNextInvoiceNumber,
} from "@/lib/hooks/useInvoices";
import { useStones } from "@/lib/hooks/useStones";
import { useBusinessSettings } from "@/lib/hooks/useBusinessSettings";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import { parseSearchQuery } from "@/lib/searchQuery";
import { toast } from "sonner";

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function InvoicesPage() {
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: settings } = useBusinessSettings();
  const deleteInvoice = useDeleteInvoice();
  const [open, setOpen] = useState(false);

  function handleDelete(id: string) {
    if (!confirm("Delete this invoice? Stock already deducted will not be restored.")) return;
    deleteInvoice.mutate(id, {
      onSuccess: () => toast.success("Invoice deleted"),
      onError: (e) => toast.error(`Delete failed: ${(e as Error).message}`),
    });
  }

  return (
    <AppLayout>
      <div className="px-4 md:px-8 lg:px-10 py-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-xl md:text-2xl font-bold text-foreground">Invoices</h1>
            <p className="text-xs text-muted-foreground mt-1">{invoices.length} total</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl" size="sm">
            <Plus className="h-4 w-4 mr-1" />New Invoice
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : invoices.length === 0 ? (
          <div className="glass-card rounded-xl p-10 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No invoices yet.</p>
            <Button onClick={() => setOpen(true)} className="mt-4 bg-accent text-accent-foreground rounded-xl" size="sm">
              Create First Invoice
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {invoices.map(inv => (
              <div key={inv.id} className="glass-card rounded-xl p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-foreground">{inv.number}</p>
                    <span className="text-xs text-muted-foreground">· {formatDate(inv.date)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {inv.customerName || "Unnamed"} · {inv.items.length} item{inv.items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="font-display font-bold text-foreground">{formatINR(inv.total)}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => downloadInvoicePdf(inv, settings)}
                    className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                    title="Download PDF"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(inv.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewInvoiceDialog open={open} onOpenChange={setOpen} />
    </AppLayout>
  );
}

function NewInvoiceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void; }) {
  const { data: allStones = [] } = useStones();
  const stones = useMemo(() => allStones.filter(s => s.status === "active"), [allStones]);
  const { data: nextNumber } = useNextInvoiceNumber(open);
  const { data: settings } = useBusinessSettings();
  const createInvoice = useCreateInvoice();
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [isInterState, setIsInterState] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const defaultGst = settings?.defaultGstPercent ?? 18;
  const defaultHsn = settings?.defaultHsn ?? "6802";

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10));
      setCustomerName("");
      setCustomerGstin("");
      setCustomerAddress("");
      setIsInterState(false);
      setNotes("");
      setItems([]);
    }
  }, [open]);

  useEffect(() => { if (nextNumber) setNumber(nextNumber); }, [nextNumber]);

  const subtotal = useMemo(() => items.reduce((s, it) => s + it.quantity * it.rate, 0), [items]);
  const taxTotal = useMemo(() =>
    items.reduce((s, it) => s + (it.quantity * it.rate) * (it.gstPercent / 100), 0),
    [items]
  );
  const grandTotal = subtotal + taxTotal;

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
      rate: 0,
      hsnCode: defaultHsn,
      gstPercent: defaultGst,
      image: s.image,
    }]);
    setPickerOpen(false);
    setPickerSearch("");
  }

  function addCustom() {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      name: "",
      size: "",
      packing: "",
      quantity: 1,
      rate: 0,
      hsnCode: defaultHsn,
      gstPercent: defaultGst,
    }]);
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
    if (items.some(i => !i.name.trim())) { toast.error("Every item needs a name"); return; }
    createInvoice.mutate({
      number: number.trim(),
      date: new Date(date).toISOString(),
      customerName: customerName.trim(),
      customerNotes: notes.trim(),
      customerGstin: customerGstin.trim().toUpperCase(),
      customerAddress: customerAddress.trim(),
      isInterState,
      items,
    }, {
      onSuccess: (created) => {
        toast.success(`${created.number} created · stock updated`);
        onOpenChange(false);
        if (downloadAfter) downloadInvoicePdf(created, settings);
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
      <DialogContent className="rounded-2xl max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />New Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Invoice #</Label>
              <Input value={number} onChange={e => setNumber(e.target.value)} className="rounded-xl font-mono" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Customer Name</Label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Name" className="rounded-xl" />
            </div>
          </div>

          {/* Customer GSTIN + address + state toggle */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Customer GSTIN</Label>
              <Input
                value={customerGstin}
                onChange={e => setCustomerGstin(e.target.value)}
                placeholder="Optional 15-char GSTIN"
                maxLength={15}
                className="rounded-xl font-mono uppercase"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Customer Address</Label>
              <Input
                value={customerAddress}
                onChange={e => setCustomerAddress(e.target.value)}
                placeholder="Optional billing address"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40">
            <div>
              <p className="text-sm font-semibold text-foreground">{isInterState ? "Inter-State" : "Intra-State"} Sale</p>
              <p className="text-xs text-muted-foreground">
                {isInterState ? "Single IGST applied" : "Split into CGST + SGST"}
              </p>
            </div>
            <Switch checked={isInterState} onCheckedChange={setIsInterState} />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold text-muted-foreground">Line Items</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setPickerOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />From Inventory
                </Button>
                <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={addCustom}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Custom
                </Button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
                No items yet. Add from inventory or create a custom line.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map(it => (
                  <div key={it.id} className="border border-border rounded-xl p-3 bg-card">
                    <div className="flex gap-3">
                      {it.image ? (
                        <img src={it.image} alt={it.name} className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 grid grid-cols-12 gap-2">
                        <div className="col-span-12 md:col-span-5">
                          <Input
                            value={it.name}
                            onChange={e => updateItem(it.id, { name: e.target.value })}
                            placeholder="Item name"
                            className="rounded-lg h-9 text-sm font-medium"
                          />
                          <div className="flex gap-2 mt-1">
                            <Input
                              value={it.size}
                              onChange={e => updateItem(it.id, { size: e.target.value })}
                              placeholder="Size"
                              className="rounded-lg h-7 text-xs"
                            />
                            <Input
                              value={it.packing}
                              onChange={e => updateItem(it.id, { packing: e.target.value })}
                              placeholder="Packing"
                              className="rounded-lg h-7 text-xs"
                            />
                          </div>
                          <div className="flex gap-2 mt-1">
                            <Input
                              value={it.hsnCode}
                              onChange={e => updateItem(it.id, { hsnCode: e.target.value })}
                              placeholder="HSN"
                              className="rounded-lg h-7 text-xs font-mono w-24"
                            />
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={it.gstPercent}
                                onChange={e => updateItem(it.id, { gstPercent: Math.max(0, parseFloat(e.target.value) || 0) })}
                                className="rounded-lg h-7 text-xs w-16"
                              />
                              <span className="text-xs text-muted-foreground">% GST</span>
                            </div>
                          </div>
                        </div>
                        <div className="col-span-5 md:col-span-3">
                          <Label className="text-[10px] text-muted-foreground">Quantity</Label>
                          <div className="flex items-center gap-1 mt-0.5">
                            <button type="button" onClick={() => adjustQty(it.id, -1)} className="h-8 w-8 rounded bg-secondary text-foreground text-sm font-bold hover:bg-destructive hover:text-destructive-foreground transition-colors">−</button>
                            <Input
                              type="number"
                              value={it.quantity}
                              onChange={e => updateItem(it.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="rounded-lg h-8 text-center text-sm font-bold w-14 px-1"
                            />
                            <button type="button" onClick={() => adjustQty(it.id, 1)} className="h-8 w-8 rounded bg-secondary text-foreground text-sm font-bold hover:bg-success hover:text-success-foreground transition-colors">+</button>
                          </div>
                        </div>
                        <div className="col-span-4 md:col-span-2">
                          <Label className="text-[10px] text-muted-foreground">Rate</Label>
                          <Input
                            type="number"
                            value={it.rate}
                            onChange={e => updateItem(it.id, { rate: parseFloat(e.target.value) || 0 })}
                            className="rounded-lg h-8 text-sm mt-0.5"
                          />
                        </div>
                        <div className="col-span-3 md:col-span-2 text-right">
                          <Label className="text-[10px] text-muted-foreground">Amount</Label>
                          <p className="font-display font-bold text-sm h-8 flex items-center justify-end">{formatINR(it.quantity * it.rate)}</p>
                          <p className="text-[10px] text-muted-foreground -mt-0.5">+ {formatINR(it.quantity * it.rate * it.gstPercent / 100)} tax</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeItem(it.id)} className="text-muted-foreground hover:text-destructive p-1">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes shown on PDF" className="rounded-xl min-h-[60px]" />
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="rounded-xl border border-border bg-card p-4 min-w-[280px] space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-medium text-foreground">{formatINR(subtotal)}</span>
              </div>
              {isInterState ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>IGST</span>
                  <span className="font-medium text-foreground">{formatINR(taxTotal)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>CGST</span>
                    <span className="font-medium text-foreground">{formatINR(taxTotal / 2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>SGST</span>
                    <span className="font-medium text-foreground">{formatINR(taxTotal / 2)}</span>
                  </div>
                </>
              )}
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between items-center bg-foreground text-background rounded-lg px-3 py-2 -mx-1">
                <span className="text-[11px] uppercase opacity-70 font-semibold">Grand Total</span>
                <span className="font-display font-bold text-xl text-accent">{formatINR(grandTotal)}</span>
              </div>
            </div>
          </div>

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
            <DialogTitle className="font-display">Select from Inventory</DialogTitle>
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
