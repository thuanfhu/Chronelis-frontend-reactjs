import { CircleAlert, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Task } from '@/types/domain'

interface TaskBlockerBadgeProps {
  task: Pick<Task, 'blocked' | 'blockedReason' | 'blockedByOpenCount' | 'blockingTaskCount'>
  compact?: boolean
  className?: string
}

export function TaskBlockerBadge({ task, compact = false, className }: TaskBlockerBadgeProps) {
  if (!task.blocked && !task.blockingTaskCount) {
    return null
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {task.blocked ? (
        <span
          title={task.blockedReason ?? 'Task đang bị chặn'}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 font-medium text-rose-800 dark:border-rose-400/35 dark:bg-rose-500/20 dark:text-rose-100',
            compact ? 'text-[10px]' : 'text-[11px]',
          )}
        >
          <CircleAlert className={compact ? 'size-3' : 'size-3.5'} />
          {task.blockedByOpenCount && task.blockedByOpenCount > 0
            ? `Blocked · ${task.blockedByOpenCount}`
            : 'Blocked'}
        </span>
      ) : null}

      {task.blockingTaskCount && task.blockingTaskCount > 0 ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/20 dark:text-amber-100',
            compact ? 'text-[10px]' : 'text-[11px]',
          )}
        >
          <Link2 className={compact ? 'size-3' : 'size-3.5'} />
          {`Blocking · ${task.blockingTaskCount}`}
        </span>
      ) : null}
    </div>
  )
}