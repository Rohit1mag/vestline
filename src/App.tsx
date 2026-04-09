import { Show, UserButton, useAuth, useUser } from '@clerk/react'
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { EmployeeGrantView } from './components/EmployeeGrantView'
import { LandingPage } from './components/LandingPage'
import { WorkspaceSwitcher } from './components/WorkspaceSwitcher'
import { useWorkspaceData } from './hooks/useWorkspaceData'
import { useSyncedAppData } from './hooks/useSyncedAppData'
import { createClerkSupabaseClient, isSupabaseConfigured } from './lib/supabase'
import { createGrantShareLink } from './lib/vestlineRemote'
import {
  createWorkspace,
  createWorkspaceInvite,
  joinWorkspaceViaInvite,
  listMyWorkspaces,
  type WorkspaceInfo,
} from './lib/workspaceRemote'
import { loadAppData, saveAppData } from './storage'
import type { AppData } from './types'
import { VestlineShell } from './VestlineShell'

const hasClerkKey = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim())

// ── URL param helpers ───────────────────────────────────────────────────────
function getSearchParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key)
}
function clearSearchParam(key: string) {
  const params = new URLSearchParams(window.location.search)
  params.delete(key)
  const qs = params.toString()
  window.history.replaceState({}, '', qs ? `?${qs}` : window.location.pathname)
}

// ── Local-only mode ──────────────────────────────────────────────────────────
function LocalApp() {
  const [data, setData] = useState(() => loadAppData())
  useEffect(() => { saveAppData(data) }, [data])
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

// ── Personal workspace (existing useSyncedAppData) ───────────────────────────
function PersonalWorkspace({
  onShareLink,
  workspaceSlot,
}: {
  onShareLink: (stakeholderId: string) => Promise<string | null>
  workspaceSlot: React.ReactNode
}) {
  const { user, isLoaded: userLoaded } = useUser()
  if (!userLoaded || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#0c0f14]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a3142] border-t-[#3ee8b5]" />
      </div>
    )
  }
  return (
    <PersonalWorkspaceForUser
      key={user.id}
      onShareLink={onShareLink}
      workspaceSlot={workspaceSlot}
    />
  )
}

function PersonalWorkspaceForUser({
  onShareLink,
  workspaceSlot,
}: {
  onShareLink: (stakeholderId: string) => Promise<string | null>
  workspaceSlot: React.ReactNode
}) {
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
    saveState === 'saving' ? <span className="text-xs text-[#8b92a8]">Saving…</span>
    : saveState === 'saved' ? <span className="text-xs text-[#3ee8b5]/90">Synced</span>
    : saveState === 'error' ? <span className="text-xs text-[#ff6b5b]/90">Save failed</span>
    : null

  return (
    <VestlineShell
      data={data}
      setData={setDataStrict}
      syncBadge={syncBadge}
      authSlot={<UserButton appearance={{ elements: { userButtonAvatarBox: 'h-9 w-9' } }} />}
      workspaceSlot={workspaceSlot}
      onGetShareLink={onShareLink}
      remoteError={saveError}
    />
  )
}

// ── Shared workspace ─────────────────────────────────────────────────────────
function SharedWorkspace({
  workspaceId,
  workspaceSlot,
}: {
  workspaceId: string
  workspaceSlot: React.ReactNode
}) {
  const { data, setData, ready, saveState, saveError } = useWorkspaceData(workspaceId)
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
        <p className="text-sm">Loading shared workspace…</p>
      </div>
    )
  }

  const syncBadge =
    saveState === 'saving' ? <span className="text-xs text-[#8b92a8]">Saving…</span>
    : saveState === 'saved' ? <span className="text-xs text-[#3ee8b5]/90">Synced</span>
    : saveState === 'error' ? <span className="text-xs text-[#ff6b5b]/90">Save failed</span>
    : null

  return (
    <VestlineShell
      data={data}
      setData={setDataStrict}
      syncBadge={syncBadge}
      authSlot={<UserButton appearance={{ elements: { userButtonAvatarBox: 'h-9 w-9' } }} />}
      workspaceSlot={workspaceSlot}
      remoteError={saveError}
    />
  )
}

// ── Accept invite banner ──────────────────────────────────────────────────────
function InviteBanner({
  token,
  onAccepted,
}: {
  token: string
  onAccepted: (workspaceId: string) => void
}) {
  const { getToken } = useAuth()
  const [state, setState] = useState<'idle' | 'joining' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const supabase = useMemo(() => {
    if (!isSupabaseConfigured()) return null
    return createClerkSupabaseClient(() => getToken())
  }, [getToken])

  const accept = async () => {
    if (!supabase) { setState('error'); setMessage('Supabase not configured'); return }
    setState('joining')
    const { workspaceId, workspaceName, error } = await joinWorkspaceViaInvite(supabase, token)
    if (error) { setState('error'); setMessage(error); return }
    clearSearchParam('invite')
    setState('done')
    setMessage(`Joined "${workspaceName}"!`)
    setTimeout(() => { if (workspaceId) onAccepted(workspaceId) }, 1200)
  }

  const dismiss = () => { clearSearchParam('invite'); setState('done') }

  if (state === 'done') return null

  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-[#3ee8b5]/30 bg-[#0c0f14]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        {state === 'error' ? (
          <>
            <p className="text-sm text-[#ff6b5b]">{message || 'Invalid or expired invite link.'}</p>
            <button type="button" onClick={dismiss} className="text-xs text-[#8b92a8] hover:text-[#e8eaf0]">Dismiss</button>
          </>
        ) : state === 'joining' ? (
          <p className="text-sm text-[#8b92a8]">Joining workspace…</p>
        ) : (
          <>
            <p className="text-sm text-[#e8eaf0]">
              You've been invited to join a shared workspace on Vestline.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={accept}
                className="rounded-lg bg-[#3ee8b5] px-4 py-1.5 text-xs font-semibold text-[#0c0f14] hover:brightness-110"
              >
                Accept invite
              </button>
              <button type="button" onClick={dismiss} className="text-xs text-[#8b92a8] hover:text-[#e8eaf0]">
                Dismiss
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Cloud app shell ───────────────────────────────────────────────────────────
function CloudApp() {
  const { isLoaded, isSignedIn } = useAuth()
  const { getToken } = useAuth()

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([])
  const [workspacesLoading, setWorkspacesLoading] = useState(false)

  const inviteToken = getSearchParam('invite')

  const supabase = useMemo(() => {
    if (!isSupabaseConfigured()) return null
    return createClerkSupabaseClient(() => getToken())
  }, [getToken])

  // Load workspace list whenever the user is signed in
  const refreshWorkspaces = useCallback(async () => {
    if (!supabase) return
    setWorkspacesLoading(true)
    const { data } = await listMyWorkspaces(supabase)
    setWorkspaces(data)
    setWorkspacesLoading(false)
  }, [supabase])

  useEffect(() => {
    if (isSignedIn) void refreshWorkspaces()
  }, [isSignedIn, refreshWorkspaces])

  const handleCreateWorkspace = async (name: string) => {
    if (!supabase) return
    const { workspaceId } = await createWorkspace(supabase, name)
    await refreshWorkspaces()
    if (workspaceId) setActiveWorkspaceId(workspaceId)
  }

  const handleInvite = async (workspaceId: string): Promise<string | null> => {
    if (!supabase) return null
    const { token } = await createWorkspaceInvite(supabase, workspaceId)
    if (!token) return null
    return `${window.location.origin}?invite=${token}`
  }

  const handleGetShareLink = useCallback(
    async (stakeholderId: string): Promise<string | null> => {
      if (!supabase) return null
      const { token } = await createGrantShareLink(supabase, stakeholderId)
      if (!token) return null
      return `${window.location.origin}?grant=${token}`
    },
    [supabase]
  )

  const workspaceSlot = isSignedIn ? (
    <WorkspaceSwitcher
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
      onSwitch={setActiveWorkspaceId}
      onCreate={handleCreateWorkspace}
      onInvite={handleInvite}
      loading={workspacesLoading}
    />
  ) : null

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
        {inviteToken ? (
          <LandingPage inviteHint />
        ) : (
          <LandingPage />
        )}
      </Show>

      <Show when="signed-in">
        {inviteToken && (
          <InviteBanner
            token={inviteToken}
            onAccepted={(id) => {
              setActiveWorkspaceId(id)
              void refreshWorkspaces()
            }}
          />
        )}
        {activeWorkspaceId === null ? (
          <PersonalWorkspace
            onShareLink={handleGetShareLink}
            workspaceSlot={workspaceSlot}
          />
        ) : (
          <SharedWorkspace
            key={activeWorkspaceId}
            workspaceId={activeWorkspaceId}
            workspaceSlot={workspaceSlot}
          />
        )}
      </Show>
    </>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const grantToken = getSearchParam('grant')
  if (grantToken) return <EmployeeGrantView token={grantToken} />
  if (!hasClerkKey) return <LocalApp />
  return <CloudApp />
}
