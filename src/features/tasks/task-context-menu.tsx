import {
  Copy,
  Eye,
  NotebookText,
  Pencil,
  Timer,
  Trash2,
} from 'lucide-react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import type { Task } from '@/types/domain'

export interface TaskContextMenuState {
  x: number
  y: number
  task: Task
  scheduledStart?: string
  scheduledEnd?: string
}

interface TaskContextMenuProps {
  state: TaskContextMenuState | null
  canManageTask: (task: Task) => boolean
  onOpenChange: (state: TaskContextMenuState | null) => void
  onViewTask: (task: Task) => void
  onEditTask?: (task: Task) => void
  onDuplicateTask?: (task: Task) => void
  onDeleteTask?: (task: Task) => void
  onOpenPomodoro?: (task: Task) => void
  onOpenNotes?: (task: Task) => void
}

export function buildDuplicateTaskTitle(title: string): string {
  const trimmedTitle = title.trim()
  const duplicateSuffix = ' (Bản sao)'

  if (!trimmedTitle) {
    return `Task mới${duplicateSuffix}`
  }

  if (trimmedTitle.toLowerCase().endsWith(duplicateSuffix.toLowerCase())) {
    return `${trimmedTitle} 2`
  }

  return `${trimmedTitle}${duplicateSuffix}`
}

export function TaskContextMenu({
  state,
  canManageTask,
  onOpenChange,
  onViewTask,
  onEditTask,
  onDuplicateTask,
  onDeleteTask,
  onOpenPomodoro,
  onOpenNotes,
}: TaskContextMenuProps) {
  const task = state?.task ?? null
  const canManage = task ? canManageTask(task) : false

  const runAction = (action?: (nextTask: Task) => void) => {
    if (!task || !action) {
      return
    }

    action(task)
    onOpenChange(null)
  }

  return (
    <Popover
      open={Boolean(state)}
      onOpenChange={(open) => {
        if (!open) {
          onOpenChange(null)
        }
      }}
    >
      {state && (
        <PopoverAnchor
          style={{
            position: 'fixed',
            left: state.x,
            top: state.y,
            width: 1,
            height: 1,
          }}
        />
      )}
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-56 p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex flex-col">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent"
            onClick={() => runAction(onViewTask)}
          >
            <Eye className="size-3.5" />
            Xem chi tiết
          </button>

          {onEditTask && canManage && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent"
              onClick={() => runAction(onEditTask)}
            >
              <Pencil className="size-3.5" />
              Chỉnh sửa task
            </button>
          )}

          {onDuplicateTask && canManage && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent"
              onClick={() => runAction(onDuplicateTask)}
            >
              <Copy className="size-3.5" />
              Nhân bản thành bản nháp
            </button>
          )}

          {onOpenNotes && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent"
              onClick={() => runAction(onOpenNotes)}
            >
              <NotebookText className="size-3.5" />
              Mở ghi chú
            </button>
          )}

          {onOpenPomodoro && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent"
              onClick={() => runAction(onOpenPomodoro)}
            >
              <Timer className="size-3.5" />
              Mở Pomodoro
            </button>
          )}

          {onDeleteTask && canManage && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-sm px-2 text-sm text-destructive hover:bg-destructive/10"
              onClick={() => runAction(onDeleteTask)}
            >
              <Trash2 className="size-3.5" />
              Xóa task
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
