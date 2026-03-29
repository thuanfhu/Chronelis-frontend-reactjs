import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Plus, Loader2, Circle, CheckCircle2, ChevronDown, ListTodo, Calendar, Target, GripVertical,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { taskApi } from '@/lib/api/modules/task-api'
import { taskStatusApi } from '@/lib/api/modules/task-status-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
import { useUiStore } from '@/app/store/ui-store'
import { TaskPriorityBadge } from '@/features/tasks/task-priority-badge'
import type { Task } from '@/types/domain'

type GroupMode = 'none' | 'day' | 'goal'

function isToday(date: Date): boolean {
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

function isThisWeek(date: Date): boolean {
  const now = new Date()
  const weekEnd = new Date(now)
  weekEnd.setDate(now.getDate() + 7)
  return date > now && date <= weekEnd
}

function getDayGroupKey(task: Task): string {
  if (!task.dueDate) return '__nodate'
  const d = new Date(task.dueDate)
  if (isToday(d)) return '__today'
  if (d < new Date()) return '__overdue'
  if (isThisWeek(d)) return '__week'
  return '__later'
}

const DAY_GROUP_LABELS: Record<string, string> = {
  '__overdue': 'Quá hạn',
  '__today': 'Hôm nay',
  '__week': 'Tuần này',
  '__later': 'Sau đó',
  '__nodate': 'Không có hạn',
}

const DAY_GROUP_ORDER = ['__overdue', '__today', '__week', '__later', '__nodate']

function buildDayGroups(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const key of DAY_GROUP_ORDER) map.set(key, [])
  for (const task of tasks) {
    const key = getDayGroupKey(task)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(task)
  }
  return map
}

function buildGoalGroups(tasks: Task[]): Map<string, { label: string; tasks: Task[] }> {
  const map = new Map<string, { label: string; tasks: Task[] }>()
  for (const task of tasks) {
    const key = task.goalId ? String(task.goalId) : '__nogoal'
    const label = task.goalId ? `Goal #${task.goalId}` : 'Không có goal'
    if (!map.has(key)) map.set(key, { label, tasks: [] })
    map.get(key)!.tasks.push(task)
  }
  return map
}

export function TodoPage() {
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)
  const queryClient = useQueryClient()
  const setTaskDrawerTaskId = useUiStore((s) => s.setTaskDrawerTaskId)
  useProjectRealtime(workspaceId, projectId)

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [groupMode, setGroupMode] = useState<GroupMode>('none')
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.byProject(projectId, 1, 500),
    queryFn: () => taskApi.listByProject(projectId, { page: 1, size: 500 }),
    enabled: Number.isFinite(projectId),
  })

  const statusesQuery = useQuery({
    queryKey: queryKeys.statuses.byProject(projectId),
    queryFn: () => taskStatusApi.listByProject(projectId),
    enabled: Number.isFinite(projectId),
  })

  const createTaskMutation = useMutation({
    mutationFn: () => {
      const statuses = statusesQuery.data
      const defaultStatus = statuses?.[0]
      if (!defaultStatus) throw new Error('Chưa có cột trạng thái')
      return taskApi.create({
        projectId,
        title: newTaskTitle.trim(),
        statusId: defaultStatus.id,
        priority: 'MEDIUM',
        sourceView: 'TODO',
      })
    },
    onSuccess: () => {
      setNewTaskTitle('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId, 1, 500) })
      toast.success('Tạo task thành công')
    },
    onError: (error: Error) => {
      toast.error('Tạo task thất bại', { description: error.message })
    },
  })

  const toggleCompletionMutation = useMutation({
    mutationFn: ({ taskId, isCompleted }: { taskId: number; isCompleted: boolean }) =>
      taskApi.updateCompletion(taskId, isCompleted),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId, 1, 500) })
    },
  })

  const reorderMutation = useMutation({
    mutationFn: ({ taskId, targetPosition }: { taskId: number; targetPosition: number }) =>
      taskApi.reorder(taskId, targetPosition),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId, 1, 500) })
    },
  })

  function handleDragStart(event: DragStartEvent) {
    const task = event.active.data.current?.task as Task | undefined
    if (task) setActiveTask(task)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const overData = over.data.current
    if (overData?.type === 'task') {
      const overTask = overData.task as Task
      const overIndex = pendingTasks.findIndex((t) => t.id === overTask.id)
      if (overIndex >= 0) {
        const draggedTask = active.data.current?.task as Task
        if (draggedTask) {
          reorderMutation.mutate({ taskId: draggedTask.id, targetPosition: overIndex })
        }
      }
    }
  }

  if (tasksQuery.isLoading) return <LoadingPanel />

  const allTasks = tasksQuery.data?.content ?? []
  const pendingTasks = allTasks.filter((t) => !t.isCompleted)
  const completedTasks = allTasks.filter((t) => t.isCompleted)

  const pendingTaskIds = useMemo(() => pendingTasks.map((t) => `todo-${t.id}`), [pendingTasks])

  const dayGroups = groupMode === 'day' ? buildDayGroups(pendingTasks) : null
  const goalGroups = groupMode === 'goal' ? buildGoalGroups(pendingTasks) : null

  return (
    <div className="space-y-5">
      <PageHeader
        title="To Do"
        description="Quản lý task theo danh sách — kéo thả để sắp xếp lại"
      />

      {/* Group controls */}
      <div className="flex gap-1.5">
        {(['none', 'day', 'goal'] as GroupMode[]).map((mode) => (
          <Button
            key={mode}
            variant={groupMode === mode ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setGroupMode(mode)}
          >
            {mode === 'none' && 'Tất cả'}
            {mode === 'day' && <><Calendar className="mr-1 size-3" />Theo ngày</>}
            {mode === 'goal' && <><Target className="mr-1 size-3" />Theo goal</>}
          </Button>
        ))}
      </div>

      {/* Quick add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Plus className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTaskTitle.trim()) createTaskMutation.mutate()
            }}
            placeholder="Thêm task mới..."
            className="pl-9"
          />
        </div>
        <Button
          onClick={() => createTaskMutation.mutate()}
          disabled={createTaskMutation.isPending || !newTaskTitle.trim()}
          size="sm"
        >
          {createTaskMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Thêm'}
        </Button>
      </div>

      {/* Pending tasks */}
      {pendingTasks.length === 0 && completedTasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListTodo className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">Chưa có task nào</p>
            <p className="mt-1 text-xs text-muted-foreground">Thêm task đầu tiên ở phía trên</p>
          </CardContent>
        </Card>
      ) : groupMode === 'day' && dayGroups ? (
        <div className="space-y-4">
          {DAY_GROUP_ORDER.map((key) => {
            const tasks = dayGroups.get(key) ?? []
            if (tasks.length === 0) return null
            return (
              <div key={key}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {DAY_GROUP_LABELS[key]} ({tasks.length})
                </h3>
                <div className="space-y-1">
                  {tasks.map((task) => (
                    <TodoItem
                      key={task.id}
                      task={task}
                      onToggle={() => toggleCompletionMutation.mutate({ taskId: task.id, isCompleted: true })}
                      onClick={() => setTaskDrawerTaskId(task.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : groupMode === 'goal' && goalGroups ? (
        <div className="space-y-4">
          {[...goalGroups.entries()].map(([key, { label, tasks }]) => (
            <div key={key}>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Target className="size-3" />
                {label} ({tasks.length})
              </h3>
              <div className="space-y-1">
                {tasks.map((task) => (
                  <TodoItem
                    key={task.id}
                    task={task}
                    onToggle={() => toggleCompletionMutation.mutate({ taskId: task.id, isCompleted: true })}
                    onClick={() => setTaskDrawerTaskId(task.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={pendingTaskIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {pendingTasks.map((task) => (
                <SortableTodoItem
                  key={task.id}
                  task={task}
                  onToggle={() => toggleCompletionMutation.mutate({ taskId: task.id, isCompleted: true })}
                  onClick={() => setTaskDrawerTaskId(task.id)}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
            {activeTask ? (
              <div className="rounded-lg border border-primary/30 bg-card px-4 py-3 shadow-xl ring-2 ring-primary/10">
                <p className="text-sm font-medium">{activeTask.title}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={cn('size-4 transition-transform', !showCompleted && '-rotate-90')} />
            Đã hoàn thành ({completedTasks.length})
          </button>
          <AnimatePresence initial={false}>
            {showCompleted && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-1 overflow-hidden"
              >
                {completedTasks.map((task) => (
                  <TodoItem
                    key={task.id}
                    task={task}
                    onToggle={() => toggleCompletionMutation.mutate({ taskId: task.id, isCompleted: false })}
                    onClick={() => setTaskDrawerTaskId(task.id)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function SortableTodoItem({ task, onToggle, onClick }: { task: Task; onToggle: () => void; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `todo-${task.id}`,
    data: { type: 'task', task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-all hover:border-primary/30 hover:shadow-sm',
        task.isCompleted && 'opacity-60',
        isDragging && 'opacity-40 shadow-lg ring-2 ring-primary/20',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
      >
        {task.isCompleted ? (
          <CheckCircle2 className="size-5 text-primary" />
        ) : (
          <Circle className="size-5" />
        )}
      </button>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onClick}>
        <p className={cn('text-sm font-medium', task.isCompleted && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
        {task.dueDate && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(task.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <TaskPriorityBadge priority={task.priority} />
      </div>
    </div>
  )
}

function TodoItem({ task, onToggle, onClick }: { task: Task; onToggle: () => void; onClick: () => void }) {
  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-all hover:border-primary/30 hover:shadow-sm',
        task.isCompleted && 'opacity-60',
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
      >
        {task.isCompleted ? (
          <CheckCircle2 className="size-5 text-primary" />
        ) : (
          <Circle className="size-5" />
        )}
      </button>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onClick}>
        <p className={cn('text-sm font-medium', task.isCompleted && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
        {task.dueDate && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(task.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        )}
        {task.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{task.description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {task.checkItemCount > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {task.checkItemDoneCount}/{task.checkItemCount}
          </span>
        )}
        <TaskPriorityBadge priority={task.priority} />
        {task.assignee && (
          <span className="max-w-16 truncate text-[10px] text-muted-foreground">
            {task.assignee.firstName}
          </span>
        )}
      </div>
    </div>
  )
}
