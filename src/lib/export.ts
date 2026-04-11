import { format } from 'date-fns'
import type { AppData } from '../types'
import { grantTypeLabel, vestedSharesAt } from '../vesting'

function escapeCsv(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportGrantsCSV(data: AppData, today: Date): void {
  const byId = new Map(data.stakeholders.map((s) => [s.id, s]))
  const auth = data.company.totalAuthorizedShares

  const headers = [
    'Grant Label',
    'Person',
    'Role',
    'Email',
    'Grant Type',
    'Shares',
    '% of Authorized',
    'Start Date',
    'Cliff (months)',
    'Vesting (months)',
    'Cliff Date',
    'Fully Vested Date',
    'Vested Now',
    'Unvested Now',
    'Notes',
  ]

  const rows = data.grants.map((g) => {
    const person = byId.get(g.stakeholderId)
    const vested = vestedSharesAt(g, today)
    const cliffDate = new Date(g.startDate)
    cliffDate.setMonth(cliffDate.getMonth() + g.cliffMonths)
    const endDate = new Date(g.startDate)
    endDate.setMonth(endDate.getMonth() + g.vestingMonths)
    const pctAuth = auth && auth > 0 ? ((g.shares / auth) * 100).toFixed(4) : ''

    return [
      g.label,
      person?.name ?? '',
      person?.role ?? '',
      person?.email ?? '',
      grantTypeLabel(g.grantType),
      g.shares,
      pctAuth,
      g.startDate,
      g.cliffMonths,
      g.vestingMonths,
      format(cliffDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd'),
      vested,
      g.shares - vested,
      g.notes ?? '',
    ]
  })

  const csvLines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ]
  const csv = csvLines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${data.company.name.replace(/[^a-zA-Z0-9]/g, '_')}_grants_${format(today, 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportCapTablePDF(
  data: AppData,
  today: Date,
  capSlices: { name: string; value: number }[],
  totals: { granted: number; vested: number; unvested: number; base: number },
): void {
  const byId = new Map(data.stakeholders.map((s) => [s.id, s]))
  const auth = data.company.totalAuthorizedShares
  const vestPct = totals.granted > 0 ? ((totals.vested / totals.granted) * 100).toFixed(1) : '0.0'

  const grantsRows = data.grants
    .map((g) => {
      const person = byId.get(g.stakeholderId)
      const vested = vestedSharesAt(g, today)
      const cliffDate = new Date(g.startDate)
      cliffDate.setMonth(cliffDate.getMonth() + g.cliffMonths)
      const endDate = new Date(g.startDate)
      endDate.setMonth(endDate.getMonth() + g.vestingMonths)
      const pctAuth = auth && auth > 0 ? `${((g.shares / auth) * 100).toFixed(2)}%` : '—'

      return `
      <tr>
        <td>${g.label}</td>
        <td>${person?.name ?? '—'}</td>
        <td>${grantTypeLabel(g.grantType)}</td>
        <td class="num">${g.shares.toLocaleString()}</td>
        <td class="num">${pctAuth}</td>
        <td>${format(new Date(g.startDate), 'MMM d, yyyy')}</td>
        <td>${g.cliffMonths}mo · ${format(cliffDate, 'MMM yyyy')}</td>
        <td>${format(endDate, 'MMM yyyy')}</td>
        <td class="num">${vested.toLocaleString()}</td>
        <td class="num">${(g.shares - vested).toLocaleString()}</td>
      </tr>`
    })
    .join('')

  const ownershipRows = capSlices
    .map(
      (s) => `
    <tr>
      <td>${s.name}</td>
      <td class="num">${s.value.toFixed(2)}%</td>
    </tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8" />
  <title>${data.company.name} — Cap Table</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 11px;
      color: #111;
      padding: 32px 40px;
      line-height: 1.5;
    }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .subtitle { font-size: 12px; color: #555; margin-bottom: 28px; }
    h2 {
      font-size: 13px;
      font-weight: 600;
      margin: 28px 0 10px;
      border-bottom: 1.5px solid #ddd;
      padding-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #333;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 8px;
    }
    .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
    .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #666; font-weight: 600; }
    .stat-value { font-size: 20px; font-weight: 700; margin-top: 5px; letter-spacing: -0.01em; }
    .stat-hint { font-size: 9px; color: #888; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th {
      text-align: left;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #555;
      font-weight: 600;
      border-bottom: 2px solid #e0e0e0;
      padding: 7px 8px;
      background: #fafafa;
    }
    td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .empty { color: #aaa; padding: 12px 8px; }
    .footer {
      margin-top: 40px;
      font-size: 9px;
      color: #aaa;
      border-top: 1px solid #eee;
      padding-top: 12px;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 0.7in 0.75in; size: letter landscape; }
    }
  </style>
</head>
<body>
  <h1>${data.company.name}</h1>
  <div class="subtitle">Cap Table &amp; Equity Summary &nbsp;·&nbsp; As of ${format(today, 'MMMM d, yyyy')}</div>

  <div class="stats">
    <div class="stat">
      <div class="stat-label">Total Granted</div>
      <div class="stat-value">${totals.granted.toLocaleString()}</div>
      <div class="stat-hint">Across all grants</div>
    </div>
    <div class="stat">
      <div class="stat-label">Vested</div>
      <div class="stat-value">${totals.vested.toLocaleString()}</div>
      <div class="stat-hint">${vestPct}% of granted</div>
    </div>
    <div class="stat">
      <div class="stat-label">Unvested</div>
      <div class="stat-value">${totals.unvested.toLocaleString()}</div>
      <div class="stat-hint">On schedule</div>
    </div>
    <div class="stat">
      <div class="stat-label">Authorized Pool</div>
      <div class="stat-value">${auth ? auth.toLocaleString() : '—'}</div>
      <div class="stat-hint">${auth ? 'Fully diluted base' : 'Not set'}</div>
    </div>
  </div>

  <h2>Ownership</h2>
  <table>
    <thead>
      <tr>
        <th>Stakeholder</th>
        <th class="num">Ownership %</th>
      </tr>
    </thead>
    <tbody>
      ${ownershipRows || '<tr><td colspan="2" class="empty">No grants to display.</td></tr>'}
    </tbody>
  </table>

  <h2>All Grants</h2>
  <table>
    <thead>
      <tr>
        <th>Grant</th>
        <th>Person</th>
        <th>Type</th>
        <th class="num">Shares</th>
        <th class="num">% Auth.</th>
        <th>Start Date</th>
        <th>Cliff</th>
        <th>Fully Vested</th>
        <th class="num">Vested</th>
        <th class="num">Unvested</th>
      </tr>
    </thead>
    <tbody>
      ${grantsRows || '<tr><td colspan="10" class="empty">No grants to display.</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    Generated by Vestline &nbsp;·&nbsp; ${format(today, 'MMMM d, yyyy')} &nbsp;·&nbsp;
    This is a planning and modeling tool only. It does not constitute legal, tax, or investment advice.
    Real grants and cap tables should be reviewed with qualified counsel.
  </div>

  <script>window.onload = function () { window.print(); }</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site and try again.')
    return
  }
  win.document.write(html)
  win.document.close()
}
