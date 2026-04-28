import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!(url && anonKey);

// Create a stub client when env is missing so the module doesn't throw at import time.
// The app surfaces a setup screen instead (see ConfigBoundary in main.tsx).
export const supabase = supabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'ssc_supabase_auth',
      },
    })
  : (createClient('https://invalid.supabase.co', 'invalid', {
      auth: { persistSession: false, autoRefreshToken: false },
    }));
