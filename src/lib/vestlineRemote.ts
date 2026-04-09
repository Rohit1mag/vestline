import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppData } from '../types'

export const VESTLINE_TABLE = 'vestline_app_data' as const

type SupabaseLikeError = {
  code?: string
  message?: string
  details?: string
}

/** Maps PostgREST auth errors to actionable copy for the UI. */
export function describeSupabaseRequestError(err: SupabaseLikeError | null | undefined): string {
  if (!err) return 'Unknown error'
  if (err.code === 'PGRST301') {
    return (
      'Supabase cannot verify your Clerk JWT (PGRST301). ' +
      'In Supabase: Authentication → Sign In / Up → Third-party auth → add Clerk with your Clerk domain. ' +
      'In Clerk: enable the Supabase integration. ' +
      'Use the legacy anon key (JWT starting with eyJ…) for VITE_SUPABASE_ANON_KEY unless your project docs say otherwise.'
    )
  }
  return err.message ?? 'Request failed'
}

export async function fetchVestlinePayload(
  client: SupabaseClient,
  userId: string
): Promise<{ payload: AppData | null; error: Error | null }> {
  const { data, error } = await client
    .from(VESTLINE_TABLE)
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[vestline] fetch', error)
    return { payload: null, error: new Error(describeSupabaseRequestError(error)) }
  }
  const raw = data?.payload as unknown
  if (!raw || typeof raw !== 'object') {
    return { payload: null, error: null }
  }
  return { payload: raw as AppData, error: null }
}

export async function upsertVestlinePayload(
  client: SupabaseClient,
  userId: string,
  payload: AppData
): Promise<{ error: Error | null }> {
  const { error } = await client.from(VESTLINE_TABLE).upsert(
    {
      user_id: userId,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.error('[vestline] upsert', error)
    return { error: new Error(describeSupabaseRequestError(error)) }
  }
  return { error: null }
}

/** Create (or reuse) a stable share link for one stakeholder. Returns the UUID token. */
export async function createGrantShareLink(
  client: SupabaseClient,
  stakeholderId: string
): Promise<{ token: string | null; error: Error | null }> {
  const { data, error } = await client.rpc('create_grant_share_link', {
    p_stakeholder_id: stakeholderId,
  })
  if (error) {
    console.error('[vestline] create_grant_share_link', error)
    return { token: null, error: new Error(error.message) }
  }
  return { token: data as string, error: null }
}

export interface GrantSharePayload {
  company: { name: string; totalAuthorizedShares?: number }
  stakeholder: { id: string; name: string; role: string; email?: string }
  grants: AppData['grants']
}

/** Fetch grant data by share token — callable with the anon client (no auth). */
export async function getGrantByShareToken(
  client: SupabaseClient,
  token: string
): Promise<{ data: GrantSharePayload | null; error: Error | null }> {
  const { data, error } = await client.rpc('get_grant_by_share_token', {
    p_token: token,
  })
  if (error) {
    console.error('[vestline] get_grant_by_share_token', error)
    return { data: null, error: new Error(error.message) }
  }
  if (!data) return { data: null, error: null }
  return { data: data as GrantSharePayload, error: null }
}
