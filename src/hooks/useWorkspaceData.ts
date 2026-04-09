import { useAuth } from '@clerk/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClerkSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import { fetchWorkspacePayload, upsertWorkspacePayload } from '../lib/workspaceRemote'
import { isValidAppData } from '../storage'
import type { AppData } from '../types'

const SAVE_DEBOUNCE_MS = 650

export type RemoteSaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Mirrors useSyncedAppData but for a shared workspace row. */
export function useWorkspaceData(workspaceId: string) {
  const { getToken } = useAuth()

  const supabase = useMemo(() => {
    if (!isSupabaseConfigured()) return null
    return createClerkSupabaseClient(() => getToken())
  }, [getToken])

  const [data, setData] = useState<AppData | null>(null)
  const [ready, setReady] = useState(false)
  const [saveState, setSaveState] = useState<RemoteSaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPushedRef = useRef<string>('')

  // Initial load
  useEffect(() => {
    if (!supabase) return
    let cancelled = false

    void (async () => {
      const { payload, error } = await fetchWorkspacePayload(supabase, workspaceId)
      if (cancelled) return
      if (error) setSaveError(error.message)

      const next = payload && isValidAppData(payload) ? payload : null
      if (!cancelled) {
        setData(next)
        lastPushedRef.current = JSON.stringify(next)
        setReady(true)
        setSaveState('saved')
      }
    })()

    return () => { cancelled = true }
  }, [supabase, workspaceId])

  const pushRemote = useCallback(
    async (payload: AppData) => {
      if (!supabase) return
      const serialized = JSON.stringify(payload)
      if (serialized === lastPushedRef.current) { setSaveState('saved'); return }
      setSaveState('saving')
      setSaveError(null)
      const { error } = await upsertWorkspacePayload(supabase, workspaceId, payload)
      if (error) { setSaveState('error'); setSaveError(error.message); return }
      lastPushedRef.current = serialized
      setSaveState('saved')
    },
    [supabase, workspaceId]
  )

  // Debounced auto-save
  useEffect(() => {
    if (!ready || !data) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { void pushRemote(data) }, SAVE_DEBOUNCE_MS)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [data, ready, pushRemote])

  return { data, setData, ready, saveState, saveError }
}
