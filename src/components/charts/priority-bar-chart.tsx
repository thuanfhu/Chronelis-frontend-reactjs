import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useTranslation } from 'react-i18next'
import type { TaskPriorityType } from '@/types/domain'

const PRIORITY_ORDER: TaskPriorityType[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']

interface Props {
  tasks: Array<{ priority: TaskPriorityType }>
  title?: string
}

type ChartEntry = { priority: TaskPriorityType; fullLabel: string; label: string; value: number; color: string }

interface TipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: ChartEntry }>
}

function CustomTooltip({ active, payload }: TipProps) {
  const { t } = useTranslation()
  if (!active || !payload?.length) return null
  const { value } = payload[0]
  const entry = payload[0].payload
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="inline-block size-2.5 rounded-full" style={{ background: entry.color }} />
        <span className="text-sm font-semibold">{entry.fullLabel}</span>
        <span className="ml-2 text-sm text-muted-foreground">
          {value} {t('dashboard.tasks')}
        </span>
      </div>
    </div>
  )
}

export function PriorityBarChart({ tasks, title }: Props) {
  const { t } = useTranslation()

  const PRIORITY_CONFIG: Record<TaskPriorityType, { label: string; color: string; bg: string }> = {
    URGENT: { label: t('task.priorityUrgent'), color: '#f43f5e', bg: '#fef2f2' },
    HIGH: { label: t('task.priorityHigh'), color: '#f59e0b', bg: '#fffbeb' },
    MEDIUM: { label: t('task.priorityMedium'), color: '#3b82f6', bg: '#eff6ff' },
    LOW: { label: t('task.priorityLow'), color: '#10b981', bg: '#f0fdf4' },
  }

  const counts = PRIORITY_ORDER.reduce<Record<TaskPriorityType, number>>(
    (acc, p) => ({ ...acc, [p]: 0 }),
    {} as Record<TaskPriorityType, number>,
  )
  for (const task of tasks) {
    if (task.priority in counts) counts[task.priority]++
  }

  const data = PRIORITY_ORDER.map((p) => ({
    priority: p,
    fullLabel: PRIORITY_CONFIG[p].label,
    label: PRIORITY_CONFIG[p].label.slice(0, 1),
    value: counts[p],
    color: PRIORITY_CONFIG[p].color,
  }))

  const maxVal = Math.max(...data.map((d) => d.value), 1)

  if (tasks.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('dashboard.noTasksToDisplay')}</p>
      </div>
    )
  }

  return (
    <div>
      {title && <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
          <XAxis
            type="number"
            domain={[0, maxVal]}
            tickCount={maxVal + 1}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="fullLabel"
            width={65}
            tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22} animationBegin={0} animationDuration={600}>
            {data.map((entry) => (
              <Cell key={entry.priority} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
