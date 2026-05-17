import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { ProjectStatusType } from '@/types/domain'

const STATUS_CONFIG: Record<ProjectStatusType, { label: string; color: string }> = {
  ACTIVE:    { label: 'Active',    color: '#6366f1' },
  COMPLETED: { label: 'Completed', color: '#22c55e' },
  ARCHIVED:  { label: 'Archived',  color: '#94a3b8' },
}

const STATUS_ORDER: ProjectStatusType[] = ['ACTIVE', 'COMPLETED', 'ARCHIVED']

interface Props {
  projects: Array<{ status: ProjectStatusType }>
  title?: string
}

type SegEntry = { label: string; value: number; color: string; status: ProjectStatusType }
interface TipProps { active?: boolean; payload?: Array<{ name: string; value: number; payload: SegEntry }> }

function CustomTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  const entry = payload[0].payload
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="inline-block size-2.5 rounded-full" style={{ background: entry.color }} />
        <span className="text-sm font-semibold">{name}</span>
        <span className="ml-2 text-sm text-muted-foreground">{value} projects</span>
      </div>
    </div>
  )
}

function CenterLabel({ total }: { total: number }) {
  return (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
      <tspan x="50%" dy="-0.4em" fontSize="22" fontWeight="700" fill="currentColor">{total}</tspan>
      <tspan x="50%" dy="1.4em" fontSize="11" fill="#94a3b8">projects</tspan>
    </text>
  )
}

export function ProjectStatusDonut({ projects, title }: Props) {
  const counts: Record<ProjectStatusType, number> = { ACTIVE: 0, COMPLETED: 0, ARCHIVED: 0 }
  for (const p of projects) counts[p.status]++

  const data: SegEntry[] = STATUS_ORDER
    .filter((s) => counts[s] > 0)
    .map((s) => ({ status: s, label: STATUS_CONFIG[s].label, value: counts[s], color: STATUS_CONFIG[s].color }))

  if (projects.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <p className="text-sm text-muted-foreground">No projects yet</p>
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
            nameKey="label"
            animationBegin={0}
            animationDuration={600}
          >
            {data.map((entry) => (
              <Cell key={entry.status} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <CenterLabel total={projects.length} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
