import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ProjectDailyTrendPoint } from '@/lib/api/modules/project-api'

interface Props {
  data: ProjectDailyTrendPoint[]
  height?: number
}

const GRAD_CUMULATIVE = 'projectGradCumulative'

export function ProjectCombinedChart({ data, height = 240 }: Props) {
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
      <div className="flex h-[240px] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('charts.noProjectActivity')}</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={formatted} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={GRAD_CUMULATIVE} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
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
          yAxisId="count"
          orientation="left"
          allowDecimals={false}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="cumul"
          orientation="right"
          allowDecimals={false}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={(props: any) => {
            if (!props.active || !props.payload?.length) return null
            const d = props.payload[0]?.payload
            return (
              <div className="rounded-xl border border-border/60 bg-background px-3 py-2.5 shadow-xl">
                <p className="mb-1.5 text-xs font-semibold text-foreground">{props.label}</p>
                <div className="space-y-0.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2 rounded-sm bg-indigo-500" />
                    <span className="text-muted-foreground">{t('charts.created')}:</span>
                    <span className="font-bold">{d?.created}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">{t('charts.completed')}:</span>
                    <span className="font-bold">{d?.completed}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-indigo-300" />
                    <span className="text-muted-foreground">{t('charts.totalCreated')}:</span>
                    <span className="font-bold">{d?.cumulative}</span>
                  </div>
                </div>
              </div>
            )
          }}
        />
        <Legend
          iconSize={8}
          wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
          formatter={(v) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{v}</span>}
        />
        <Area
          yAxisId="cumul"
          type="monotone"
          dataKey="cumulative"
          name={t('charts.totalCreated')}
          stroke="#6366f1"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          fill={`url(#${GRAD_CUMULATIVE})`}
          dot={false}
          activeDot={false}
          legendType="line"
        />
        <Bar
          yAxisId="count"
          dataKey="created"
          name={t('charts.created')}
          fill="#6366f1"
          radius={[3, 3, 0, 0]}
          maxBarSize={20}
          fillOpacity={0.85}
        />
        <Line
          yAxisId="count"
          type="monotone"
          dataKey="completed"
          name={t('charts.completed')}
          stroke="#22c55e"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
