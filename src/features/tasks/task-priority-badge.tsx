import { Badge } from '@/components/ui/badge'
import type { TaskPriorityType } from '@/types/domain'

const config: Record<TaskPriorityType, { variant: 'destructive' | 'default' | 'secondary' | 'outline'; dot: string; label: string; className?: string }> = {
  URGENT: { variant: 'destructive', dot: 'bg-red-500', label: 'Urgent' },
  HIGH: { variant: 'default', dot: 'bg-orange-500', label: 'High' },
  MEDIUM: { variant: 'secondary', dot: 'bg-yellow-500', label: 'Medium' },
  LOW: {
    variant: 'outline',
    dot: 'bg-emerald-700 dark:bg-emerald-300',
    label: 'Low',
    className: 'border-emerald-700/55 bg-emerald-600/24 text-emerald-950 dark:border-emerald-300/65 dark:bg-emerald-500/36 dark:text-emerald-50',
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
