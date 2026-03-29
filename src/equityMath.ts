/** Percent of company's authorized share pool (simplified FD-style denominator). */

export function sharesToPercentOfAuthorized(shares: number, authorized: number): number {
  if (!Number.isFinite(shares) || !Number.isFinite(authorized) || authorized <= 0) return 0
  return (shares / authorized) * 100
}

/** Rounds to whole shares; at least 1 when percent > 0. */
export function percentOfAuthorizedToShares(percent: number, authorized: number): number {
  if (!Number.isFinite(percent) || !Number.isFinite(authorized) || authorized <= 0 || percent <= 0) {
    return 0
  }
  const raw = (percent / 100) * authorized
  const rounded = Math.round(raw)
  return Math.max(1, rounded)
}

/** Trim trailing zeros for display (e.g. 0.5, 0.125). */
export function formatOwnershipPercent(shares: number, authorized: number): string {
  const p = sharesToPercentOfAuthorized(shares, authorized)
  if (!Number.isFinite(p) || p <= 0) return '0'
  if (p >= 10) return p.toFixed(2).replace(/\.?0+$/, '')
  if (p >= 1) return p.toFixed(3).replace(/\.?0+$/, '')
  return p.toFixed(4).replace(/\.?0+$/, '')
}

export function parsePercentInput(raw: string): number | null {
  const t = raw.trim().replace(/,/g, '')
  if (t === '') return null
  const n = parseFloat(t)
  if (!Number.isFinite(n)) return null
  return n
}
