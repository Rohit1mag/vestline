import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface Slice {
  name: string
  value: number
  color?: string
}

interface Props {
  slices: Slice[]
}

const COLORS = ['#3ee8b5', '#ff6b5b', '#6b8cff', '#e8c547', '#c084fc', '#5eead4']

export function CapTableChart({ slices }: Props) {
  const withColors = slices.map((s, i) => ({
    ...s,
    color: s.color || COLORS[i % COLORS.length],
  }))

  return (
    <div className="h-52 min-h-[13rem] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={208}>
        <PieChart>
          <Pie
            data={withColors}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={72}
            paddingAngle={2}
          >
            {withColors.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="#0c0f14" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#1a1f2e',
              border: '1px solid #2a3142',
              borderRadius: '8px',
            }}
            formatter={(v) => `${Number(v).toFixed(1)}%`}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
