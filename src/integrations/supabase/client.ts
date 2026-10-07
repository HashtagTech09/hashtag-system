import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { initialRecoveryIntent } from '@/lib/authRecovery';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before building the app.');
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: initialRecoveryIntent.hasCode ? 'pkce' : 'implicit',
  }
});

// initialize() is idempotent. Capture callback failure before routing removes its URL.
// A PKCE code left in the URL means no matching browser verifier was available.
export const recoveryInitialization = supabase.auth.initialize().then(({ error }) => ({
  failed: !!error || (initialRecoveryIntent.hasCode && new URLSearchParams(window.location.search).has('code')),
})).catch(() => ({ failed: true }));
