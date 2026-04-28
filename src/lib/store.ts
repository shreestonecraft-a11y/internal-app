import { supabase } from './supabase';

// =========================================
// Types (kept stable so pages don't break)
// =========================================
export interface StoneItem {
  id: string;
  name: string;
  size: string;
  packing: string;
  quantity: number;
  location: string;       // location name (joined for convenience)
  location_id: string | null;
  category: string;
  variant: string;
  status: 'active' | 'archived';
  notes: string;
  sku: string;
  image?: string;         // public URL from storage
  createdAt: string;
  updatedAt: string;
}

export interface StockLog {
  id: string;
  stoneId: string | null;
  stoneName: string;
  field: string;
  oldValue: string;
  newValue: string;
  timestamp: string;
}

export interface InvoiceLineItem {
  id: string;
  stoneId?: string;
  name: string;
  size: string;
  packing: string;
  quantity: number;
  rate: number;
  hsnCode: string;
  gstPercent: number;
  image?: string;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  customerName: string;
  customerNotes: string;
  customerGstin: string;
  customerAddress: string;
  isInterState: boolean;
  items: InvoiceLineItem[];
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxTotal: number;
  total: number;
  createdAt: string;
}

export interface BusinessSettings {
  businessName: string;
  gstin: string;
  address: string;
  state: string;
  phone: string;
  email: string;
  defaultGstPercent: number;
  defaultHsn: string;
}

export const CATEGORIES = [
  'Panel', 'Patti', 'CNC', 'Rockface', 'Butching', 'Tumble',
  'Pattern', 'Jaali', 'Moulding', 'Random', 'Tile', 'Special Piece', 'Other',
];

// =========================================
// Mappers (DB row → app type)
// =========================================
interface StoneRow {
  id: string;
  name: string;
  size: string;
  packing: string;
  quantity: number;
  location_id: string | null;
  category: string;
  variant: string;
  sku: string;
  notes: string;
  image_url: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  locations?: { name: string } | null;
}

function mapStone(r: StoneRow): StoneItem {
  return {
    id: r.id,
    name: r.name,
    size: r.size,
    packing: r.packing,
    quantity: Number(r.quantity),
    location: r.locations?.name ?? '',
    location_id: r.location_id,
    category: r.category,
    variant: r.variant,
    status: r.status,
    notes: r.notes,
    sku: r.sku,
    image: r.image_url ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

interface InvoiceRow {
  id: string;
  number: string;
  date: string;
  customer_name: string;
  customer_notes: string;
  customer_gstin: string;
  customer_address: string;
  is_inter_state: boolean;
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_total: number;
  total: number;
  created_at: string;
  invoice_line_items?: Array<{
    id: string;
    stone_id: string | null;
    name: string;
    size: string;
    packing: string;
    quantity: number;
    rate: number;
    hsn_code: string;
    gst_percent: number;
    image_url: string | null;
    position: number;
  }>;
}

function mapInvoice(r: InvoiceRow): Invoice {
  const items = (r.invoice_line_items ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(li => ({
      id: li.id,
      stoneId: li.stone_id ?? undefined,
      name: li.name,
      size: li.size,
      packing: li.packing,
      quantity: Number(li.quantity),
      rate: Number(li.rate),
      hsnCode: li.hsn_code ?? '6802',
      gstPercent: Number(li.gst_percent ?? 18),
      image: li.image_url ?? undefined,
    }));
  return {
    id: r.id,
    number: r.number,
    date: r.date,
    customerName: r.customer_name,
    customerNotes: r.customer_notes,
    customerGstin: r.customer_gstin ?? '',
    customerAddress: r.customer_address ?? '',
    isInterState: !!r.is_inter_state,
    items,
    subtotal: Number(r.subtotal),
    cgstAmount: Number(r.cgst_amount ?? 0),
    sgstAmount: Number(r.sgst_amount ?? 0),
    igstAmount: Number(r.igst_amount ?? 0),
    taxTotal: Number(r.tax_total ?? 0),
    total: Number(r.total),
    createdAt: r.created_at,
  };
}

// =========================================
// Stones
// =========================================
export async function getStones(): Promise<StoneItem[]> {
  const { data, error } = await supabase
    .from('stones')
    .select('*, locations(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as StoneRow[]).map(mapStone);
}

export async function addStone(input: {
  name: string;
  size: string;
  packing: string;
  quantity: number;
  location: string;     // location name — we resolve to id
  category: string;
  variant: string;
  notes: string;
  sku: string;
  image?: string;
}): Promise<StoneItem> {
  // Resolve location name → id
  const { data: loc } = await supabase
    .from('locations')
    .select('id')
    .eq('name', input.location)
    .maybeSingle();
  const location_id = loc?.id ?? null;

  const { data: user } = await supabase.auth.getUser();
  const created_by = user.user?.id ?? null;

  const { data, error } = await supabase
    .from('stones')
    .insert({
      name: input.name,
      size: input.size,
      packing: input.packing,
      quantity: input.quantity,
      location_id,
      category: input.category,
      variant: input.variant,
      notes: input.notes,
      sku: input.sku,
      image_url: input.image ?? null,
      status: 'active',
      created_by,
    })
    .select('*, locations(name)')
    .single();
  if (error) throw error;

  // Audit log
  await supabase.from('stock_logs').insert({
    stone_id: data.id,
    stone_name: data.name,
    field: 'created',
    old_value: '',
    new_value: 'New stone added',
    user_id: created_by,
  });

  return mapStone(data as StoneRow);
}

export async function updateStone(id: string, updates: Partial<StoneItem>): Promise<void> {
  // Pull current row for audit diff
  const { data: prev } = await supabase
    .from('stones')
    .select('id, name, size, packing, quantity, category, variant, sku, notes, status, location_id')
    .eq('id', id)
    .single();
  if (!prev) return;

  const dbPatch: Record<string, unknown> = {};
  const fieldMap: Record<keyof StoneItem, string> = {
    name: 'name', size: 'size', packing: 'packing', quantity: 'quantity',
    category: 'category', variant: 'variant', sku: 'sku', notes: 'notes',
    status: 'status', image: 'image_url',
    location_id: 'location_id',
    location: '__loc_name__', // resolved separately
    id: '', createdAt: '', updatedAt: '',
  };

  for (const [k, v] of Object.entries(updates)) {
    const col = fieldMap[k as keyof StoneItem];
    if (!col) continue;
    if (col === '__loc_name__') continue; // handle below
    dbPatch[col] = v;
  }
  if (updates.location !== undefined) {
    const { data: loc } = await supabase
      .from('locations').select('id').eq('name', updates.location).maybeSingle();
    dbPatch.location_id = loc?.id ?? null;
  }

  const { data: updated, error } = await supabase
    .from('stones')
    .update(dbPatch)
    .eq('id', id)
    .select('*, locations(name)')
    .single();
  if (error) throw error;

  // Audit logs (skip image)
  const { data: { user } } = await supabase.auth.getUser();
  const logs: Array<{
    stone_id: string; stone_name: string; field: string;
    old_value: string; new_value: string; user_id: string | null;
  }> = [];
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'image' || k === 'updatedAt') continue;
    const oldVal = (prev as Record<string, unknown>)[fieldMap[k as keyof StoneItem]];
    if (oldVal === v) continue;
    logs.push({
      stone_id: id,
      stone_name: prev.name,
      field: k,
      old_value: String(oldVal ?? ''),
      new_value: String(v ?? ''),
      user_id: user?.id ?? null,
    });
  }
  if (logs.length) await supabase.from('stock_logs').insert(logs);

  void updated;
}

export async function deleteStone(id: string): Promise<void> {
  const { error } = await supabase.from('stones').delete().eq('id', id);
  if (error) throw error;
}

// =========================================
// Locations
// =========================================
export async function getLocations(): Promise<string[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('name, sort_order')
    .order('sort_order');
  if (error) throw error;
  return (data ?? []).map(l => l.name);
}

export async function saveLocations(names: string[]): Promise<void> {
  const rows = names.map((name, i) => ({ name, sort_order: i + 1 }));
  // Delete missing, upsert provided
  const { data: existing } = await supabase.from('locations').select('id, name');
  const toDelete = (existing ?? []).filter(l => !names.includes(l.name)).map(l => l.id);
  if (toDelete.length) await supabase.from('locations').delete().in('id', toDelete);
  if (rows.length) await supabase.from('locations').upsert(rows, { onConflict: 'name' });
}

// =========================================
// Stock logs
// =========================================
export async function getLogs(limit = 200): Promise<StockLog[]> {
  const { data, error } = await supabase
    .from('stock_logs')
    .select('id, stone_id, stone_name, field, old_value, new_value, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(l => ({
    id: l.id,
    stoneId: l.stone_id,
    stoneName: l.stone_name,
    field: l.field,
    oldValue: l.old_value,
    newValue: l.new_value,
    timestamp: l.created_at,
  }));
}

// =========================================
// Invoices
// =========================================
export async function getInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_line_items(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as InvoiceRow[]).map(mapInvoice);
}

export async function nextInvoiceNumber(): Promise<string> {
  // Fetch the latest number for display only — actual reservation happens server-side in create_invoice RPC
  const { data } = await supabase
    .from('invoices')
    .select('number')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const max = data?.number ? parseInt(data.number.replace(/\D/g, ''), 10) : 1000;
  return `INV-${String(isNaN(max) ? 1001 : max + 1).padStart(4, '0')}`;
}

export async function createInvoice(inv: Omit<Invoice, 'id' | 'createdAt' | 'subtotal' | 'total' | 'cgstAmount' | 'sgstAmount' | 'igstAmount' | 'taxTotal'>): Promise<Invoice> {
  const { data, error } = await supabase.rpc('create_invoice', {
    p_customer_name: inv.customerName,
    p_customer_notes: inv.customerNotes,
    p_customer_gstin: inv.customerGstin,
    p_customer_address: inv.customerAddress,
    p_is_inter_state: inv.isInterState,
    p_date: inv.date.slice(0, 10),
    p_items: inv.items.map(it => ({
      stone_id: it.stoneId ?? null,
      name: it.name,
      size: it.size,
      packing: it.packing,
      quantity: it.quantity,
      rate: it.rate,
      hsn_code: it.hsnCode || '6802',
      gst_percent: it.gstPercent ?? 18,
      image_url: it.image ?? null,
    })),
  });
  if (error) throw error;

  // Re-fetch with line items for full shape
  const { data: full, error: fetchErr } = await supabase
    .from('invoices')
    .select('*, invoice_line_items(*)')
    .eq('id', (data as { id: string }).id)
    .single();
  if (fetchErr) throw fetchErr;
  return mapInvoice(full as InvoiceRow);
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw error;
}

// =========================================
// Business settings
// =========================================
export async function getBusinessSettings(): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('business_settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return {
    businessName: data.business_name,
    gstin: data.gstin,
    address: data.address,
    state: data.state,
    phone: data.phone,
    email: data.email,
    defaultGstPercent: Number(data.default_gst_percent),
    defaultHsn: data.default_hsn,
  };
}

export async function updateBusinessSettings(s: Partial<BusinessSettings>): Promise<void> {
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (s.businessName !== undefined) dbPatch.business_name = s.businessName;
  if (s.gstin !== undefined) dbPatch.gstin = s.gstin;
  if (s.address !== undefined) dbPatch.address = s.address;
  if (s.state !== undefined) dbPatch.state = s.state;
  if (s.phone !== undefined) dbPatch.phone = s.phone;
  if (s.email !== undefined) dbPatch.email = s.email;
  if (s.defaultGstPercent !== undefined) dbPatch.default_gst_percent = s.defaultGstPercent;
  if (s.defaultHsn !== undefined) dbPatch.default_hsn = s.defaultHsn;

  const { error } = await supabase
    .from('business_settings')
    .update(dbPatch)
    .eq('id', 1);
  if (error) throw error;
}

// =========================================
// Image upload (Supabase Storage)
// =========================================
export async function uploadStoneImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `stones/${filename}`;
  const { error } = await supabase.storage
    .from('stone-images')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('stone-images').getPublicUrl(path);
  return data.publicUrl;
}
