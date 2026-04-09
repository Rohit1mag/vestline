import { SignInButton, SignUpButton } from '@clerk/react'
import { VestlineLogo } from './VestlineLogo'

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M3 17l4-8 4 4 4-6 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 21h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    title: 'Vesting schedules',
    desc: 'Model cliff + monthly vesting for every grant. See cumulative charts and a month-by-month breakdown at a glance.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 3v9l5 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    title: 'Cap table ownership',
    desc: 'Set your authorized share pool and see each stakeholder\'s ownership percentage update in real time.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 12h8M8 8h5M8 16h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    title: 'ISO, NSO, RSU & Common',
    desc: 'Track all grant types in one place. Add notes per grant to capture negotiation context or legal reminders.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M19 16l.75 2.25L22 19l-2.25.75L19 22l-.75-2.25L16 19l2.25-.75L19 16z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
    title: 'AI equity assistant',
    desc: 'Ask plain-English questions about your cap table — "Who vests next?", "What % will Akhil have by 2030?" — and get instant answers.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    title: 'Team & stakeholders',
    desc: 'Add founders, employees, and advisors. Every grant is linked to a person so you always know who owns what.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    title: 'Milestone tracking',
    desc: 'See every upcoming cliff and final vest date across all grants, sorted chronologically on your dashboard.',
  },
]

export function LandingPage() {
  return (
    <div className="min-h-svh bg-[#0c0f14] text-[#e8eaf0]">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-[#2a3142]/60 bg-[#0c0f14]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <VestlineLogo size={36} />
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
              Vestline
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-lg border border-[#2a3142] px-4 py-2 text-sm font-medium text-[#e8eaf0] transition hover:border-[#3ee8b5]/40 hover:text-[#3ee8b5]"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-lg bg-[#3ee8b5] px-4 py-2 text-sm font-semibold text-[#0c0f14] transition hover:brightness-110"
              >
                Get started
              </button>
            </SignUpButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-24 pt-20 text-center sm:pb-32 sm:pt-28">
        {/* Glow blobs */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-[#3ee8b5]/[0.06] blur-3xl" />
        <div className="pointer-events-none absolute left-1/4 top-32 h-64 w-64 rounded-full bg-[#3ee8b5]/[0.04] blur-2xl" />

        <div className="relative mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#3ee8b5]/25 bg-[#3ee8b5]/[0.07] px-4 py-1.5 text-xs font-medium text-[#3ee8b5]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3ee8b5]" />
            Equity planning for early-stage teams
          </span>

          <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl font-semibold leading-tight tracking-tight text-[#e8eaf0] sm:text-5xl lg:text-6xl">
            Model your cap table.
            <br />
            <span className="text-[#3ee8b5]">Understand your equity.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#8b92a8] sm:text-lg">
            Vestline helps founders and early employees model grants, vesting schedules, and ownership — without a spreadsheet. Ask questions about your cap table in plain English.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-xl bg-[#3ee8b5] px-6 py-3 text-sm font-semibold text-[#0c0f14] shadow-lg shadow-[#3ee8b5]/20 transition hover:brightness-110"
              >
                Start for free →
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-xl border border-[#2a3142] bg-[#1a1f2e] px-6 py-3 text-sm font-medium text-[#e8eaf0] transition hover:border-[#3ee8b5]/40"
              >
                Sign in
              </button>
            </SignInButton>
          </div>

          <p className="mt-4 text-xs text-[#8b92a8]/60">
            No credit card required · Data synced to your account
          </p>
        </div>

        {/* Mock dashboard preview */}
        <div className="relative mx-auto mt-16 max-w-3xl">
          <div className="overflow-hidden rounded-2xl border border-[#2a3142] bg-[#111520] shadow-2xl shadow-black/60">
            {/* Fake browser bar */}
            <div className="flex items-center gap-2 border-b border-[#2a3142] bg-[#1a1f2e] px-4 py-3">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#ff6b5b]/60" />
                <span className="h-3 w-3 rounded-full bg-[#f9c74f]/60" />
                <span className="h-3 w-3 rounded-full bg-[#3ee8b5]/60" />
              </div>
              <span className="ml-3 rounded-md bg-[#0c0f14] px-3 py-1 text-xs text-[#8b92a8]">
                vestline.app/dashboard
              </span>
            </div>
            {/* Mock stats */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Total granted', value: '2.4M', accent: false },
                  { label: 'Vested', value: '980k', accent: true },
                  { label: 'Unvested', value: '1.42M', accent: false },
                  { label: 'Auth. pool', value: '10M', accent: false },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-xl border p-4 ${
                      s.accent
                        ? 'border-[#3ee8b5]/25 bg-[#3ee8b5]/[0.06]'
                        : 'border-[#2a3142] bg-[#1a1f2e]'
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wider text-[#8b92a8]">{s.label}</p>
                    <p className={`mt-1.5 font-[family-name:var(--font-display)] text-xl font-semibold ${s.accent ? 'text-[#3ee8b5]' : ''}`}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
              {/* Mock bar */}
              <div className="mt-5 space-y-3">
                {[
                  { name: 'Alice (Founder)', pct: 72 },
                  { name: 'Bob (Engineer)', pct: 38 },
                  { name: 'Carol (Advisor)', pct: 15 },
                ].map((r) => (
                  <div key={r.name} className="flex items-center gap-3 text-sm">
                    <span className="w-36 shrink-0 text-xs text-[#8b92a8]">{r.name}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-[#2a3142]">
                      <div
                        className="h-2 rounded-full bg-[#3ee8b5]"
                        style={{ width: `${r.pct}%`, opacity: 0.7 + r.pct / 300 }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums text-[#3ee8b5]">{r.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Glow under mock */}
          <div className="pointer-events-none absolute -bottom-8 left-1/2 h-24 w-3/4 -translate-x-1/2 rounded-full bg-[#3ee8b5]/10 blur-2xl" />
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
              Everything you need for equity clarity
            </h2>
            <p className="mt-3 text-sm text-[#8b92a8] sm:text-base">
              Built for founders who want to understand their cap table without hiring a lawyer.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-[#2a3142] bg-[#1a1f2e] p-6 transition hover:border-[#3ee8b5]/30 hover:bg-[#1e2436]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3ee8b5]/10 text-[#3ee8b5] transition group-hover:bg-[#3ee8b5]/15">
                  {f.icon}
                </div>
                <h3 className="mt-4 font-[family-name:var(--font-display)] font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#8b92a8]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-[#3ee8b5]/20 bg-[#3ee8b5]/[0.05] p-10 text-center shadow-xl shadow-[#3ee8b5]/5">
          <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-[#3ee8b5]/10 blur-3xl" />
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
            Get your equity in order today
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-[#8b92a8] sm:text-base">
            Free to use. No spreadsheets. No lawyers needed for the basics.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-xl bg-[#3ee8b5] px-7 py-3 text-sm font-semibold text-[#0c0f14] shadow-lg shadow-[#3ee8b5]/20 transition hover:brightness-110"
              >
                Create free account →
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-xl border border-[#3ee8b5]/30 px-7 py-3 text-sm font-medium text-[#e8eaf0] transition hover:border-[#3ee8b5]/60"
              >
                Already have an account
              </button>
            </SignInButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2a3142] px-6 py-8 text-center text-xs text-[#8b92a8]/60">
        <p>© {new Date().getFullYear()} Vestline · Not legal or financial advice.</p>
      </footer>
    </div>
  )
}
