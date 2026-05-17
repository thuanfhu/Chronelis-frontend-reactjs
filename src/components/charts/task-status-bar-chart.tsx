import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { TaskStatus, Task } from '@/types/domain'

const BAR_COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899']

interface Props {
  statuses: TaskStatus[]
  tasks: Task[]
  title?: string
}

type BarEntry = { name: string; value: number; color: string; pct: number }
interface TipProps { active?: boolean; payload?: Array<{ value: number; payload: BarEntry }> }

function CustomTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const { value } = payload[0]
  const entry = payload[0].payload
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{entry.name}</p>
      <div className="flex items-center gap-2">
        <span className="inline-block size-2.5 rounded-full" style={{ background: entry.color }} />
        <span className="text-sm font-bold">{value} tasks</span>
        <span className="text-xs text-muted-foreground">({entry.pct}%)</span>
      </div>
    </div>
  )
}

export function TaskStatusBarChart({ statuses, tasks, title }: Props) {
  const sorted = [...statuses].sort((a, b) => a.position - b.position)

  const data: BarEntry[] = sorted.map((s, i) => {
    const count = tasks.filter((t) => t.status.id === s.id).length
    const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0
    return {
      name: s.name,
      value: count,
      color: BAR_COLORS[i % BAR_COLORS.length],
      pct,
    }
  })

  const maxVal = Math.max(...data.map((d) => d.value), 1)

  if (statuses.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <p className="text-sm text-muted-foreground">No statuses configured</p>
      </div>
    )
  }

  return (
    <div>
      {title && <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            interval={0}
            tickFormatter={(v: string) => (v.length > 8 ? `${v.slice(0, 8)}…` : v)}
          />
          <YAxis
            domain={[0, maxVal]}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40} animationBegin={0} animationDuration={600}>
            {data.map((entry, i) => (
              <Cell key={`${entry.name}-${i}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
