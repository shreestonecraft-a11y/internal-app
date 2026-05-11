/* eslint-disable no-console */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
config({ path: '.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const USERS: Array<{ email: string; password: string; full_name: string; role: 'owner' | 'staff' }> = [
  { email: 'Dilip@shreestonecraft.com',   password: 'admin@123', full_name: 'Dilip',   role: 'owner' },
  { email: 'Prakash@shreestonecraft.com', password: 'shree@123', full_name: 'Prakash', role: 'staff' },
  { email: 'Sujal@shreestonecraft.com',   password: 'shree@123', full_name: 'Sujal',   role: 'staff' },
];

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function upsertUser(u: typeof USERS[number]) {
  const emailLower = u.email.toLowerCase();
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;

  let userId = list.users.find(x => x.email?.toLowerCase() === emailLower)?.id;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });
    if (error) throw error;
    userId = data.user!.id;
    console.log(`  ✓ Created ${u.email} (${userId})`);
  } else {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: u.password,
      user_metadata: { full_name: u.full_name },
    });
    if (error) throw error;
    console.log(`  ✓ Updated existing ${u.email} (${userId})`);
  }

  // Ensure profile row exists with correct role + name
  const { error: profErr } = await supabase
    .from('profiles')
    .upsert({ id: userId, email: u.email, full_name: u.full_name, role: u.role }, { onConflict: 'id' });
  if (profErr) throw profErr;
  console.log(`    role=${u.role}, name=${u.full_name}`);
}

async function main() {
  console.log(`→ Creating/updating ${USERS.length} users on ${SUPABASE_URL}\n`);
  for (const u of USERS) {
    await upsertUser(u);
  }
  console.log('\n✓ Done.');
  console.log('Credentials:');
  USERS.forEach(u => console.log(`  ${u.email} / ${u.password} (${u.role})`));
}

main().catch(err => {
  console.error('\n✗ Failed:', err);
  process.exit(1);
});
