import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppData } from '../types'

export interface WorkspaceInfo {
  id: string
  name: string
  role: 'owner' | 'editor'
}

const WORKSPACES_TABLE = 'workspaces' as const

export async function listMyWorkspaces(
  client: SupabaseClient
): Promise<{ data: WorkspaceInfo[]; error: Error | null }> {
  const { data, error } = await client
    .from('workspace_members')
    .select('role, workspaces(id, name)')

  if (error) {
    console.error('[workspace] list', error)
    return { data: [], error: new Error(error.message) }
  }

  const rows = (data ?? []) as unknown as { role: string; workspaces: { id: string; name: string } | null }[]
  const infos: WorkspaceInfo[] = rows
    .filter((r) => r.workspaces != null)
    .map((r) => ({
      id: r.workspaces!.id,
      name: r.workspaces!.name,
      role: r.role as 'owner' | 'editor',
    }))

  return { data: infos, error: null }
}

export async function fetchWorkspacePayload(
  client: SupabaseClient,
  workspaceId: string
): Promise<{ payload: AppData | null; error: Error | null }> {
  const { data, error } = await client
    .from(WORKSPACES_TABLE)
    .select('payload')
    .eq('id', workspaceId)
    .maybeSingle()

  if (error) {
    console.error('[workspace] fetch', error)
    return { payload: null, error: new Error(error.message) }
  }
  const raw = data?.payload as unknown
  if (!raw || typeof raw !== 'object') return { payload: null, error: null }
  return { payload: raw as AppData, error: null }
}

export async function upsertWorkspacePayload(
  client: SupabaseClient,
  workspaceId: string,
  payload: AppData
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from(WORKSPACES_TABLE)
    .update({ payload, updated_at: new Date().toISOString() })
    .eq('id', workspaceId)

  if (error) {
    console.error('[workspace] upsert', error)
    return { error: new Error(error.message) }
  }
  return { error: null }
}

export async function createWorkspace(
  client: SupabaseClient,
  name: string
): Promise<{ workspaceId: string | null; error: Error | null }> {
  const { data, error } = await client.rpc('create_workspace', { p_name: name })
  if (error) {
    console.error('[workspace] create', error)
    return { workspaceId: null, error: new Error(error.message) }
  }
  return { workspaceId: data as string, error: null }
}

export async function createWorkspaceInvite(
  client: SupabaseClient,
  workspaceId: string
): Promise<{ token: string | null; error: Error | null }> {
  const { data, error } = await client.rpc('create_workspace_invite', {
    p_workspace_id: workspaceId,
  })
  if (error) {
    console.error('[workspace] invite', error)
    return { token: null, error: new Error(error.message) }
  }
  return { token: data as string, error: null }
}

export async function joinWorkspaceViaInvite(
  client: SupabaseClient,
  token: string
): Promise<{ workspaceId: string | null; workspaceName: string | null; error: string | null }> {
  const { data, error } = await client.rpc('join_workspace_via_invite', { p_token: token })
  if (error) {
    console.error('[workspace] join', error)
    return { workspaceId: null, workspaceName: null, error: error.message }
  }
  const result = data as { workspace_id?: string; workspace_name?: string; error?: string }
  if (result?.error) {
    return { workspaceId: null, workspaceName: null, error: result.error }
  }
  return {
    workspaceId: result?.workspace_id ?? null,
    workspaceName: result?.workspace_name ?? null,
    error: null,
  }
}
