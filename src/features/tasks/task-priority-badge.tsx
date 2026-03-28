import { Badge } from '@/components/ui/badge'
import type { TaskPriorityType } from '@/types/domain'

export function TaskPriorityBadge({ priority }: { priority: TaskPriorityType }) {
  if (priority === 'URGENT') {
    return <Badge variant="destructive">URGENT</Badge>
  }

  if (priority === 'HIGH') {
    return <Badge variant="default">HIGH</Badge>
  }

  if (priority === 'MEDIUM') {
    return <Badge variant="secondary">MEDIUM</Badge>
  }

  return <Badge variant="outline">LOW</Badge>
}
