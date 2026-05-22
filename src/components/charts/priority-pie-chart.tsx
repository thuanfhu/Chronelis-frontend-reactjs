import { useTranslation } from 'react-i18next'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Task } from '@/types/domain'

interface Props {
  tasks: Task[]
  height?: number
}

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
  NONE: '#94a3b8',
}

export function PriorityPieChart({ tasks, height = 200 }: Props) {
  const { t } = useTranslation()
  const counts: Record<string, number> = {}
  for (const task of tasks) {
    const p = task.priority ?? 'NONE'
    counts[p] = (counts[p] ?? 0) + 1
  }

  const data = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k.charAt(0) + k.slice(1).toLowerCase(), value: v, key: k }))

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('charts.noTasks')}</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="52%"
          outerRadius="75%"
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((entry) => (
            <Cell key={entry.key} fill={PRIORITY_COLOR[entry.key] ?? '#94a3b8'} />
          ))}
        </Pie>
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={(props: any) => {
            if (!props.active || !props.payload?.length) return null
            const entry = props.payload[0]
            return (
              <div className="rounded-xl border border-border/60 bg-background px-3 py-2 shadow-xl">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ background: PRIORITY_COLOR[entry.payload?.key] ?? '#94a3b8' }}
                  />
                  <span className="font-semibold text-foreground">{entry.name}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-bold text-foreground">{entry.value}</span>
                </div>
              </div>
            )
          }}
        />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: '11px' }}
          formatter={(v) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
