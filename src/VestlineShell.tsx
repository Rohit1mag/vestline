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
import { newGrant, newStakeholder } from './storage'
import type { AppData, EquityGrant, GrantType, Stakeholder } from './types'
import { buildVestingSchedule, grantTypeLabel, vestedSharesAt } from './vesting'

type Tab = 'dashboard' | 'grants'

export interface VestlineShellProps {
  data: AppData
  setData: React.Dispatch<React.SetStateAction<AppData>>
  syncBadge?: ReactNode
  authSlot?: ReactNode
  remoteError?: string | null
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
  remoteError,
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
}: {
  data: AppData
  totals: { granted: number; vested: number; unvested: number; base: number }
  capSlices: { name: string; value: number; color?: string }[]
  today: Date
  onEditCompany: () => void
}) {
  const vestPct = totals.granted > 0 ? (totals.vested / totals.granted) * 100 : 0

  return (
    <div className="space-y-8 text-left">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
            {data.company.name}
          </h2>
          <p className="mt-1 text-sm text-[#8b92a8]">As of {format(today, 'MMMM d, yyyy')}</p>
        </div>
        <button
          type="button"
          onClick={onEditCompany}
          className="self-start rounded-lg border border-[#2a3142] bg-[#1a1f2e] px-4 py-2 text-sm font-medium text-[#e8eaf0] hover:border-[#3ee8b5]/40"
        >
          Edit company & grants
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-6 lg:grid-cols-5">
        <section className={`${card} min-w-0 p-6 lg:col-span-2`}>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Ownership</h3>
          <p className="mt-1 text-sm text-[#8b92a8]">
            {data.company.totalAuthorizedShares ? 'Share of authorized cap' : 'Share of total granted'}
          </p>
          {capSlices.length > 0 ? (
            <CapTableChart slices={capSlices} />
          ) : (
            <p className="mt-10 text-center text-sm text-[#8b92a8]">Add grants to see the split</p>
          )}
          <ul className="mt-3 space-y-2 text-sm">
            {capSlices.map((s) => (
              <li key={s.name} className="flex justify-between text-[#8b92a8]">
                <span className="text-[#e8eaf0]">{s.name}</span>
                <span>{s.value}%</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${card} p-6 lg:col-span-3`}>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Milestones</h3>
          <p className="mt-1 text-sm text-[#8b92a8]">Cliffs and final vest dates</p>
          <MilestoneList grants={data.grants} stakeholders={data.stakeholders} />
        </section>
      </div>
    </div>
  )
}

function MilestoneList({ grants, stakeholders }: { grants: EquityGrant[]; stakeholders: Stakeholder[] }) {
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
    return <p className="mt-6 text-sm text-[#8b92a8]">No grants yet.</p>
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
      className={`rounded-2xl border p-5 ${
        accent
          ? 'border-[#3ee8b5]/25 bg-[#3ee8b5]/[0.06]'
          : 'border-[#2a3142] bg-[#1a1f2e]'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-[#8b92a8]">{hint}</p>
    </div>
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
  today: Date
}) {
  const [editingGrant, setEditingGrant] = useState<EquityGrant | null>(null)
  const [companyName, setCompanyName] = useState(data.company.name)
  const [authShares, setAuthShares] = useState(data.company.totalAuthorizedShares?.toString() ?? '')

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
        <section className={`${card} p-5`}>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Company</h3>
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
            Cap table % and grant sizing: set this to your fully diluted share count (or best estimate) to
            enter hires as a percent (e.g. 0.25%–1%) and see ownership.
          </p>
        </section>

        <section className={`${card} p-5`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Team</h3>
            <button
              type="button"
              onClick={onShowPersonForm}
              className="rounded-lg bg-[#3ee8b5]/15 px-3 py-1.5 text-xs font-semibold text-[#3ee8b5] hover:bg-[#3ee8b5]/25"
            >
              Add person
            </button>
          </div>
          <ul className="mt-4 space-y-3">
            {data.stakeholders.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-[#2a3142]/80 bg-[#0c0f14]/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-[#8b92a8]">{s.role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveStakeholder(s.id)}
                  className="shrink-0 text-xs text-[#ff6b5b]/80 hover:text-[#ff6b5b]"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${card} p-5`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Grants</h3>
            <button
              type="button"
              onClick={onShowGrantForm}
              className="rounded-lg bg-[#3ee8b5] px-3 py-1.5 text-xs font-semibold text-[#0c0f14] hover:brightness-110"
            >
              New grant
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {data.grants.map((g) => {
              const person = data.stakeholders.find((s) => s.id === g.stakeholderId)
              const vested = vestedSharesAt(g, today)
              const active = selectedGrant?.id === g.id
              const auth = data.company.totalAuthorizedShares
              const pctAuth =
                auth && auth > 0 ? formatOwnershipPercent(g.shares, auth) : null
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => onSelectGrant(active ? null : g.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-[#3ee8b5]/40 bg-[#3ee8b5]/10'
                        : 'border-[#2a3142] bg-[#0c0f14]/50 hover:bg-[#0c0f14]'
                    }`}
                  >
                    <p className="font-medium">{g.label}</p>
                    <p className="text-xs text-[#8b92a8]">
                      {person?.name ?? 'Unknown'} · {grantTypeLabel(g.grantType)} · {formatShares(g.shares)}{' '}
                      shares
                      {pctAuth !== null ? ` (~${pctAuth}% of authorized)` : ''}
                    </p>
                    <p className="mt-1 text-xs text-[#3ee8b5]">
                      {formatShares(vested)} vested (
                      {g.shares ? ((vested / g.shares) * 100).toFixed(1) : 0}%)
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
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
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#2a3142] bg-[#1a1f2e]/50 p-8 text-center">
            <p className="font-[family-name:var(--font-display)] text-lg font-medium text-[#8b92a8]">
              Select a grant
            </p>
            <p className="mt-2 max-w-sm text-sm text-[#8b92a8]">
              Or create one with &ldquo;New grant&rdquo;.
            </p>
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
