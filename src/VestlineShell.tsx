import { format, startOfMonth } from 'date-fns'
import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { CapTableChart } from './components/CapTableChart'
import { CapTableChat } from './components/CapTableChat'
import { VestlineLogo } from './components/VestlineLogo'
import { VestingChart } from './components/VestingChart'
import {
  formatOwnershipPercent,
  parsePercentInput,
  percentOfAuthorizedToShares,
  sharesToPercentOfAuthorized,
} from './equityMath'
import { exportCapTablePDF, exportGrantsCSV } from './lib/export'
import { newGrant, newStakeholder } from './storage'
import type { AppData, EquityGrant, GrantType, Stakeholder } from './types'
import { buildVestingSchedule, grantTypeLabel, vestedSharesAt } from './vesting'

type Tab = 'dashboard' | 'grants'

export interface VestlineShellProps {
  data: AppData
  setData: React.Dispatch<React.SetStateAction<AppData>>
  syncBadge?: ReactNode
  authSlot?: ReactNode
  workspaceSlot?: ReactNode
  /** If provided, a "Share link" button appears per stakeholder. Returns the share URL. */
  onGetShareLink?: (stakeholderId: string) => Promise<string | null>
  remoteError?: string | null
  /** First name of the signed-in user, for the welcome greeting. */
  userName?: string | null
}

function formatShares(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

const card = 'rounded-2xl border border-[#2a3142] bg-[#1a1f2e]'
const inputCls =
  'w-full rounded-lg border border-[#2a3142] bg-[#0c0f14] px-3 py-2 text-sm text-[#e8eaf0] outline-none focus:border-[#3ee8b5]/50'

export function VestlineShell({
  data,
  setData,
  syncBadge,
  authSlot,
  workspaceSlot,
  onGetShareLink,
  remoteError,
  userName,
}: VestlineShellProps) {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null)
  const [showGrantForm, setShowGrantForm] = useState(false)
  const [showPersonForm, setShowPersonForm] = useState(false)

  const today = useMemo(() => new Date(), [])

  const selectedGrant = useMemo(
    () => data.grants.find((g) => g.id === selectedGrantId) ?? null,
    [data.grants, selectedGrantId]
  )

  const totals = useMemo(() => {
    const byStakeholder = new Map<string, number>()
    let granted = 0
    for (const g of data.grants) {
      granted += g.shares
      byStakeholder.set(g.stakeholderId, (byStakeholder.get(g.stakeholderId) ?? 0) + g.shares)
    }
    let vested = 0
    for (const g of data.grants) {
      vested += vestedSharesAt(g, today)
    }
    const auth = data.company.totalAuthorizedShares
    const base = auth && auth > 0 ? auth : granted || 1
    return { granted, vested, unvested: granted - vested, byStakeholder, base }
  }, [data.grants, data.company.totalAuthorizedShares, today])

  const capSlices = useMemo(() => {
    const slices: { name: string; value: number; color?: string }[] = []
    for (const s of data.stakeholders) {
      const sh = totals.byStakeholder.get(s.id) ?? 0
      if (sh <= 0) continue
      const pct = (sh / totals.base) * 100
      slices.push({ name: s.name, value: Math.round(pct * 10) / 10 })
    }
    const allocated = slices.reduce((a, b) => a + b.value, 0)
    const pool = data.company.totalAuthorizedShares ? Math.max(0, 100 - allocated) : 0
    if (pool > 0.05) {
      slices.push({ name: 'Unallocated', value: Math.round(pool * 10) / 10, color: '#3a4154' })
    }
    return slices
  }, [data.stakeholders, data.company.totalAuthorizedShares, totals])

  const updateCompany = useCallback((patch: Partial<AppData['company']>) => {
    setData((d) => ({
      ...d,
      company: { ...d.company, ...patch },
    }))
  }, [setData])

  const addStakeholder = useCallback((s: Omit<Stakeholder, 'id'>) => {
    setData((d) => ({
      ...d,
      stakeholders: [...d.stakeholders, newStakeholder(s)],
    }))
    setShowPersonForm(false)
  }, [setData])

  const removeStakeholder = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      stakeholders: d.stakeholders.filter((x) => x.id !== id),
      grants: d.grants.filter((g) => g.stakeholderId !== id),
    }))
  }, [setData])

  const upsertGrant = useCallback((g: EquityGrant | Omit<EquityGrant, 'id'>) => {
    setData((d) => {
      if ('id' in g && d.grants.some((x) => x.id === g.id)) {
        return {
          ...d,
          grants: d.grants.map((x) => (x.id === g.id ? (g as EquityGrant) : x)),
        }
      }
      return {
        ...d,
        grants: [...d.grants, newGrant(g as Omit<EquityGrant, 'id'>)],
      }
    })
    setShowGrantForm(false)
  }, [setData])

  const deleteGrant = useCallback((id: string) => {
    setData((d) => ({ ...d, grants: d.grants.filter((g) => g.id !== id) }))
    setSelectedGrantId((cur) => (cur === id ? null : cur))
  }, [setData])

  return (
    <div className="min-h-svh bg-[#0c0f14] text-[#e8eaf0]">
      <header className="sticky top-0 z-20 border-b border-[#2a3142] bg-[#0c0f14]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <VestlineLogo size={40} />
            <div className="text-left">
              <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight sm:text-xl">
                Vestline
              </h1>
              <p className="text-xs text-[#8b92a8]">Equity & vesting for founders</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <nav className="flex gap-1 rounded-lg bg-[#1a1f2e] p-1">
              {(
                [
                  ['dashboard', 'Overview'],
                  ['grants', 'Team & grants'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                    tab === id
                      ? 'bg-[#2a3142] text-white shadow-sm'
                      : 'text-[#8b92a8] hover:text-[#e8eaf0]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
            {workspaceSlot}
            {syncBadge}
            {authSlot}
          </div>
        </div>
      </header>

      {remoteError && (
        <div className="border-b border-[#ff6b5b]/30 bg-[#ff6b5b]/10 px-4 py-2 text-center text-sm text-[#ffb4a8]">
          {remoteError}
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {tab === 'dashboard' && (
          <DashboardView
            data={data}
            totals={totals}
            capSlices={capSlices}
            today={today}
            onEditCompany={() => setTab('grants')}
            onExportCSV={() => exportGrantsCSV(data, today)}
            onExportPDF={() => exportCapTablePDF(data, today, capSlices, totals)}
            userName={userName}
          />
        )}

        {tab === 'grants' && (
          <GrantsView
            key={`${data.company.name}|${data.company.totalAuthorizedShares ?? ''}`}
            data={data}
            selectedGrant={selectedGrant}
            onSelectGrant={setSelectedGrantId}
            onShowGrantForm={() => setShowGrantForm(true)}
            onShowPersonForm={() => setShowPersonForm(true)}
            onDeleteGrant={deleteGrant}
            onRemoveStakeholder={removeStakeholder}
            upsertGrant={upsertGrant}
            updateCompany={updateCompany}
            onGetShareLink={onGetShareLink}
            today={today}
          />
        )}
      </main>

      {showGrantForm && (
        <GrantFormModal
          stakeholders={data.stakeholders}
          existing={null}
          totalAuthorizedShares={data.company.totalAuthorizedShares}
          onSave={upsertGrant}
          onClose={() => setShowGrantForm(false)}
        />
      )}

      {showPersonForm && (
        <PersonFormModal onSave={addStakeholder} onClose={() => setShowPersonForm(false)} />
      )}

      <CapTableChat data={data} today={today} />
    </div>
  )
}

function DashboardView({
  data,
  totals,
  capSlices,
  today,
  onEditCompany,
  onExportCSV,
  onExportPDF,
  userName,
}: {
  data: AppData
  totals: { granted: number; vested: number; unvested: number; base: number }
  capSlices: { name: string; value: number; color?: string }[]
  today: Date
  onEditCompany: () => void
  onExportCSV: () => void
  onExportPDF: () => void
  userName?: string | null
}) {
  const vestPct = totals.granted > 0 ? (totals.vested / totals.granted) * 100 : 0
  const hasGrants = data.grants.length > 0

  return (
    <div className="space-y-8 text-left">
      {/* Welcome + actions row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {userName && (
            <p className="mb-1 text-sm font-medium text-[#3ee8b5]">
              Welcome back, {userName}
            </p>
          )}
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
            {data.company.name}
          </h2>
          <p className="mt-1 text-sm text-[#8b92a8]">As of {format(today, 'MMMM d, yyyy')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            onClick={onExportCSV}
            title="Download all grants as a CSV spreadsheet"
            className="flex items-center gap-1.5 rounded-lg border border-[#2a3142] bg-[#1a1f2e] px-3 py-2 text-sm font-medium text-[#e8eaf0] transition hover:border-[#3ee8b5]/40 hover:text-[#3ee8b5]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
          <button
            type="button"
            onClick={onExportPDF}
            title="Export cap table as a printable PDF"
            className="flex items-center gap-1.5 rounded-lg border border-[#2a3142] bg-[#1a1f2e] px-3 py-2 text-sm font-medium text-[#e8eaf0] transition hover:border-[#3ee8b5]/40 hover:text-[#3ee8b5]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Export PDF
          </button>
          <button
            type="button"
            onClick={onEditCompany}
            className="rounded-lg border border-[#2a3142] bg-[#1a1f2e] px-4 py-2 text-sm font-medium text-[#e8eaf0] transition hover:border-[#3ee8b5]/40"
          >
            Edit company & grants
          </button>
        </div>
      </div>

      {/* Stat cards with ambient glow */}
      <div className="relative">
        <div className="pointer-events-none absolute -top-6 left-1/2 h-40 w-3/4 -translate-x-1/2 rounded-full bg-[#3ee8b5]/[0.05] blur-3xl" />
        <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total granted" value={formatShares(totals.granted)} hint="All grants" />
          <StatCard
            label="Vested"
            value={formatShares(totals.vested)}
            hint={`${vestPct.toFixed(1)}% of granted`}
            accent
          />
          <StatCard label="Unvested" value={formatShares(totals.unvested)} hint="On schedule" />
          <StatCard
            label="Authorized pool"
            value={
              data.company.totalAuthorizedShares ? formatShares(data.company.totalAuthorizedShares) : '—'
            }
            hint={data.company.totalAuthorizedShares ? 'Fully diluted base' : 'Optional — set in Team & grants'}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Ownership card */}
        <section className={`${card} min-w-0 p-6 lg:col-span-2`}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3ee8b5]/10 text-[#3ee8b5]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-base font-semibold leading-none">Ownership</h3>
              <p className="mt-1 text-xs text-[#8b92a8]">
                {data.company.totalAuthorizedShares ? 'Share of authorized cap' : 'Share of total granted'}
              </p>
            </div>
          </div>
          {capSlices.length > 0 ? (
            <>
              <CapTableChart slices={capSlices} />
              <ul className="mt-3 space-y-2 text-sm">
                {capSlices.map((s) => (
                  <li key={s.name} className="flex justify-between border-b border-[#2a3142]/50 pb-1.5 last:border-0 last:pb-0">
                    <span className="text-[#e8eaf0]">{s.name}</span>
                    <span className="tabular-nums text-[#8b92a8]">{s.value}%</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="mt-8 flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-[#2a3142] bg-[#1a1f2e]/80">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-[#3a4154]">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-sm text-[#8b92a8]">Add grants to see ownership</p>
              <button
                type="button"
                onClick={onEditCompany}
                className="mt-1 rounded-lg bg-[#3ee8b5]/10 px-4 py-1.5 text-xs font-semibold text-[#3ee8b5] transition hover:bg-[#3ee8b5]/20"
              >
                Add your first grant →
              </button>
            </div>
          )}
        </section>

        {/* Milestones card */}
        <section className={`${card} p-6 lg:col-span-3`}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#6b8cff]/10 text-[#6b8cff]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-base font-semibold leading-none">Milestones</h3>
              <p className="mt-1 text-xs text-[#8b92a8]">Upcoming cliffs and final vest dates</p>
            </div>
          </div>
          <MilestoneList grants={data.grants} stakeholders={data.stakeholders} hasGrants={hasGrants} onEditCompany={onEditCompany} />
        </section>
      </div>
    </div>
  )
}

function MilestoneList({
  grants,
  stakeholders,
  hasGrants,
  onEditCompany,
}: {
  grants: EquityGrant[]
  stakeholders: Stakeholder[]
  hasGrants: boolean
  onEditCompany: () => void
}) {
  const byId = useMemo(() => new Map(stakeholders.map((s) => [s.id, s])), [stakeholders])
  const rows = useMemo(() => {
    const out: { date: Date; label: string; sub: string }[] = []
    for (const g of grants) {
      const sched = buildVestingSchedule(g)
      const cliffRow = sched[g.cliffMonths]
      if (cliffRow && cliffRow.vestedThisMonth > 0) {
        const d = new Date(g.startDate)
        d.setMonth(d.getMonth() + g.cliffMonths)
        out.push({
          date: d,
          label: `Cliff — ${formatShares(cliffRow.cumulativeVested)} shares`,
          sub: `${g.label} · ${byId.get(g.stakeholderId)?.name ?? 'Unknown'}`,
        })
      }
      const last = sched[sched.length - 1]
      if (last) {
        const d = new Date(g.startDate)
        d.setMonth(d.getMonth() + g.vestingMonths)
        out.push({
          date: d,
          label: `Fully vested — ${formatShares(g.shares)} shares`,
          sub: `${g.label} · ${byId.get(g.stakeholderId)?.name ?? 'Unknown'}`,
        })
      }
    }
    out.sort((a, b) => a.date.getTime() - b.date.getTime())
    return out.slice(0, 8)
  }, [grants, byId])

  if (rows.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-[#2a3142] bg-[#1a1f2e]/80">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-[#3a4154]">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm text-[#8b92a8]">
          {hasGrants ? 'No upcoming milestones.' : 'No grants yet — milestones will appear here.'}
        </p>
        {!hasGrants && (
          <button
            type="button"
            onClick={onEditCompany}
            className="mt-1 rounded-lg bg-[#3ee8b5]/10 px-4 py-1.5 text-xs font-semibold text-[#3ee8b5] transition hover:bg-[#3ee8b5]/20"
          >
            Add your first grant →
          </button>
        )}
      </div>
    )
  }

  return (
    <ul className="mt-6 space-y-3">
      {rows.map((r, i) => (
        <li
          key={i}
          className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#2a3142]/80 pb-3 last:border-0 last:pb-0"
        >
          <div>
            <p className="font-medium text-[#e8eaf0]">{r.label}</p>
            <p className="text-sm text-[#8b92a8]">{r.sub}</p>
          </div>
          <time className="text-sm tabular-nums text-[#3ee8b5]">{format(r.date, 'MMM d, yyyy')}</time>
        </li>
      ))}
    </ul>
  )
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-5 transition ${
        accent
          ? 'border-[#3ee8b5]/25 bg-[#3ee8b5]/[0.06] hover:border-[#3ee8b5]/40 hover:bg-[#3ee8b5]/[0.09]'
          : 'border-[#2a3142] bg-[#1a1f2e] hover:border-[#3ee8b5]/20 hover:bg-[#1e2436]'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">{label}</p>
      <p className={`mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums ${accent ? 'text-[#3ee8b5]' : ''}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-[#8b92a8]">{hint}</p>
    </div>
  )
}

const AVATAR_COLORS: [string, string][] = [
  ['#3ee8b5', '#0c2e24'],
  ['#6b8cff', '#0d1433'],
  ['#e8c547', '#2e2500'],
  ['#c084fc', '#1e0a2e'],
  ['#ff6b5b', '#2e0f0a'],
  ['#5eead4', '#0a2422'],
]

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function avatarColors(name: string): [string, string] {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

const GRANT_TYPE_STYLES: Record<GrantType, string> = {
  iso: 'border-[#6b8cff]/40 bg-[#6b8cff]/10 text-[#6b8cff]',
  nso: 'border-[#c084fc]/40 bg-[#c084fc]/10 text-[#c084fc]',
  rsu: 'border-[#e8c547]/40 bg-[#e8c547]/10 text-[#e8c547]',
  common: 'border-[#8b92a8]/30 bg-[#8b92a8]/10 text-[#8b92a8]',
}

function GrantTypeBadge({ type }: { type: GrantType }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${GRANT_TYPE_STYLES[type]}`}>
      {grantTypeLabel(type)}
    </span>
  )
}

function GrantsView({
  data,
  selectedGrant,
  onSelectGrant,
  onShowGrantForm,
  onShowPersonForm,
  onDeleteGrant,
  onRemoveStakeholder,
  upsertGrant,
  updateCompany,
  onGetShareLink,
  today,
}: {
  data: AppData
  selectedGrant: EquityGrant | null
  onSelectGrant: (id: string | null) => void
  onShowGrantForm: () => void
  onShowPersonForm: () => void
  onDeleteGrant: (id: string) => void
  onRemoveStakeholder: (id: string) => void
  upsertGrant: (g: EquityGrant | Omit<EquityGrant, 'id'>) => void
  updateCompany: (patch: Partial<AppData['company']>) => void
  onGetShareLink?: (stakeholderId: string) => Promise<string | null>
  today: Date
}) {
  const [editingGrant, setEditingGrant] = useState<EquityGrant | null>(null)
  const [companyName, setCompanyName] = useState(data.company.name)
  const [authShares, setAuthShares] = useState(data.company.totalAuthorizedShares?.toString() ?? '')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareName, setShareName] = useState('')
  const [shareLoading, setShareLoading] = useState<string | null>(null) // stakeholderId being generated
  const [shareCopied, setShareCopied] = useState(false)

  const handleShareLink = async (stakeholderId: string, stakeholderName: string) => {
    if (!onGetShareLink) return
    setShareLoading(stakeholderId)
    const url = await onGetShareLink(stakeholderId)
    setShareLoading(null)
    if (url) { setShareUrl(url); setShareName(stakeholderName); setShareCopied(false) }
  }

  const copyShareUrl = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  const persistAuthorized = () => {
    const raw = authShares.trim()
    const n = raw === '' ? undefined : parseInt(raw.replace(/,/g, ''), 10)
    updateCompany({
      totalAuthorizedShares: Number.isFinite(n) && n! > 0 ? n : undefined,
    })
  }

  return (
    <div className="grid gap-8 text-left lg:grid-cols-12">
      <aside className="space-y-6 lg:col-span-4">

        {/* Company section */}
        <section className={`${card} p-5`}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e8c547]/10 text-[#e8c547]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M8 10v4M12 10v4M16 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-display)] text-base font-semibold leading-none">Company</h3>
          </div>
          <label className="mt-4 block text-xs font-medium uppercase tracking-wider text-[#8b92a8]">
            Name
          </label>
          <input
            className={`${inputCls} mt-1`}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onBlur={() => updateCompany({ name: companyName.trim() || 'My company' })}
          />
          <label className="mt-4 block text-xs font-medium uppercase tracking-wider text-[#8b92a8]">
            Authorized shares (optional)
          </label>
          <input
            className={`${inputCls} mt-1`}
            placeholder="e.g. 10000000"
            value={authShares}
            onChange={(e) => setAuthShares(e.target.value)}
            onBlur={persistAuthorized}
          />
          <p className="mt-2 text-xs text-[#8b92a8]">
            Set this to your fully diluted share count to enter grants as a percent (e.g. 0.25%–1%) and see ownership.
          </p>
        </section>

        {/* Team section */}
        <section className={`${card} p-5`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3ee8b5]/10 text-[#3ee8b5]">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="font-[family-name:var(--font-display)] text-base font-semibold leading-none">Team</h3>
            </div>
            <button
              type="button"
              onClick={onShowPersonForm}
              className="rounded-lg bg-[#3ee8b5]/15 px-3 py-1.5 text-xs font-semibold text-[#3ee8b5] transition hover:bg-[#3ee8b5]/25"
            >
              Add person
            </button>
          </div>
          {data.stakeholders.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[#2a3142] py-6 text-center">
              <p className="text-sm text-[#8b92a8]">No team members yet</p>
              <button
                type="button"
                onClick={onShowPersonForm}
                className="mt-2 text-xs font-semibold text-[#3ee8b5] hover:underline"
              >
                Add your first person →
              </button>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {data.stakeholders.map((s) => {
                const [bg, fg] = avatarColors(s.name)
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#2a3142]/80 bg-[#0c0f14]/50 px-3 py-2.5 transition hover:border-[#2a3142]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                        style={{ background: bg, color: fg }}
                      >
                        {nameInitials(s.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-tight">{s.name}</p>
                        <p className="text-xs text-[#8b92a8]">{s.role}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {onGetShareLink && (
                        <button
                          type="button"
                          onClick={() => handleShareLink(s.id, s.name)}
                          disabled={shareLoading === s.id}
                          className="text-xs text-[#3ee8b5]/70 transition hover:text-[#3ee8b5] disabled:opacity-50"
                          title="Get read-only link for this person"
                        >
                          {shareLoading === s.id ? '…' : 'Share'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveStakeholder(s.id)}
                        className="text-xs text-[#ff6b5b]/60 transition hover:text-[#ff6b5b]"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Grants section */}
        <section className={`${card} p-5`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#6b8cff]/10 text-[#6b8cff]">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="9" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="font-[family-name:var(--font-display)] text-base font-semibold leading-none">Grants</h3>
            </div>
            <button
              type="button"
              onClick={onShowGrantForm}
              className="rounded-lg bg-[#3ee8b5] px-3 py-1.5 text-xs font-semibold text-[#0c0f14] transition hover:brightness-110"
            >
              New grant
            </button>
          </div>
          {data.grants.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[#2a3142] py-6 text-center">
              <p className="text-sm text-[#8b92a8]">No grants yet</p>
              <button
                type="button"
                onClick={onShowGrantForm}
                className="mt-2 text-xs font-semibold text-[#3ee8b5] hover:underline"
              >
                Create your first grant →
              </button>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {data.grants.map((g) => {
                const person = data.stakeholders.find((s) => s.id === g.stakeholderId)
                const vested = vestedSharesAt(g, today)
                const vestPct = g.shares > 0 ? (vested / g.shares) * 100 : 0
                const active = selectedGrant?.id === g.id
                const auth = data.company.totalAuthorizedShares
                const pctAuth = auth && auth > 0 ? formatOwnershipPercent(g.shares, auth) : null
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => onSelectGrant(active ? null : g.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-[#3ee8b5]/40 bg-[#3ee8b5]/10'
                          : 'border-[#2a3142] bg-[#0c0f14]/50 hover:border-[#2a3142] hover:bg-[#0c0f14]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">{g.label}</p>
                        <GrantTypeBadge type={g.grantType} />
                      </div>
                      <p className="mt-1 text-xs text-[#8b92a8]">
                        {person?.name ?? 'Unknown'} · {formatShares(g.shares)} shares
                        {pctAuth !== null ? ` · ~${pctAuth}%` : ''}
                      </p>
                      {/* Vesting progress bar */}
                      <div className="mt-2.5">
                        <div className="flex items-center justify-between text-[10px] text-[#8b92a8]">
                          <span className="text-[#3ee8b5]">{formatShares(vested)} vested</span>
                          <span>{vestPct.toFixed(1)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#2a3142]">
                          <div
                            className="h-full rounded-full bg-[#3ee8b5] transition-all"
                            style={{ width: `${Math.min(vestPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </aside>

      <div className="min-w-0 lg:col-span-8">
        {selectedGrant ? (
          <GrantDetailPanel
            grant={selectedGrant}
            stakeholder={data.stakeholders.find((s) => s.id === selectedGrant.stakeholderId)}
            totalAuthorizedShares={data.company.totalAuthorizedShares}
            today={today}
            onEdit={() => setEditingGrant(selectedGrant)}
            onDelete={() => onDeleteGrant(selectedGrant.id)}
          />
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[#2a3142] bg-[#1a1f2e]/50 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2a3142] bg-[#0c0f14]/80 text-[#3a4154]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="9" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="font-[family-name:var(--font-display)] text-base font-semibold text-[#e8eaf0]">
                Select a grant to view details
              </p>
              <p className="mt-1 max-w-xs text-sm text-[#8b92a8]">
                Click any grant on the left, or create a new one to see its vesting schedule and breakdown.
              </p>
            </div>
            <button
              type="button"
              onClick={onShowGrantForm}
              className="rounded-lg bg-[#3ee8b5]/10 px-5 py-2 text-sm font-semibold text-[#3ee8b5] transition hover:bg-[#3ee8b5]/20"
            >
              New grant →
            </button>
          </div>
        )}
      </div>

      {editingGrant && (
        <GrantFormModal
          stakeholders={data.stakeholders}
          existing={editingGrant}
          totalAuthorizedShares={data.company.totalAuthorizedShares}
          onSave={(g) => {
            upsertGrant(g as EquityGrant)
            setEditingGrant(null)
          }}
          onClose={() => setEditingGrant(null)}
        />
      )}

      {/* Share link modal */}
      {shareUrl && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-[#2a3142] bg-[#1a1f2e] p-6 shadow-xl">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Share link for {shareName}
            </h3>
            <p className="mt-1 text-sm text-[#8b92a8]">
              Anyone with this link can view {shareName}'s grant details (read-only, no sign-in required).
            </p>
            <div className="mt-4 flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="min-w-0 flex-1 rounded-xl border border-[#2a3142] bg-[#0c0f14] px-3 py-2 text-sm text-[#e8eaf0] outline-none"
              />
              <button
                type="button"
                onClick={copyShareUrl}
                className="shrink-0 rounded-xl bg-[#3ee8b5] px-4 py-2 text-sm font-semibold text-[#0c0f14] hover:brightness-110"
              >
                {shareCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="mt-3 text-xs text-[#8b92a8]">
              The link is stable — sharing it again for the same person reuses this URL.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShareUrl(null)}
                className="rounded-lg border border-[#2a3142] px-4 py-2 text-sm font-medium hover:bg-[#0c0f14]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GrantDetailPanel({
  grant,
  stakeholder,
  totalAuthorizedShares,
  today,
  onEdit,
  onDelete,
}: {
  grant: EquityGrant
  stakeholder?: Stakeholder
  totalAuthorizedShares?: number
  today: Date
  onEdit: () => void
  onDelete: () => void
}) {
  const vested = vestedSharesAt(grant, today)
  const schedule = buildVestingSchedule(grant)
  const cliffDate = new Date(grant.startDate)
  cliffDate.setMonth(cliffDate.getMonth() + grant.cliffMonths)
  const endDate = new Date(grant.startDate)
  endDate.setMonth(endDate.getMonth() + grant.vestingMonths)

  return (
    <div className="space-y-6">
      <div className={`${card} p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">
              {grantTypeLabel(grant.grantType)}
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">{grant.label}</h2>
            <p className="mt-1 text-sm text-[#8b92a8]">
              {stakeholder?.name ?? 'Unknown'} · {stakeholder?.role}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-[#2a3142] px-4 py-2 text-sm font-medium hover:border-[#3ee8b5]/40"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg border border-[#ff6b5b]/30 px-4 py-2 text-sm font-medium text-[#ff6b5b] hover:bg-[#ff6b5b]/10"
            >
              Delete
            </button>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-[#0c0f14]/60 p-4">
            <dt className="text-xs text-[#8b92a8]">Grant size</dt>
            <dd className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold tabular-nums">
              {grant.shares.toLocaleString()} <span className="text-base font-normal text-[#8b92a8]">shares</span>
            </dd>
            {totalAuthorizedShares && totalAuthorizedShares > 0 ? (
              <dd className="mt-1 text-sm tabular-nums text-[#3ee8b5]">
                ~{formatOwnershipPercent(grant.shares, totalAuthorizedShares)}% of authorized
              </dd>
            ) : null}
          </div>
          <div className="rounded-xl bg-[#0c0f14]/60 p-4">
            <dt className="text-xs text-[#8b92a8]">Vested now</dt>
            <dd className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold tabular-nums text-[#3ee8b5]">
              {vested.toLocaleString()}
            </dd>
          </div>
          <div className="rounded-xl bg-[#0c0f14]/60 p-4">
            <dt className="text-xs text-[#8b92a8]">Cliff</dt>
            <dd className="mt-1 text-sm font-medium">
              {grant.cliffMonths} mo · {format(cliffDate, 'MMM yyyy')}
            </dd>
          </div>
          <div className="rounded-xl bg-[#0c0f14]/60 p-4">
            <dt className="text-xs text-[#8b92a8]">Fully vested</dt>
            <dd className="mt-1 text-sm font-medium">{format(endDate, 'MMM yyyy')}</dd>
          </div>
        </dl>

        {grant.notes ? (
          <p className="mt-4 rounded-lg border border-[#2a3142]/80 bg-[#0c0f14]/40 p-3 text-sm text-[#8b92a8]">
            {grant.notes}
          </p>
        ) : null}
      </div>

      <div className={`${card} p-6`}>
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Vesting curve</h3>
        <p className="mt-1 text-sm text-[#8b92a8]">Cumulative vested shares</p>
        <div className="mt-4 min-w-0">
          <VestingChart grant={grant} />
        </div>
      </div>

      <div className={`${card} p-6`}>
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Month-by-month</h3>
        <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-[#2a3142]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#161a24] text-xs uppercase tracking-wider text-[#8b92a8]">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">This month</th>
                <th className="px-4 py-3 text-right">Cumulative</th>
                <th className="px-4 py-3 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row) => (
                <tr key={row.monthIndex} className="border-t border-[#2a3142]/60 hover:bg-[#0c0f14]/40">
                  <td className="px-4 py-2 text-[#8b92a8]">{row.dateLabel}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {row.vestedThisMonth > 0 ? row.vestedThisMonth.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.cumulativeVested.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-[#3ee8b5]">
                    {row.percentVested.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function trimPercentInput(n: number): string {
  if (!Number.isFinite(n)) return ''
  return n.toFixed(12).replace(/\.?0+$/, '')
}

function GrantFormModal({
  stakeholders,
  existing,
  totalAuthorizedShares,
  onSave,
  onClose,
}: {
  stakeholders: Stakeholder[]
  existing: EquityGrant | null
  totalAuthorizedShares?: number
  onSave: (g: EquityGrant | Omit<EquityGrant, 'id'>) => void
  onClose: () => void
}) {
  const auth =
    totalAuthorizedShares !== undefined &&
    totalAuthorizedShares !== null &&
    totalAuthorizedShares > 0
      ? totalAuthorizedShares
      : null

  const defaultSharesIfPercent = auth ? percentOfAuthorizedToShares(0.5, auth) : 100_000

  const [sizeMode, setSizeMode] = useState<'shares' | 'percent'>(() => (auth ? 'percent' : 'shares'))

  const [stakeholderId, setStakeholderId] = useState(existing?.stakeholderId ?? stakeholders[0]?.id ?? '')
  const [label, setLabel] = useState(existing?.label ?? 'New grant')
  const [grantType, setGrantType] = useState<GrantType>(existing?.grantType ?? 'common')
  const [shares, setShares] = useState(existing?.shares?.toString() ?? String(defaultSharesIfPercent))
  const [percentStr, setPercentStr] = useState(
    () =>
      existing && auth
        ? trimPercentInput(sharesToPercentOfAuthorized(existing.shares, auth))
        : auth
          ? '0.5'
          : ''
  )
  const [startDate, setStartDate] = useState(
    existing?.startDate ?? format(startOfMonth(new Date()), 'yyyy-MM-dd')
  )
  const [cliffMonths, setCliffMonths] = useState(existing?.cliffMonths?.toString() ?? '12')
  const [vestingMonths, setVestingMonths] = useState(existing?.vestingMonths?.toString() ?? '48')
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const resolvedShareCount = useMemo(() => {
    if (sizeMode === 'percent' && auth) {
      const p = parsePercentInput(percentStr)
      if (p === null || p <= 0) return null
      return percentOfAuthorizedToShares(p, auth)
    }
    const sh = parseInt(shares.replace(/,/g, ''), 10)
    return Number.isFinite(sh) && sh > 0 ? sh : null
  }, [sizeMode, auth, percentStr, shares])

  const resolvedPercentHint = useMemo(() => {
    if (!auth || !resolvedShareCount) return null
    return formatOwnershipPercent(resolvedShareCount, auth)
  }, [auth, resolvedShareCount])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const cliff = parseInt(cliffMonths, 10)
    const vest = parseInt(vestingMonths, 10)
    const sh =
      sizeMode === 'percent' && auth
        ? (() => {
            const p = parsePercentInput(percentStr)
            if (p === null || p <= 0) return NaN
            return percentOfAuthorizedToShares(p, auth)
          })()
        : parseInt(shares.replace(/,/g, ''), 10)
    if (!stakeholderId || !Number.isFinite(sh) || sh <= 0) return
    if (!Number.isFinite(cliff) || cliff < 0 || !Number.isFinite(vest) || vest < 1) return
    const payload = {
      stakeholderId,
      label: label.trim() || 'Grant',
      grantType,
      shares: sh,
      startDate,
      cliffMonths: cliff,
      vestingMonths: Math.max(vest, cliff),
      notes: notes.trim() || undefined,
    }
    if (existing) {
      onSave({ ...existing, ...payload })
    } else {
      onSave(payload)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2a3142] bg-[#1a1f2e] p-6 shadow-xl"
      >
        <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {existing ? 'Edit grant' : 'New grant'}
        </h3>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">Person</label>
            <select
              className={`${inputCls} mt-1`}
              value={stakeholderId}
              onChange={(e) => setStakeholderId(e.target.value)}
              required
            >
              {stakeholders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">Label</label>
            <input className={`${inputCls} mt-1`} value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">Type</label>
            <select
              className={`${inputCls} mt-1`}
              value={grantType}
              onChange={(e) => setGrantType(e.target.value as GrantType)}
            >
              <option value="common">Common</option>
              <option value="iso">ISO</option>
              <option value="nso">NSO</option>
              <option value="rsu">RSU</option>
            </select>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">
                Grant size
              </label>
              {auth ? (
                <div className="flex gap-1 rounded-lg bg-[#0c0f14] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      const sh = parseInt(shares.replace(/,/g, ''), 10)
                      if (Number.isFinite(sh) && sh > 0) {
                        setPercentStr(trimPercentInput(sharesToPercentOfAuthorized(sh, auth)))
                      }
                      setSizeMode('percent')
                    }}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                      sizeMode === 'percent'
                        ? 'bg-[#2a3142] text-white'
                        : 'text-[#8b92a8] hover:text-[#e8eaf0]'
                    }`}
                  >
                    % of authorized
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = parsePercentInput(percentStr)
                      if (p !== null && p > 0) {
                        setShares(String(percentOfAuthorizedToShares(p, auth)))
                      }
                      setSizeMode('shares')
                    }}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                      sizeMode === 'shares'
                        ? 'bg-[#2a3142] text-white'
                        : 'text-[#8b92a8] hover:text-[#e8eaf0]'
                    }`}
                  >
                    Shares
                  </button>
                </div>
              ) : null}
            </div>
            {auth && sizeMode === 'percent' ? (
              <>
                <input
                  className={`${inputCls} mt-1`}
                  value={percentStr}
                  onChange={(e) => setPercentStr(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="e.g. 0.5 for 0.5%"
                />
                <p className="mt-1 text-xs text-[#8b92a8]">
                  Percent of authorized shares ({auth.toLocaleString()} total).{' '}
                  {resolvedShareCount !== null
                    ? `≈ ${resolvedShareCount.toLocaleString()} shares after rounding.`
                    : 'Enter a value above 0.'}
                  {resolvedShareCount !== null && resolvedPercentHint !== null ? (
                    <span className="text-[#8b92a8]/80">
                      {' '}
                      (Exact % after rounding: ~{resolvedPercentHint}%.)
                    </span>
                  ) : null}
                </p>
              </>
            ) : (
              <>
                <input
                  className={`${inputCls} mt-1`}
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  inputMode="numeric"
                />
                {!auth ? (
                  <p className="mt-1 text-xs text-[#8b92a8]">
                    Add <strong>authorized shares</strong> under Company to size grants as a percent (typical
                    for 0.1%–1% employee offers).
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[#8b92a8]">
                    {resolvedShareCount !== null && resolvedPercentHint !== null
                      ? `≈ ${resolvedPercentHint}% of authorized shares.`
                      : 'Enter a positive share count.'}
                  </p>
                )}
              </>
            )}
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">Vesting start</label>
            <input
              type="date"
              className={`${inputCls} mt-1`}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">
                Cliff (months)
              </label>
              <input
                className={`${inputCls} mt-1`}
                value={cliffMonths}
                onChange={(e) => setCliffMonths(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">
                Vesting (months)
              </label>
              <input
                className={`${inputCls} mt-1`}
                value={vestingMonths}
                onChange={(e) => setVestingMonths(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">Notes</label>
            <textarea
              className={`${inputCls} mt-1 min-h-[80px]`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#2a3142] px-4 py-2 text-sm font-medium hover:bg-[#0c0f14]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#3ee8b5] px-4 py-2 text-sm font-semibold text-[#0c0f14] hover:brightness-110"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PersonFormModal({
  onSave,
  onClose,
}: {
  onSave: (s: Omit<Stakeholder, 'id'>) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), role: role.trim() || 'Team', email: email.trim() || undefined })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-[#2a3142] bg-[#1a1f2e] p-6 shadow-xl">
        <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold">Add team member</h3>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">Name</label>
            <input
              className={`${inputCls} mt-1`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">Role</label>
            <input
              className={`${inputCls} mt-1`}
              placeholder="e.g. Engineer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">
              Email (optional)
            </label>
            <input
              type="email"
              className={`${inputCls} mt-1`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#2a3142] px-4 py-2 text-sm font-medium hover:bg-[#0c0f14]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#3ee8b5] px-4 py-2 text-sm font-semibold text-[#0c0f14] hover:brightness-110"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
