import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { buildVestingSchedule } from '../vesting'
import type { EquityGrant } from '../types'

interface Props {
  grant: EquityGrant
}

export function VestingChart({ grant }: Props) {
  const schedule = buildVestingSchedule(grant)
  const data = schedule
    .filter((_, i) => i % Math.max(1, Math.ceil(schedule.length / 24)) === 0 || i === schedule.length - 1)
    .map((r) => ({
      label: r.dateLabel,
      vested: r.cumulativeVested,
      pct: Math.round(r.percentVested * 10) / 10,
    }))

  return (
    <div className="h-64 min-h-[16rem] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={256}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="vestGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3ee8b5" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#3ee8b5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#8b92a8', fontSize: 11 }}
            axisLine={{ stroke: '#2a3142' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#8b92a8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : `${v}`)}
          />
          <Tooltip
            contentStyle={{
              background: '#1a1f2e',
              border: '1px solid #2a3142',
              borderRadius: '8px',
              fontSize: '13px',
            }}
            labelStyle={{ color: '#e8eaf0' }}
            formatter={(value, name) =>
              name === 'vested'
                ? [Number(value).toLocaleString(), 'Vested shares']
                : [value, name]
            }
          />
          <Area
            type="monotone"
            dataKey="vested"
            stroke="#3ee8b5"
            strokeWidth={2}
            fill="url(#vestGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
