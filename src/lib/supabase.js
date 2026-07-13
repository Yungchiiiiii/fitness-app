import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY)

// Keep demo/build environments importable without allowing accidental network calls.
export const supabase = createClient(
  SUPABASE_URL || 'https://example.invalid',
  SUPABASE_KEY || 'missing-supabase-key',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
)
