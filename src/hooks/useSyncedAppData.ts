import { useAuth, useUser } from '@clerk/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClerkSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import { fetchVestlinePayload, upsertVestlinePayload } from '../lib/vestlineRemote'
import {
  createDefaultData,
  isValidAppData,
  readUserScopedAppData,
  saveUserScopedAppData,
} from '../storage'
import type { AppData } from '../types'

const SAVE_DEBOUNCE_MS = 650

export type RemoteSaveState = 'idle' | 'saving' | 'saved' | 'error'

export function useSyncedAppData() {
  const { user, isLoaded: userLoaded } = useUser()
  const { getToken, isLoaded: authLoaded } = useAuth()
  const [data, setData] = useState<AppData | null>(null)
  const [ready, setReady] = useState(false)
  const [saveState, setSaveState] = useState<RemoteSaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPushedRef = useRef<string>('')

  const supabase = useMemo(() => {
    if (!isSupabaseConfigured()) return null
    return createClerkSupabaseClient(() => getToken())
  }, [getToken])

  const userId = user?.id

  useEffect(() => {
    if (!userLoaded || !authLoaded || !userId) return

    let cancelled = false

    const finish = () => {
      if (cancelled) return
      queueMicrotask(() => {
        if (cancelled) return
        if (!supabase) {
          setSaveError(
            'Supabase is not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).'
          )
          const offline = readUserScopedAppData(userId)
          const next = offline ?? createDefaultData()
          saveUserScopedAppData(userId, next)
          setData(next)
          setReady(true)
          return
        }

        void (async () => {
          const { payload: remote, error: fetchErr } = await fetchVestlinePayload(supabase, userId)

          if (fetchErr && !cancelled) {
            setSaveError(fetchErr.message)
          }

          // Remote row is keyed by Clerk user id (see supabase/schema.sql). Never merge the legacy
          // single-key localStorage used by local-only mode — that would copy one account's
          // workspace to another on the same browser.
          let next: AppData
          if (remote && isValidAppData(remote)) {
            next = remote
          } else {
            next = createDefaultData()
            const { error } = await upsertVestlinePayload(supabase, userId, next)
            if (error && !cancelled) {
              setSaveError(error.message)
            }
          }

          if (!cancelled) {
            saveUserScopedAppData(userId, next)
            lastPushedRef.current = JSON.stringify(next)
            setData(next)
            setReady(true)
            setSaveState('saved')
          }
        })()
      })
    }

    finish()

    return () => {
      cancelled = true
    }
  }, [userLoaded, authLoaded, userId, supabase])

  const pushRemote = useCallback(
    async (payload: AppData) => {
      if (!userId || !supabase) return
      const serialized = JSON.stringify(payload)
      if (serialized === lastPushedRef.current) {
        setSaveState('saved')
        return
      }
      setSaveState('saving')
      setSaveError(null)
      const { error } = await upsertVestlinePayload(supabase, userId, payload)
      if (error) {
        setSaveState('error')
        setSaveError(error.message)
        return
      }
      lastPushedRef.current = serialized
      setSaveState('saved')
    },
    [userId, supabase]
  )

  useEffect(() => {
    if (!ready || !data || !userId) return

    saveUserScopedAppData(userId, data)

    if (!supabase) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void pushRemote(data)
    }, SAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [data, ready, pushRemote, supabase, userId])

  return { data, setData, ready, saveState, saveError }
}
