import { Badge } from '@/components/ui/badge'
import type { TaskPriorityType } from '@/types/domain'

const config: Record<TaskPriorityType, { variant: 'destructive' | 'default' | 'secondary' | 'outline'; dot: string; label: string }> = {
  URGENT: { variant: 'destructive', dot: 'bg-red-500', label: 'Urgent' },
  HIGH: { variant: 'default', dot: 'bg-orange-500', label: 'High' },
  MEDIUM: { variant: 'secondary', dot: 'bg-yellow-500', label: 'Medium' },
  LOW: { variant: 'outline', dot: 'bg-green-500', label: 'Low' },
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriorityType }) {
  const { variant, dot, label } = config[priority]
  return (
    <Badge variant={variant} className="gap-1 text-[10px]">
      <span className={`inline-block size-1.5 rounded-full ${dot}`} />
      {label}
    </Badge>
  )
}
