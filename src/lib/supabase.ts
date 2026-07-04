import { createClient } from '@supabase/supabase-js'

// TODO: once you create your Supabase project (Settings -> API), copy these
// into a .env.local file at the project root:
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// In demo mode (no env vars yet), we export a client pointed at placeholder
// values so the app still runs end-to-end with mocked data. Every call site
// in src/lib/api checks isSupabaseConfigured before hitting the network.
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key'
)
