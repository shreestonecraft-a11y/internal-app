/* eslint-disable no-console */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import path from 'node:path';
import { readFileSync } from 'node:fs';

config({ path: '.env.local' });
config({ path: '.env' }); // fallback

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const OWNER_EMAIL = 'nischay@shreestonecraft.com';
const OWNER_PASSWORD = 'admin@123';
const OWNER_FULL_NAME = 'Nischay';

const LOCATIONS = [
  { name: 'Dukaan 1st Line', sort_order: 1 },
  { name: 'Dukaan 2nd Line', sort_order: 2 },
  { name: 'Dukaan 3rd Line', sort_order: 3 },
  { name: 'Dukaan 5th Line', sort_order: 4 },
  { name: 'Godown',          sort_order: 5 },
];

// Section header → location name (matches xlsx headers)
const SECTION_HEADERS: Record<string, string> = {
  'DUKAAN 2ND LINE': 'Dukaan 2nd Line',
  'DUKAAN 3RD LINE': 'Dukaan 3rd Line',
  'DUKAAN 5TH LINE': 'Dukaan 5th Line',
  'GODOWN':          'Godown',
};

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface XlsxRow {
  'Stone Name'?: string | number;
  'Size'?: string | number;
  'Packing(Sqf/box)'?: string | number;
  'Quantity'?: string | number;
}

async function ensureOwner(): Promise<string> {
  console.log(`→ Ensuring owner user ${OWNER_EMAIL}…`);

  // Look for existing user
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;

  let userId = list.users.find(u => u.email === OWNER_EMAIL)?.id;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: OWNER_FULL_NAME },
    });
    if (error) throw error;
    userId = data.user!.id;
    console.log(`  ✓ Created auth user ${userId}`);
  } else {
    console.log(`  ✓ Found existing auth user ${userId}`);
  }

  // Promote to owner role
  const { error: roleErr } = await supabase
    .from('profiles')
    .update({ role: 'owner', full_name: OWNER_FULL_NAME })
    .eq('id', userId);
  if (roleErr) throw roleErr;
  console.log(`  ✓ Profile role set to owner`);

  return userId;
}

async function ensureLocations(): Promise<Record<string, string>> {
  console.log('→ Upserting locations…');
  const { error } = await supabase
    .from('locations')
    .upsert(LOCATIONS, { onConflict: 'name' });
  if (error) throw error;

  const { data, error: selErr } = await supabase.from('locations').select('id, name');
  if (selErr) throw selErr;

  const map: Record<string, string> = {};
  data!.forEach(l => { map[l.name] = l.id; });
  console.log(`  ✓ ${data!.length} locations ready`);
  return map;
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
}

function cellToNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

interface ParsedStone {
  name: string;
  size: string;
  packing: string;
  quantity: number;
  location_name: string;
}

function parseXlsx(filePath: string): ParsedStone[] {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<XlsxRow>(sheet, { defval: '' });

  let currentLocation = 'Dukaan 1st Line'; // first section, no header in file
  const stones: ParsedStone[] = [];

  for (const row of rows) {
    const name = cellToString(row['Stone Name']);
    if (!name) continue;

    const upper = name.toUpperCase();
    if (SECTION_HEADERS[upper]) {
      currentLocation = SECTION_HEADERS[upper];
      continue;
    }

    stones.push({
      name,
      size: cellToString(row['Size']),
      packing: cellToString(row['Packing(Sqf/box)']),
      quantity: cellToNumber(row['Quantity']),
      location_name: currentLocation,
    });
  }

  return stones;
}

async function importStones(
  stones: ParsedStone[],
  locationMap: Record<string, string>,
  ownerId: string,
) {
  console.log(`→ Importing ${stones.length} stones…`);

  // Wipe existing stones to make this script idempotent (only for fresh imports)
  const { count } = await supabase
    .from('stones')
    .select('id', { count: 'exact', head: true });

  if ((count ?? 0) > 0) {
    console.log(`  ! Existing stones found (${count}). Skipping import to avoid duplicates.`);
    console.log(`  ! Manually delete stones first if you want to re-import.`);
    return;
  }

  const rows = stones.map(s => ({
    name: s.name,
    size: s.size,
    packing: s.packing,
    quantity: s.quantity,
    location_id: locationMap[s.location_name] ?? null,
    category: '',
    variant: '',
    sku: '',
    notes: '',
    status: 'active' as const,
    created_by: ownerId,
  }));

  // Batch insert
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('stones').insert(slice);
    if (error) throw error;
  }
  console.log(`  ✓ Inserted ${rows.length} stones`);
}

async function main() {
  const xlsxPath = path.resolve(process.cwd(), 'supabase/seed/Inventory.xlsx');
  console.log(`Importing from ${xlsxPath}\n`);

  const ownerId = await ensureOwner();
  const locationMap = await ensureLocations();
  const stones = parseXlsx(xlsxPath);

  // Quick summary
  const byLoc: Record<string, number> = {};
  stones.forEach(s => { byLoc[s.location_name] = (byLoc[s.location_name] ?? 0) + 1; });
  console.log('  Stones per location:');
  Object.entries(byLoc).forEach(([k, v]) => console.log(`    - ${k}: ${v}`));

  await importStones(stones, locationMap, ownerId);

  console.log('\n✓ Import complete.');
  console.log(`  Owner login: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
}

main().catch(err => {
  console.error('\n✗ Import failed:', err);
  process.exit(1);
});
