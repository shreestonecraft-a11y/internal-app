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
  userName: string;
  userEmail: string;
}

export interface InvoiceLineItem {
  id: string;
  stoneId?: string;
  name: string;
  size: string;
  packing: string;
  quantity: number;
  image?: string;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  notes: string;
  items: InvoiceLineItem[];
  createdAt: string;
}

export interface ReturnSlipLineItem {
  id: string;
  stoneId?: string;
  name: string;
  size: string;
  packing: string;
  quantity: number;
  image?: string;
}

export interface ReturnSlip {
  id: string;
  number: string;
  date: string;
  notes: string;
  items: ReturnSlipLineItem[];
  createdAt: string;
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
  customer_notes: string;
  created_at: string;
  invoice_line_items?: Array<{
    id: string;
    stone_id: string | null;
    name: string;
    size: string;
    packing: string;
    quantity: number;
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
      image: li.image_url ?? undefined,
    }));
  return {
    id: r.id,
    number: r.number,
    date: r.date,
    notes: r.customer_notes ?? '',
    items,
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
    user_email: user.user?.email ?? null,
  });

  return mapStone(data as StoneRow);
}

export interface BulkStoneInput {
  name: string;
  size: string;
  packing: string;
  quantity: number;
  location: string;
  notes: string;
}

export async function bulkAddStones(rows: BulkStoneInput[]): Promise<{ inserted: number; errors: string[] }> {
  const { data: locs } = await supabase.from('locations').select('id, name');
  const locMap = new Map((locs ?? []).map(l => [l.name, l.id]));
  const { data: user } = await supabase.auth.getUser();
  const created_by = user.user?.id ?? null;

  const errors: string[] = [];
  const valid: Array<Record<string, unknown>> = [];
  rows.forEach((r, i) => {
    const rowNum = i + 2; // +2 = header row + 0-based to 1-based
    if (!r.name?.trim()) { errors.push(`Row ${rowNum}: missing Stone Name`); return; }
    const locName = r.location?.trim();
    const location_id = locName ? locMap.get(locName) : null;
    if (locName && !location_id) {
      errors.push(`Row ${rowNum}: location "${locName}" doesn't exist — add it in Settings first`);
      return;
    }
    valid.push({
      name: r.name.trim(),
      size: r.size?.trim() ?? '',
      packing: r.packing?.trim() ?? '',
      quantity: Number.isFinite(r.quantity) ? Math.max(0, Math.floor(r.quantity)) : 0,
      location_id: location_id ?? null,
      category: '',
      variant: '',
      sku: '',
      notes: r.notes?.trim() ?? '',
      image_url: null,
      status: 'active',
      created_by,
    });
  });

  if (!valid.length) return { inserted: 0, errors };

  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < valid.length; i += BATCH) {
    const slice = valid.slice(i, i + BATCH);
    const { data: insertedRows, error } = await supabase
      .from('stones')
      .insert(slice)
      .select('id, name, quantity');
    if (error) { errors.push(`Batch starting at row ${i + 2}: ${error.message}`); continue; }
    inserted += slice.length;
    if (insertedRows?.length) {
      await supabase.from('stock_logs').insert(insertedRows.map(r => ({
        stone_id: r.id,
        stone_name: r.name,
        field: 'created',
        old_value: '',
        new_value: `Imported via CSV (qty ${r.quantity})`,
        user_id: created_by,
        user_email: user.user?.email ?? null,
      })));
    }
  }
  return { inserted, errors };
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
    old_value: string; new_value: string; user_id: string | null; user_email: string | null;
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
      user_email: user?.email ?? null,
    });
  }
  if (logs.length) await supabase.from('stock_logs').insert(logs);

  void updated;
}

export async function deleteStone(id: string): Promise<void> {
  // Fetch name + qty BEFORE delete so we can log the action
  const { data: prev } = await supabase
    .from('stones')
    .select('name, quantity')
    .eq('id', id)
    .single();
  const { data: { user } } = await supabase.auth.getUser();

  // Write the audit log first — stone_id stays valid until the delete cascades
  if (prev) {
    await supabase.from('stock_logs').insert({
      stone_id: id,
      stone_name: prev.name,
      field: 'deleted',
      old_value: `qty ${prev.quantity}`,
      new_value: 'Stone deleted',
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
    });
  }

  const { error } = await supabase.from('stones').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkDeleteStones(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { data: prevRows } = await supabase
    .from('stones')
    .select('id, name, quantity')
    .in('id', ids);
  const { data: { user } } = await supabase.auth.getUser();

  if (prevRows?.length) {
    const logs = prevRows.map(r => ({
      stone_id: r.id,
      stone_name: r.name,
      field: 'deleted',
      old_value: `qty ${r.quantity}`,
      new_value: 'Stone deleted (bulk)',
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
    }));
    // Insert logs in batches
    const LOG_BATCH = 100;
    for (let i = 0; i < logs.length; i += LOG_BATCH) {
      await supabase.from('stock_logs').insert(logs.slice(i, i + LOG_BATCH));
    }
  }

  const BATCH = 100;
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const { error } = await supabase.from('stones').delete().in('id', slice);
    if (error) throw error;
  }
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
  const names = (data ?? []).map(l => l.name);
  return names.length ? names : ["Showroom", "Godown"];
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
    .select('id, stone_id, stone_name, field, old_value, new_value, created_at, user_email, profiles(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  type Row = {
    id: string; stone_id: string | null; stone_name: string;
    field: string; old_value: string; new_value: string; created_at: string;
    user_email: string | null;
    profiles: { full_name: string | null; email: string | null } | null;
  };
  return ((data as unknown as Row[]) ?? []).map(l => ({
    id: l.id,
    stoneId: l.stone_id,
    stoneName: l.stone_name,
    field: l.field,
    oldValue: l.old_value,
    newValue: l.new_value,
    timestamp: l.created_at,
    userName: l.profiles?.full_name?.trim() || l.profiles?.email || l.user_email || 'Unknown',
    userEmail: l.profiles?.email || l.user_email || '',
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

export async function createInvoice(inv: Omit<Invoice, 'id' | 'createdAt'>): Promise<Invoice> {
  const { data, error } = await supabase.rpc('create_invoice', {
    p_customer_name: '',
    p_customer_notes: inv.notes,
    p_date: inv.date.slice(0, 10),
    p_items: inv.items.map(it => ({
      stone_id: it.stoneId ?? null,
      name: it.name,
      size: it.size,
      packing: it.packing,
      quantity: it.quantity,
      rate: 0,
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
// Return Slips
// =========================================
interface ReturnSlipRow {
  id: string;
  number: string;
  date: string;
  notes: string;
  created_at: string;
  return_slip_line_items?: Array<{
    id: string;
    stone_id: string | null;
    name: string;
    size: string;
    packing: string;
    quantity: number;
    image_url: string | null;
    position: number;
  }>;
}

function mapReturnSlip(r: ReturnSlipRow): ReturnSlip {
  const items = (r.return_slip_line_items ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(li => ({
      id: li.id,
      stoneId: li.stone_id ?? undefined,
      name: li.name,
      size: li.size,
      packing: li.packing,
      quantity: Number(li.quantity),
      image: li.image_url ?? undefined,
    }));
  return {
    id: r.id,
    number: r.number,
    date: r.date,
    notes: r.notes ?? '',
    items,
    createdAt: r.created_at,
  };
}

export async function getReturnSlips(): Promise<ReturnSlip[]> {
  const { data, error } = await supabase
    .from('return_slips')
    .select('*, return_slip_line_items(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ReturnSlipRow[]).map(mapReturnSlip);
}

export async function nextReturnSlipNumber(): Promise<string> {
  const { data } = await supabase
    .from('return_slips')
    .select('number')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const max = data?.number ? parseInt(data.number.replace(/\D/g, ''), 10) : 1000;
  return `RET-${String(isNaN(max) ? 1001 : max + 1).padStart(4, '0')}`;
}

export async function createReturnSlip(slip: Omit<ReturnSlip, 'id' | 'createdAt'>): Promise<ReturnSlip> {
  const { data, error } = await supabase.rpc('create_return_slip', {
    p_notes: slip.notes,
    p_date: slip.date.slice(0, 10),
    p_items: slip.items.map(it => ({
      stone_id: it.stoneId ?? null,
      name: it.name,
      size: it.size,
      packing: it.packing,
      quantity: it.quantity,
      image_url: it.image ?? null,
    })),
  });
  if (error) throw error;

  const { data: full, error: fetchErr } = await supabase
    .from('return_slips')
    .select('*, return_slip_line_items(*)')
    .eq('id', (data as { id: string }).id)
    .single();
  if (fetchErr) throw fetchErr;
  return mapReturnSlip(full as ReturnSlipRow);
}

export async function deleteReturnSlip(id: string): Promise<void> {
  const { error } = await supabase.from('return_slips').delete().eq('id', id);
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
