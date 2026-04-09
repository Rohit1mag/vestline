import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export function isSupabaseConfigured(): boolean {
  return Boolean(url?.trim() && anonKey?.trim())
}

export function createClerkSupabaseClient(
  getToken: () => Promise<string | null>
): SupabaseClient {
  const u = url?.trim()
  const k = anonKey?.trim()
  if (!u || !k) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  }
  return createClient(u, k, {
    accessToken: async () => {
      const token = await getToken()
      return token ?? null
    },
  })
}

/** Unauthenticated client — only for calling public RPCs (e.g. get_grant_by_share_token). */
export function createAnonSupabaseClient(): SupabaseClient | null {
  const u = url?.trim()
  const k = anonKey?.trim()
  if (!u || !k) return null
  return createClient(u, k)
}
