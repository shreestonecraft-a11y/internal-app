import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!(url && anonKey);

// When the "Keep me signed in" checkbox is OFF, we route session storage to
// sessionStorage so it disappears when the tab closes. The flag itself lives
// in localStorage so it survives reloads but is set/cleared right before login.
const SESSION_ONLY_FLAG = 'ssc_session_only';
function isSessionOnly(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(SESSION_ONLY_FLAG) === '1'; }
  catch { return false; }
}
export function setSessionOnly(on: boolean) {
  try {
    if (on) localStorage.setItem(SESSION_ONLY_FLAG, '1');
    else localStorage.removeItem(SESSION_ONLY_FLAG);
  } catch { /* storage unavailable */ }
}

const hybridStorage = {
  getItem: (key: string): string | null => {
    try {
      const fromLocal = localStorage.getItem(key);
      if (fromLocal != null) return fromLocal;
      return sessionStorage.getItem(key);
    } catch { return null; }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (isSessionOnly()) {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      }
    } catch { /* storage unavailable */ }
  },
  removeItem: (key: string): void => {
    try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch { /* */ }
  },
};

export const supabase = supabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'ssc_supabase_auth',
        storage: hybridStorage,
      },
    })
  : (createClient('https://invalid.supabase.co', 'invalid', {
      auth: { persistSession: false, autoRefreshToken: false },
    }));
