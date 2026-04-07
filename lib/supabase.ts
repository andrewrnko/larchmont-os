import { createClient } from '@supabase/supabase-js'

// Fall back to placeholder values so the app loads without crashing when
// NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not yet set.
// DB calls will fail gracefully (empty states) until real credentials are added.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(url, key)
