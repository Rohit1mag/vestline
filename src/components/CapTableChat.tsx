import { format, getYear } from 'date-fns'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { streamChat, type ChatMessage } from '../lib/together'
import type { AppData } from '../types'
import { vestedSharesAt } from '../vesting'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const SUGGESTED = [
  'Who has the most unvested shares?',
  'When is the next cliff event?',
  'Summarize all grants',
  'What % of the pool is allocated?',
]

/** Pre-compute year-end vesting snapshots from today through fully-vested date. */
function yearSnapshots(
  grant: { startDate: string; cliffMonths: number; vestingMonths: number; shares: number },
  today: Date,
  capBase: number
): string {
  const endDate = new Date(grant.startDate)
  endDate.setMonth(endDate.getMonth() + grant.vestingMonths)
  const firstYear = getYear(today)
  const lastYear = Math.max(getYear(today) + 1, getYear(endDate))
  const lines: string[] = []
  for (let yr = firstYear; yr <= lastYear; yr++) {
    const snap = new Date(yr, 11, 31) // Dec 31 of each year
    const vested = vestedSharesAt(grant as Parameters<typeof vestedSharesAt>[0], snap)
    const pctOfGranted = grant.shares > 0 ? ((vested / grant.shares) * 100).toFixed(1) : '0'
    const pctOfCap = capBase > 0 ? ((vested / capBase) * 100).toFixed(2) : null
    lines.push(
      `    Dec 31 ${yr}: ${vested.toLocaleString()} vested (${pctOfGranted}% of this grant${pctOfCap !== null ? `, ${pctOfCap}% of cap` : ''})`
    )
  }
  return lines.join('\n')
}

function buildSystemPrompt(data: AppData, today: Date): string {
  const { company, stakeholders, grants } = data
  const stakeMap = new Map(stakeholders.map((s) => [s.id, s]))

  const totalGranted = grants.reduce((a, g) => a + g.shares, 0)
  const totalVested = grants.reduce((a, g) => a + vestedSharesAt(g, today), 0)

  // Cap table % denominator: authorized shares if set, otherwise total granted
  const capBase = company.totalAuthorizedShares && company.totalAuthorizedShares > 0
    ? company.totalAuthorizedShares
    : totalGranted

  const capBaseLabel = company.totalAuthorizedShares && company.totalAuthorizedShares > 0
    ? 'authorized shares'
    : 'total granted shares (no authorized pool set)'

  // Per-stakeholder aggregate ownership
  const stakeholderSummary = stakeholders.length
    ? stakeholders
        .map((s) => {
          const sGrants = grants.filter((g) => g.stakeholderId === s.id)
          const sTotal = sGrants.reduce((a, g) => a + g.shares, 0)
          const sVested = sGrants.reduce((a, g) => a + vestedSharesAt(g, today), 0)
          const pctToday = capBase > 0 ? ((sVested / capBase) * 100).toFixed(2) : '0'
          const pctFullyDiluted = capBase > 0 ? ((sTotal / capBase) * 100).toFixed(2) : '0'
          return `${s.name} (${s.role}): ${sTotal.toLocaleString()} granted, ${sVested.toLocaleString()} vested today (${pctToday}% of cap today, ${pctFullyDiluted}% fully diluted)`
        })
        .join('\n')
    : 'No team members.'

  const grantsText = grants.length
    ? grants
        .map((g) => {
          const person = stakeMap.get(g.stakeholderId)
          const vested = vestedSharesAt(g, today)
          const unvested = g.shares - vested
          const vestPct = g.shares > 0 ? ((vested / g.shares) * 100).toFixed(1) : '0'
          const cliffDate = new Date(g.startDate)
          cliffDate.setMonth(cliffDate.getMonth() + g.cliffMonths)
          const endDate = new Date(g.startDate)
          endDate.setMonth(endDate.getMonth() + g.vestingMonths)
          const snapshots = yearSnapshots(g, today, capBase)
          return [
            `Grant: "${g.label}"`,
            `  Person: ${person?.name ?? 'Unknown'} (${person?.role ?? ''})`,
            `  Type: ${g.grantType.toUpperCase()}`,
            `  Total shares: ${g.shares.toLocaleString()} (${capBase > 0 ? ((g.shares / capBase) * 100).toFixed(2) : '?'}% of cap)`,
            `  Vested today: ${vested.toLocaleString()} (${vestPct}% of this grant)`,
            `  Unvested: ${unvested.toLocaleString()}`,
            `  Start date: ${g.startDate}`,
            `  Cliff: ${g.cliffMonths} months → ${format(cliffDate, 'MMM d, yyyy')}`,
            `  Fully vested: ${format(endDate, 'MMM d, yyyy')}`,
            ...(g.notes ? [`  Notes: ${g.notes}`] : []),
            `  Vesting snapshots (year-end):`,
            snapshots,
          ].join('\n')
        })
        .join('\n\n')
    : 'No grants have been added yet.'

  const teamText = stakeholders.length
    ? stakeholders
        .map((s) => `${s.name} — ${s.role}${s.email ? ` <${s.email}>` : ''}`)
        .join('\n')
    : 'No team members added yet.'

  return `You are an equity assistant built into Vestline, a startup equity planning tool. Answer questions about the cap table, grants, and vesting schedules using ONLY the pre-computed data provided below — do NOT recalculate vesting or ownership percentages yourself. Be concise and precise with numbers. Do not give tax or legal advice.

IMPORTANT — cap table % rule: All ownership percentages are relative to the CAP BASE (${capBase.toLocaleString()} ${capBaseLabel}). Never use "total granted" as the denominator when an authorized pool is set.

Today's date: ${format(today, 'MMMM d, yyyy')}

=== COMPANY ===
Name: ${company.name}
Authorized shares: ${company.totalAuthorizedShares ? company.totalAuthorizedShares.toLocaleString() : 'Not set'}
Cap base used for % calculations: ${capBase.toLocaleString()} ${capBaseLabel}

=== SUMMARY ===
Total granted: ${totalGranted.toLocaleString()} shares (${capBase > 0 ? ((totalGranted / capBase) * 100).toFixed(2) : '?'}% of cap)
Total vested today: ${totalVested.toLocaleString()} shares
Total unvested: ${(totalGranted - totalVested).toLocaleString()} shares
Number of stakeholders: ${stakeholders.length}
Number of grants: ${grants.length}

=== OWNERSHIP PER PERSON (today) ===
${stakeholderSummary}

=== TEAM ===
${teamText}

=== GRANTS (with year-end vesting snapshots) ===
${grantsText}`
}

export function CapTableChat({ data, today }: { data: AppData; today: Date }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setInput('')
    setError(null)

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed }
    const assistantId = crypto.randomUUID()
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', streaming: true }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setLoading(true)

    const systemPrompt = buildSystemPrompt(data, today)
    const history: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages
        .filter((m) => !m.streaming)
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: trimmed },
    ]

    abortRef.current = new AbortController()

    try {
      await streamChat(
        history,
        (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + token } : m
            )
          )
        },
        abortRef.current.signal
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setMessages((prev) => prev.filter((m) => m.id !== assistantId))
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
      )
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close AI assistant' : 'Ask AI about your cap table'}
        className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all focus:outline-none ${
          open
            ? 'bg-[#3ee8b5] text-[#0c0f14] hover:brightness-95'
            : 'bg-[#1a1f2e] border border-[#2a3142] text-[#3ee8b5] hover:border-[#3ee8b5]/60 hover:bg-[#22293a]'
        }`}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M19 16l.75 2.25L22 19l-2.25.75L19 22l-.75-2.25L16 19l2.25-.75L19 16z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 flex w-[min(420px,calc(100vw-3rem))] flex-col rounded-2xl border border-[#2a3142] bg-[#111520] shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 rounded-t-2xl border-b border-[#2a3142] bg-[#1a1f2e] px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3ee8b5]/15 text-[#3ee8b5]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#e8eaf0]">Ask your cap table</p>
              <p className="truncate text-xs text-[#8b92a8]">{data.company.name}</p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-[#8b92a8] hover:bg-[#0c0f14] hover:text-[#e8eaf0]"
              >
                Clear
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex max-h-[360px] min-h-[200px] flex-col gap-3 overflow-y-auto p-4">
            {isEmpty ? (
              <div className="flex flex-col gap-3">
                <p className="text-center text-sm text-[#8b92a8]">
                  Ask anything about your grants, vesting, or cap table.
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-xl border border-[#2a3142] bg-[#1a1f2e] px-3 py-2 text-left text-xs text-[#8b92a8] transition hover:border-[#3ee8b5]/40 hover:text-[#e8eaf0]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'rounded-br-sm bg-[#3ee8b5]/15 text-[#e8eaf0]'
                          : 'rounded-bl-sm border border-[#2a3142] bg-[#1a1f2e] text-[#e8eaf0]'
                      }`}
                    >
                      {m.role === 'user' ? (
                        m.content
                      ) : m.content ? (
                        <>
                          <Markdown
                            components={{
                              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="my-1 ml-3 space-y-0.5 list-disc">{children}</ul>,
                              ol: ({ children }) => <ol className="my-1 ml-3 space-y-0.5 list-decimal">{children}</ol>,
                              li: ({ children }) => <li className="leading-snug">{children}</li>,
                              strong: ({ children }) => <strong className="font-semibold text-[#e8eaf0]">{children}</strong>,
                              code: ({ children }) => <code className="rounded bg-[#0c0f14] px-1 py-0.5 text-xs text-[#3ee8b5]">{children}</code>,
                              h1: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
                              h2: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
                              h3: ({ children }) => <p className="mb-1 font-medium">{children}</p>,
                            }}
                          >
                            {m.content}
                          </Markdown>
                          {m.streaming && (
                            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse rounded-full bg-[#3ee8b5] align-middle" />
                          )}
                        </>
                      ) : m.streaming ? (
                        <ThinkingDots />
                      ) : null}
                    </div>
                  </div>
                ))}
                {error && (
                  <p className="rounded-xl border border-[#ff6b5b]/30 bg-[#ff6b5b]/10 px-3 py-2 text-xs text-[#ffb4a8]">
                    {error}
                  </p>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="rounded-b-2xl border-t border-[#2a3142] bg-[#1a1f2e] p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your cap table…"
                disabled={loading}
                className="max-h-[120px] min-h-[38px] flex-1 resize-none rounded-xl border border-[#2a3142] bg-[#0c0f14] px-3 py-2 text-sm text-[#e8eaf0] placeholder-[#8b92a8]/60 outline-none focus:border-[#3ee8b5]/50 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3ee8b5] text-[#0c0f14] transition hover:brightness-110 disabled:opacity-40"
                aria-label="Send"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-[#8b92a8]/60">
              Not legal or tax advice · Powered by Together AI
            </p>
          </div>
        </div>
      )}
    </>
  )
}

function ThinkingDots() {
  return (
    <span className="flex gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#3ee8b5]/60"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  )
}
