import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ComposedChart,
  Bar,
  Cell,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { PriorityEstimatePoint } from '@/lib/api/modules/task-api'

interface Props {
  data: PriorityEstimatePoint[]
  height?: number
}

const PRIORITY_ORDER = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']
const PRIORITY_COLOR: Record<string, string> = {
  URGENT: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
}

export function PriorityComposedChart({ data, height = 220 }: Props) {
  const { t } = useTranslation()
  const chartData = useMemo(
    () =>
      PRIORITY_ORDER.map((p) => {
        const found = data.find((d) => d.priority === p)
        return {
          priority: p.charAt(0) + p.slice(1).toLowerCase(),
          hours: found ? Math.round(found.totalMinutes / 60) : 0,
          tasks: found ? found.taskCount : 0,
          fill: PRIORITY_COLOR[p] ?? '#94a3b8',
        }
      }).filter((d) => d.hours > 0 || d.tasks > 0),
    [data],
  )

  if (chartData.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('charts.noOpenTasks')}</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 6, right: 24, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="priority"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="hours"
          orientation="left"
          allowDecimals={false}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          label={{ value: 'hrs', position: 'insideTopLeft', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          yAxisId="tasks"
          orientation="right"
          allowDecimals={false}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          label={{ value: 'tasks', position: 'insideTopRight', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={(props: any) => {
            if (!props.active || !props.payload?.length) return null
            const d = props.payload[0]?.payload
            return (
              <div className="rounded-xl border border-border/60 bg-background px-3 py-2.5 shadow-xl">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="inline-block size-2.5 rounded-full" style={{ background: d?.fill }} />
                  <p className="text-xs font-semibold text-foreground">{d?.priority}</p>
                </div>
                <div className="space-y-0.5 text-xs">
                  <div className="flex justify-between gap-6">
                    <span className="text-muted-foreground">{t('charts.estimatedHours')}</span>
                    <span className="font-bold">{d?.hours}h</span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span className="text-muted-foreground">{t('charts.openTasks')}</span>
                    <span className="font-bold">{d?.tasks}</span>
                  </div>
                </div>
              </div>
            )
          }}
        />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
          formatter={(v) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{v}</span>}
        />
        <Bar
          yAxisId="hours"
          dataKey="hours"
          name={t('charts.estHours')}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
          fill="#6366f1"
        >
          {chartData.map((entry) => (
            <Cell key={entry.priority} fill={entry.fill} />
          ))}
        </Bar>
        <Line
          yAxisId="tasks"
          type="monotone"
          dataKey="tasks"
          name={t('charts.openTasks')}
          stroke="#a855f7"
          strokeWidth={2.5}
          dot={{ r: 4, fill: '#a855f7', strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
