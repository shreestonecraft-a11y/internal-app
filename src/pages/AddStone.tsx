import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Plus, ImagePlus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AppLayout from "@/components/layout/AppLayout";
import { uploadStoneImage } from "@/lib/store";
import { useAddStone, useStones } from "@/lib/hooks/useStones";
import { useLocations } from "@/lib/hooks/useLocations";
import { toast } from "sonner";

async function compressImage(file: File, maxDim = 1200): Promise<File> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const blob: Blob = await new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      c.toBlob(b => res(b!), "image/jpeg", 0.85);
    };
    img.onerror = () => res(file);
    img.src = dataUrl;
  });
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

export default function AddStonePage() {
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: locations = [] } = useLocations();
  const { data: stones = [] } = useStones();
  const addStone = useAddStone();
  const [form, setForm] = useState({
    name: "", size: "", packing: "", quantity: "", location: "", notes: "", image: "",
  });
  const [uploading, setUploading] = useState(false);

  function set(key: string, val: string) { setForm(f => ({ ...f, [key]: val })); }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("Image too large (max 10MB)"); return; }
    setUploading(true);
    try {
      const compressed = await compressImage(f);
      const url = await uploadStoneImage(compressed);
      set("image", url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(`Upload failed: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  function handleSave(addAnother = false) {
    if (!form.name.trim()) { toast.error("Stone name is required"); return; }
    if (!form.location) { toast.error("Select a location"); return; }

    const existing = stones.find(s => s.name.toLowerCase() === form.name.trim().toLowerCase() && s.status === "active");
    if (existing) { toast.warning(`"${form.name}" already exists at ${existing.location}. Consider updating instead.`); }

    addStone.mutate({
      name: form.name.trim(),
      size: form.size.trim(),
      packing: form.packing.trim(),
      quantity: parseInt(form.quantity) || 0,
      location: form.location,
      category: "",
      variant: "",
      notes: form.notes.trim(),
      sku: "",
      image: form.image || undefined,
    }, {
      onSuccess: () => {
        toast.success(`${form.name} added`);
        if (addAnother) {
          setForm({ name: "", size: "", packing: "", quantity: "", location: form.location, notes: "", image: "" });
        } else {
          nav("/inventory");
        }
      },
      onError: (e) => toast.error(`Save failed: ${(e as Error).message}`),
    });
  }

  const saving = addStone.isPending;

  return (
    <AppLayout>
      <div className="px-4 md:px-8 lg:px-10 py-6 max-w-2xl mx-auto">
        <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="font-display text-xl md:text-2xl font-bold text-foreground mb-6">Add New Stone</h1>

        <div className="space-y-5">
          {/* Image */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Stone Image</Label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            {form.image ? (
              <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-border">
                <img src={form.image} alt="preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => set("image", "")}
                  className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/70 text-white flex items-center justify-center"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-40 h-40 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-secondary/50 hover:border-accent transition disabled:opacity-50"
              >
                {uploading ? (
                  <><Loader2 className="h-7 w-7 animate-spin" /><span className="text-xs font-medium">Uploading…</span></>
                ) : (
                  <><ImagePlus className="h-7 w-7" /><span className="text-xs font-medium">Upload Image</span></>
                )}
              </button>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Stone Name *</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Mint Sandstone" className="rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Size</Label>
              <Input value={form.size} onChange={e => set("size", e.target.value)} placeholder="e.g. 24x24" className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Packing</Label>
              <Input value={form.packing} onChange={e => set("packing", e.target.value)} placeholder="e.g. 10 Sqft/box" className="rounded-xl" />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Quantity</Label>
            <Input type="number" inputMode="numeric" value={form.quantity} onChange={e => set("quantity", e.target.value)} placeholder="0" className="rounded-xl" />
          </div>

          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Location *</Label>
            <Select value={form.location} onValueChange={v => set("location", v)}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>
                {locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Optional remarks" className="rounded-xl min-h-[80px]" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={() => handleSave(false)} disabled={saving || uploading} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving || uploading} variant="outline" className="rounded-xl">
              <Plus className="h-4 w-4 mr-2" />Save & Add More
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
