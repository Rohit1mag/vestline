import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { WorkspaceInfo } from '../lib/workspaceRemote'

interface Props {
  workspaces: WorkspaceInfo[]
  activeWorkspaceId: string | null  // null = personal
  onSwitch: (id: string | null) => void
  onCreate: (name: string) => Promise<void>
  onInvite: (workspaceId: string) => Promise<string | null>  // returns invite URL or null
  loading?: boolean
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  onSwitch,
  onCreate,
  onInvite,
  loading,
}: Props) {
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const activeName =
    activeWorkspaceId == null
      ? 'Personal'
      : (workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? 'Workspace')

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    await onCreate(newName.trim())
    setCreating(false)
    setNewName('')
    setShowCreate(false)
  }

  const handleInvite = async () => {
    if (!activeWorkspaceId) return
    const url = await onInvite(activeWorkspaceId)
    setInviteUrl(url)
  }

  const copyInvite = async () => {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopying(true)
    setTimeout(() => setCopying(false), 2000)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setInviteUrl(null); setShowCreate(false) }}
        className="flex items-center gap-2 rounded-lg border border-[#2a3142] bg-[#1a1f2e] px-3 py-1.5 text-sm font-medium text-[#e8eaf0] transition hover:border-[#3ee8b5]/40"
      >
        {/* Workspace icon */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2 4h12M2 8h8M2 12h5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span className="max-w-[120px] truncate">{activeName}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`shrink-0 transition ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[#2a3142] bg-[#111520] shadow-2xl">
          <div className="p-2">
            {/* Personal workspace */}
            <button
              type="button"
              onClick={() => { onSwitch(null); setOpen(false) }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                activeWorkspaceId === null
                  ? 'bg-[#3ee8b5]/10 text-[#3ee8b5]'
                  : 'text-[#e8eaf0] hover:bg-[#1a1f2e]'
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#2a3142] text-xs">P</span>
              <span className="flex-1 text-left">Personal</span>
              {activeWorkspaceId === null && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            {/* Shared workspaces */}
            {loading ? (
              <div className="flex justify-center py-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2a3142] border-t-[#3ee8b5]" />
              </div>
            ) : (
              workspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => { onSwitch(ws.id); setOpen(false) }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                    activeWorkspaceId === ws.id
                      ? 'bg-[#3ee8b5]/10 text-[#3ee8b5]'
                      : 'text-[#e8eaf0] hover:bg-[#1a1f2e]'
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#3ee8b5]/10 text-[10px] font-bold text-[#3ee8b5]">
                    {ws.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 truncate text-left">{ws.name}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-[#8b92a8]">
                    {ws.role}
                  </span>
                  {activeWorkspaceId === ws.id && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-[#2a3142] p-2">
            {/* Invite to current shared workspace */}
            {activeWorkspaceId !== null && (
              <>
                {inviteUrl ? (
                  <div className="mb-2 rounded-xl border border-[#2a3142] bg-[#1a1f2e] p-3">
                    <p className="mb-2 text-xs text-[#8b92a8]">Share this invite link (7 days):</p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={inviteUrl}
                        className="min-w-0 flex-1 rounded-md bg-[#0c0f14] px-2 py-1 text-xs text-[#e8eaf0] outline-none"
                      />
                      <button
                        type="button"
                        onClick={copyInvite}
                        className="shrink-0 rounded-md bg-[#3ee8b5]/15 px-2.5 py-1 text-xs font-semibold text-[#3ee8b5] hover:bg-[#3ee8b5]/25"
                      >
                        {copying ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleInvite}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-[#8b92a8] transition hover:bg-[#1a1f2e] hover:text-[#e8eaf0]"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M1 13c0-2.761 2.239-5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M13 9v4M11 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Invite to workspace
                  </button>
                )}
              </>
            )}

            {/* Create new workspace */}
            {showCreate ? (
              <form onSubmit={handleCreate} className="rounded-xl border border-[#2a3142] bg-[#1a1f2e] p-3">
                <p className="mb-2 text-xs font-medium text-[#8b92a8]">New workspace name</p>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Acme Labs"
                    className="min-w-0 flex-1 rounded-md border border-[#2a3142] bg-[#0c0f14] px-2 py-1.5 text-xs text-[#e8eaf0] outline-none focus:border-[#3ee8b5]/50"
                  />
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="shrink-0 rounded-md bg-[#3ee8b5] px-3 py-1.5 text-xs font-semibold text-[#0c0f14] disabled:opacity-50"
                  >
                    {creating ? '…' : 'Create'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-[#8b92a8] transition hover:bg-[#1a1f2e] hover:text-[#e8eaf0]"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                New shared workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
