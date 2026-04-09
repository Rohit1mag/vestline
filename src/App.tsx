import { Show, UserButton, useAuth, useUser } from '@clerk/react'
import { LandingPage } from './components/LandingPage'
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useSyncedAppData } from './hooks/useSyncedAppData'
import { loadAppData, saveAppData } from './storage'
import type { AppData } from './types'
import { VestlineShell } from './VestlineShell'

const hasClerkKey = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim())

function LocalApp() {
  const [data, setData] = useState(() => loadAppData())
  useEffect(() => {
    saveAppData(data)
  }, [data])

  return (
    <VestlineShell
      data={data}
      setData={setData}
      syncBadge={
        <span className="hidden max-w-[200px] text-right text-xs leading-tight text-amber-200/90 sm:inline">
          Local only — add Clerk + Supabase for cloud sync
        </span>
      }
    />
  )
}

function SignedInWorkspace() {
  const { user, isLoaded: userLoaded } = useUser()
  if (!userLoaded || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-ink">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-mint" />
      </div>
    )
  }

  return <SignedInWorkspaceForUser key={user.id} />
}

function SignedInWorkspaceForUser() {
  const { data, setData, ready, saveState, saveError } = useSyncedAppData()

  const setDataStrict: Dispatch<SetStateAction<AppData>> = useCallback(
    (action) => {
      setData((prev) => {
        if (prev === null) return prev
        return typeof action === 'function' ? action(prev) : action
      })
    },
    [setData]
  )

  if (!ready || !data) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-[#0c0f14] text-[#8b92a8]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a3142] border-t-[#3ee8b5]" />
        <p className="text-sm">Loading your workspace…</p>
      </div>
    )
  }

  const syncBadge =
    saveState === 'saving' ? (
      <span className="text-xs text-[#8b92a8]">Saving…</span>
    ) : saveState === 'saved' ? (
      <span className="text-xs text-[#3ee8b5]/90">Synced</span>
    ) : saveState === 'error' ? (
      <span className="text-xs text-[#ff6b5b]/90">Save failed</span>
    ) : null

  return (
    <VestlineShell
      data={data}
      setData={setDataStrict}
      syncBadge={syncBadge}
      authSlot={
        <UserButton
          appearance={{
            elements: {
              userButtonAvatarBox: 'h-9 w-9',
            },
          }}
        />
      }
      remoteError={saveError}
    />
  )
}

function CloudApp() {
  const { isLoaded } = useAuth()

  if (!isLoaded) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#0c0f14]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a3142] border-t-[#3ee8b5]" />
      </div>
    )
  }

  return (
    <>
      <Show when="signed-out">
        <LandingPage />
      </Show>
      <Show when="signed-in">
        <SignedInWorkspace />
      </Show>
    </>
  )
}

export default function App() {
  if (!hasClerkKey) {
    return <LocalApp />
  }

  return <CloudApp />
}
