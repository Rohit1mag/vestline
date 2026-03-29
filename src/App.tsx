import { Show, SignInButton, SignUpButton, UserButton, useAuth, useUser } from '@clerk/react'
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
        <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-[#0c0f14] px-4 py-12">
          <div className="text-center">
            <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[#e8eaf0]">
              Vestline
            </p>
            <p className="mt-2 max-w-md text-sm text-[#8b92a8]">
              Sign in to sync your cap table and vesting to the cloud. Your data stays tied to your account.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-lg bg-[#3ee8b5] px-5 py-2.5 text-sm font-semibold text-[#0c0f14] hover:brightness-110"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-lg border border-[#2a3142] bg-[#1a1f2e] px-5 py-2.5 text-sm font-medium text-[#e8eaf0] hover:border-[#3ee8b5]/40"
              >
                Create account
              </button>
            </SignUpButton>
          </div>
        </div>
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
