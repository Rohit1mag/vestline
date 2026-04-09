import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import { createAnonSupabaseClient } from '../lib/supabase'
import { getGrantByShareToken, type GrantSharePayload } from '../lib/vestlineRemote'
import type { EquityGrant } from '../types'
import { vestedSharesAt } from '../vesting'
import { VestingChart } from './VestingChart'
import { VestlineLogo } from './VestlineLogo'

function formatShares(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

const GRANT_TYPE_LABELS: Record<string, string> = {
  iso: 'ISO',
  nso: 'NSO',
  rsu: 'RSU',
  common: 'Common',
}

function GrantCard({ grant, today }: { grant: EquityGrant; today: Date }) {
  const vested = vestedSharesAt(grant, today)
  const unvested = grant.shares - vested
  const vestPct = grant.shares > 0 ? (vested / grant.shares) * 100 : 0

  const cliffDate = new Date(grant.startDate)
  cliffDate.setMonth(cliffDate.getMonth() + grant.cliffMonths)
  const endDate = new Date(grant.startDate)
  endDate.setMonth(endDate.getMonth() + grant.vestingMonths)

  return (
    <div className="rounded-2xl border border-[#2a3142] bg-[#1a1f2e] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#8b92a8]">
            {GRANT_TYPE_LABELS[grant.grantType] ?? grant.grantType}
          </p>
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">
            {grant.label}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#8b92a8]">Grant size</p>
          <p className="font-[family-name:var(--font-display)] text-xl font-semibold tabular-nums">
            {formatShares(grant.shares)}
          </p>
        </div>
      </div>

      {/* Vesting progress bar */}
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-xs text-[#8b92a8]">
          <span>Vested</span>
          <span className="tabular-nums text-[#3ee8b5]">{vestPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#2a3142]">
          <div
            className="h-full rounded-full bg-[#3ee8b5] transition-all"
            style={{ width: `${vestPct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs tabular-nums text-[#8b92a8]">
          <span className="text-[#3ee8b5]">{formatShares(vested)} vested</span>
          <span>{formatShares(unvested)} remaining</span>
        </div>
      </div>

      {/* Key dates */}
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Start date', value: format(new Date(grant.startDate), 'MMM d, yyyy') },
          { label: 'Cliff', value: format(cliffDate, 'MMM d, yyyy') },
          { label: 'Cliff period', value: `${grant.cliffMonths} months` },
          { label: 'Fully vested', value: format(endDate, 'MMM d, yyyy') },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-[#0c0f14]/60 p-3">
            <dt className="text-xs text-[#8b92a8]">{item.label}</dt>
            <dd className="mt-1 text-sm font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>

      {grant.notes && (
        <p className="mt-4 rounded-lg border border-[#2a3142]/80 bg-[#0c0f14]/40 p-3 text-sm text-[#8b92a8]">
          {grant.notes}
        </p>
      )}

      {/* Vesting chart */}
      <div className="mt-6">
        <p className="mb-3 text-sm font-medium text-[#8b92a8]">Vesting schedule</p>
        <VestingChart grant={grant} />
      </div>
    </div>
  )
}

type ViewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'notfound' }
  | { status: 'ready'; data: GrantSharePayload }

export function EmployeeGrantView({ token }: { token: string }) {
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const today = new Date()

  useEffect(() => {
    const client = createAnonSupabaseClient()
    if (!client) {
      setState({ status: 'error', message: 'Supabase is not configured.' })
      return
    }

    void getGrantByShareToken(client, token).then(({ data, error }) => {
      if (error) { setState({ status: 'error', message: error.message }); return }
      if (!data) { setState({ status: 'notfound' }); return }
      setState({ status: 'ready', data })
    })
  }, [token])

  return (
    <div className="min-h-svh bg-[#0c0f14] text-[#e8eaf0]">
      {/* Minimal header */}
      <header className="border-b border-[#2a3142] bg-[#0c0f14]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-4">
          <VestlineLogo size={36} />
          <div>
            <span className="font-[family-name:var(--font-display)] font-semibold">Vestline</span>
            <span className="ml-2 text-xs text-[#8b92a8]">
              {state.status === 'ready' ? state.data.company.name : ''}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {state.status === 'loading' && (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a3142] border-t-[#3ee8b5]" />
          </div>
        )}

        {state.status === 'error' && (
          <div className="rounded-2xl border border-[#ff6b5b]/30 bg-[#ff6b5b]/10 p-8 text-center">
            <p className="font-semibold text-[#ff6b5b]">Something went wrong</p>
            <p className="mt-2 text-sm text-[#8b92a8]">{state.message}</p>
          </div>
        )}

        {state.status === 'notfound' && (
          <div className="rounded-2xl border border-[#2a3142] bg-[#1a1f2e] p-8 text-center">
            <p className="font-semibold">Link not found</p>
            <p className="mt-2 text-sm text-[#8b92a8]">
              This equity link is invalid or may have been removed.
            </p>
          </div>
        )}

        {state.status === 'ready' && (
          <div className="space-y-8">
            {/* Person header */}
            <div>
              <p className="text-sm text-[#8b92a8]">Your equity at</p>
              <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold">
                {state.data.company.name}
              </h1>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3ee8b5]/15 text-sm font-bold text-[#3ee8b5]">
                  {state.data.stakeholder.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{state.data.stakeholder.name}</p>
                  <p className="text-sm text-[#8b92a8]">{state.data.stakeholder.role}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[#8b92a8]">
                As of {format(today, 'MMMM d, yyyy')}
              </p>
            </div>

            {/* Summary stats */}
            {state.data.grants.length > 0 && (() => {
              const totalGranted = state.data.grants.reduce((a, g) => a + g.shares, 0)
              const totalVested = state.data.grants.reduce(
                (a, g) => a + vestedSharesAt(g, today),
                0
              )
              return (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total granted', value: formatShares(totalGranted), accent: false },
                    { label: 'Vested today', value: formatShares(totalVested), accent: true },
                    {
                      label: 'Unvested',
                      value: formatShares(totalGranted - totalVested),
                      accent: false,
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className={`rounded-2xl border p-4 ${
                        s.accent
                          ? 'border-[#3ee8b5]/25 bg-[#3ee8b5]/[0.06]'
                          : 'border-[#2a3142] bg-[#1a1f2e]'
                      }`}
                    >
                      <p className="text-xs uppercase tracking-wider text-[#8b92a8]">{s.label}</p>
                      <p
                        className={`mt-1 font-[family-name:var(--font-display)] text-xl font-semibold tabular-nums ${
                          s.accent ? 'text-[#3ee8b5]' : ''
                        }`}
                      >
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Grant cards */}
            {state.data.grants.length === 0 ? (
              <p className="text-center text-sm text-[#8b92a8]">No grants found for this link.</p>
            ) : (
              state.data.grants.map((g) => (
                <GrantCard key={g.id} grant={g} today={today} />
              ))
            )}

            {/* Disclaimer footer */}
            <p className="rounded-xl border border-[#2a3142]/60 bg-[#1a1f2e]/40 px-4 py-3 text-center text-xs text-[#8b92a8]">
              This view is read-only and for informational purposes only. It is not legal or financial advice.
              Share count and vesting dates may not reflect all amendments — consult your offer letter and legal counsel.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
