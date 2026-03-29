import {
  addMonths,
  differenceInCalendarMonths,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns'
import type { EquityGrant, VestingMonthRow } from './types'

/** Vested fraction at end of `elapsedFullMonths` (0 = grant month, not yet 1 full month). */
export function vestedFraction(
  elapsedFullMonths: number,
  cliffMonths: number,
  vestingMonths: number
): number {
  if (vestingMonths <= 0) return 0
  if (elapsedFullMonths < cliffMonths) return 0
  return Math.min(1, elapsedFullMonths / vestingMonths)
}

export function vestedSharesAt(
  grant: EquityGrant,
  asOf: Date
): number {
  const start = startOfMonth(parseISO(grant.startDate))
  const ref = startOfMonth(asOf)
  if (ref < start) return 0
  const elapsed = differenceInCalendarMonths(ref, start)
  return Math.round(
    vestedFraction(elapsed, grant.cliffMonths, grant.vestingMonths) * grant.shares
  )
}

export function buildVestingSchedule(grant: EquityGrant): VestingMonthRow[] {
  const start = startOfMonth(parseISO(grant.startDate))
  const rows: VestingMonthRow[] = []
  let prevCumulative = 0

  for (let m = 0; m <= grant.vestingMonths; m++) {
    const monthDate = addMonths(start, m)
    const frac = vestedFraction(m, grant.cliffMonths, grant.vestingMonths)
    const cumulative = Math.round(frac * grant.shares)
    const thisMonth = cumulative - prevCumulative
    prevCumulative = cumulative

    rows.push({
      monthIndex: m,
      dateLabel: format(monthDate, 'MMM yyyy'),
      cumulativeVested: cumulative,
      vestedThisMonth: thisMonth,
      percentVested: grant.shares > 0 ? (cumulative / grant.shares) * 100 : 0,
    })
  }

  return rows
}

export function grantTypeLabel(t: EquityGrant['grantType']): string {
  const map: Record<EquityGrant['grantType'], string> = {
    iso: 'ISO',
    nso: 'NSO',
    rsu: 'RSU',
    common: 'Common',
  }
  return map[t]
}
