import { Badge } from '@/components/ui/badge'
import type { TaskPriorityType } from '@/types/domain'

const config: Record<TaskPriorityType, { variant: 'destructive' | 'default' | 'secondary' | 'outline'; dot: string; label: string; className?: string }> = {
  URGENT: {
    variant: 'outline',
    dot: 'bg-rose-700 dark:bg-rose-300',
    label: 'Urgent',
    className: 'border-rose-700/60 bg-rose-600/30 text-rose-950 dark:border-rose-300/70 dark:bg-rose-500/42 dark:text-rose-50',
  },
  HIGH: {
    variant: 'outline',
    dot: 'bg-orange-700 dark:bg-orange-300',
    label: 'High',
    className: 'border-orange-700/60 bg-orange-600/30 text-orange-950 dark:border-orange-300/70 dark:bg-orange-500/40 dark:text-orange-50',
  },
  MEDIUM: {
    variant: 'outline',
    dot: 'bg-indigo-700 dark:bg-indigo-300',
    label: 'Medium',
    className: 'border-indigo-700/60 bg-indigo-600/30 text-indigo-950 dark:border-indigo-300/70 dark:bg-indigo-500/40 dark:text-indigo-50',
  },
  LOW: {
    variant: 'outline',
    dot: 'bg-emerald-800 dark:bg-emerald-200',
    label: 'Low',
    className: 'border-emerald-800/60 bg-emerald-700/30 text-emerald-950 dark:border-emerald-200/70 dark:bg-emerald-500/44 dark:text-emerald-50',
  },
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriorityType }) {
  const { variant, dot, label, className } = config[priority]
  return (
    <Badge variant={variant} className={`gap-1 text-[10px] ${className ?? ''}`}>
      <span className={`inline-block size-1.5 rounded-full ${dot}`} />
      {label}
    </Badge>
  )
}
