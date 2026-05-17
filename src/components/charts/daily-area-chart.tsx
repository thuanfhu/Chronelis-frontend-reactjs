import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { DailyTrendPoint } from '@/lib/api/modules/task-api'

interface Props {
  data: DailyTrendPoint[]
  height?: number
  showLegend?: boolean
}

const GRAD_CREATED = 'areaGradCreated'
const GRAD_COMPLETED = 'areaGradCompleted'

export function DailyAreaChart({ data, height = 220, showLegend = true }: Props) {
  const { t } = useTranslation()
  const formatted = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      })),
    [data],
  )

  const hasData = data.some((d) => d.created > 0 || d.completed > 0)

  if (!hasData) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('charts.noActivity')}</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id={GRAD_CREATED} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={GRAD_COMPLETED} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={(props: any) => {
            if (!props.active || !props.payload?.length) return null
            return (
              <div className="rounded-xl border border-border/60 bg-background px-3 py-2.5 shadow-xl">
                <p className="mb-1.5 text-xs font-semibold text-foreground">{props.label}</p>
                {props.payload.map((entry: any) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <span className="inline-block size-2 rounded-full" style={{ background: entry.color }} />
                    <span className="text-muted-foreground">{entry.name}:</span>
                    <span className="font-bold text-foreground">{entry.value}</span>
                  </div>
                ))}
              </div>
            )
          }}
        />
        {showLegend && (
          <Legend
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
            formatter={(v) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{v}</span>}
          />
        )}
        <Area
          type="monotone"
          dataKey="created"
          name={t('charts.created')}
          stroke="#6366f1"
          strokeWidth={2}
          fill={`url(#${GRAD_CREATED})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="completed"
          name={t('charts.completed')}
          stroke="#22c55e"
          strokeWidth={2}
          fill={`url(#${GRAD_COMPLETED})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
