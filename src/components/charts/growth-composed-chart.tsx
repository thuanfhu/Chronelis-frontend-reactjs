import { useTranslation } from 'react-i18next'
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

export interface GrowthPoint { label: string; count: number; cumulative: number }

interface Props {
  data: GrowthPoint[]
  barColor?: string
  lineColor?: string
  height?: number
  emptyMessage?: string
}

const GRAD_CUMULATIVE = 'growthGradCumul'

export function GrowthComposedChart({
  data,
  barColor = '#6366f1',
  lineColor = '#22c55e',
  height = 200,
  emptyMessage,
}: Props) {
  const { t } = useTranslation()
  const resolvedEmpty = emptyMessage ?? t('charts.noData')
  const hasData = data.some((d) => d.count > 0)

  if (!hasData) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <p className="text-sm text-muted-foreground">{resolvedEmpty}</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id={GRAD_CUMULATIVE} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={lineColor} stopOpacity={0.2} />
            <stop offset="95%" stopColor={lineColor} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
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
                <p className="mb-1.5 text-xs font-semibold text-foreground">{d?.label}</p>
                <div className="space-y-0.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2 rounded-sm" style={{ background: barColor }} />
                    <span className="text-muted-foreground">{t('charts.newLabel')}:</span>
                    <span className="font-bold">{d?.count}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full" style={{ background: lineColor }} />
                    <span className="text-muted-foreground">{t('charts.totalLabel')}:</span>
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
          name={t('charts.totalLabel')}
          stroke={lineColor}
          strokeWidth={1.5}
          strokeDasharray="4 2"
          fill={`url(#${GRAD_CUMULATIVE})`}
          dot={false}
          activeDot={false}
          legendType="line"
        />
        <Bar
          yAxisId="count"
          dataKey="count"
          name={t('charts.newLabel')}
          fill={barColor}
          radius={[4, 4, 0, 0]}
          maxBarSize={36}
          fillOpacity={0.85}
        />
        <Line
          yAxisId="cumul"
          type="monotone"
          dataKey="cumulative"
          name="Growth"
          stroke={lineColor}
          strokeWidth={2.5}
          dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
          activeDot={{ r: 4, strokeWidth: 0 }}
          legendType="none"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
