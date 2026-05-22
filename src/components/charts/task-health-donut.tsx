import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useTranslation } from 'react-i18next'

const SEGMENTS = [
  { key: 'blocked', color: '#f43f5e' },
  { key: 'overdue', color: '#f97316' },
  { key: 'dueToday', color: '#eab308' },
  { key: 'onTrack', color: '#10b981' },
] as const

interface Props {
  assignedCount: number
  blockedCount: number
  overdueCount: number
  dueTodayCount: number
  title?: string
}

type SegmentEntry = { key: string; color: string; value: number }
interface TipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: SegmentEntry }>
}

function CustomTooltip({ active, payload }: TipProps) {
  const { t } = useTranslation()
  if (!active || !payload?.length) return null
  const { value } = payload[0]
  const entry = payload[0].payload
  const label = t(`dashboard.segments.${entry.key}`)
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="inline-block size-2.5 rounded-full" style={{ background: entry.color }} />
        <span className="text-sm font-semibold">{label}</span>
        <span className="ml-2 text-sm text-muted-foreground">
          {value} {t('dashboard.tasks')}
        </span>
      </div>
    </div>
  )
}

function CenterLabel({ total }: { total: number }) {
  const { t } = useTranslation()
  return (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
      <tspan x="50%" dy="-0.4em" fontSize="22" fontWeight="700" fill="currentColor">
        {total}
      </tspan>
      <tspan x="50%" dy="1.4em" fontSize="11" fill="#94a3b8">
        {t('dashboard.tasks')}
      </tspan>
    </text>
  )
}

export function TaskHealthDonut({ assignedCount, blockedCount, overdueCount, dueTodayCount, title }: Props) {
  const { t } = useTranslation()
  const onTrack = Math.max(0, assignedCount - blockedCount - overdueCount - dueTodayCount)
  const raw = [
    { ...SEGMENTS[0], value: blockedCount },
    { ...SEGMENTS[1], value: overdueCount },
    { ...SEGMENTS[2], value: dueTodayCount },
    { ...SEGMENTS[3], value: onTrack },
  ]
  const data = raw.filter((d) => d.value > 0)

  if (assignedCount === 0) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-2">
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
          <span className="text-xl">✓</span>
        </div>
        <p className="text-sm text-muted-foreground">{t('dashboard.noAssignedTasks')}</p>
      </div>
    )
  }

  return (
    <div>
      {title && <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>}
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={56}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            nameKey="key"
            animationBegin={0}
            animationDuration={600}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <CenterLabel total={assignedCount} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs text-muted-foreground">{t(`dashboard.segments.${value}`)}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
