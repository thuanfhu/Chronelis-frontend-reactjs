import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import type { DailyTrendPoint } from '@/lib/api/modules/task-api'
import type { ProjectDailyTrendPoint } from '@/lib/api/modules/project-api'

interface Props {
  data: DailyTrendPoint[] | ProjectDailyTrendPoint[]
  mode?: 'cumulative' | 'rate'
  height?: number
}

export function CompletionLineChart({ data, mode = 'cumulative', height = 200 }: Props) {
  const { t } = useTranslation()
  const chartData = useMemo(() => {
    let running = 0
    return data.map((d) => {
      running += (d as DailyTrendPoint).completed ?? 0
      const totalCreated = 'cumulative' in d ? (d as ProjectDailyTrendPoint).cumulative : running
      const rate = totalCreated > 0 ? Math.round(((d as DailyTrendPoint).completed / totalCreated) * 100) : 0
      return {
        label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: mode === 'rate' ? rate : running,
        completed: (d as DailyTrendPoint).completed,
      }
    })
  }, [data, mode])

  const avg = chartData.length > 0
    ? Math.round(chartData.reduce((s, d) => s + d.value, 0) / chartData.length)
    : 0

  const hasData = chartData.some((d) => d.value > 0)

  if (!hasData) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('charts.noCompletion')}</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={mode === 'rate' ? (v) => `${v}%` : undefined}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={(props: any) => {
            if (!props.active || !props.payload?.length) return null
            const entry = props.payload[0]
            return (
              <div className="rounded-xl border border-border/60 bg-background px-3 py-2.5 shadow-xl">
                <p className="mb-1 text-xs font-semibold text-foreground">{props.label}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-block size-2 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">
                    {mode === 'rate' ? t('charts.completionRate') : t('charts.cumulativeCompleted')}:
                  </span>
                  <span className="font-bold text-foreground">
                    {mode === 'rate' ? `${entry.value}%` : entry.value}
                  </span>
                </div>
              </div>
            )
          }}
        />
        <ReferenceLine
          y={avg}
          stroke="#a855f7"
          strokeDasharray="4 4"
          strokeOpacity={0.6}
          label={{ value: mode === 'rate' ? `avg ${avg}%` : `avg ${avg}`, position: 'insideTopRight', fontSize: 9, fill: '#a855f7' }}
        />
        <Line
          type="monotone"
          dataKey="value"
          name={mode === 'rate' ? t('charts.rate') : t('charts.cumulative')}
          stroke="#22c55e"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
