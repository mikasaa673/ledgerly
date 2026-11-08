// ============================================================
// Ledgerly - Supabase Client Configuration & Initialization
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Allow stored overrides from Settings if user configures via UI
const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('ledgerly_supabase_url') : null;
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('ledgerly_supabase_anon_key') : null;

export const supabaseUrl = (storedUrl || envUrl || '').trim();
export const supabaseAnonKey = (storedKey || envAnonKey || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  supabaseAnonKey !== 'your-anon-public-key'
);

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }
}

export const supabase = client;

export function updateSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window === 'undefined') return;
  if (url && anonKey) {
    localStorage.setItem('ledgerly_supabase_url', url.trim());
    localStorage.setItem('ledgerly_supabase_anon_key', anonKey.trim());
  } else {
    localStorage.removeItem('ledgerly_supabase_url');
    localStorage.removeItem('ledgerly_supabase_anon_key');
  }
  window.location.reload();
}
