import { type MouseEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Loader2, GripVertical, Columns3 } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils/cn'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { taskStatusApi } from '@/lib/api/modules/task-status-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { goalApi } from '@/lib/api/modules/goal-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
import { useProjectPermissions } from '@/lib/permissions/use-project-permissions'
import { useUiStore } from '@/app/store/ui-store'
import { TaskPriorityBadge } from '@/features/tasks/task-priority-badge'
import { TaskContextMenu } from '@/features/tasks/task-context-menu'
import {
  applyTaskMove,
  applyTaskReorder,
  patchProjectTaskQueries,
  restoreProjectTaskQueries,
  snapshotProjectTaskQueries,
} from '@/lib/tasks/optimistic-task-cache'
import type { Task, TaskPriorityType, TaskStatus } from '@/types/domain'

const PRIORITY_CARD_CLASSNAMES: Record<TaskPriorityType, string> = {
  URGENT: 'chronelis-task-card chronelis-task-card--urgent',
  HIGH: 'chronelis-task-card chronelis-task-card--high',
  MEDIUM: 'chronelis-task-card chronelis-task-card--medium',
  LOW: 'chronelis-task-card chronelis-task-card--low',
}

// ─── Sortable Task Card ───

function SortableTaskCard({
  task,
  onClick,
  onContextAction,
}: {
  task: Task
  onClick: () => void
  onContextAction: (event: MouseEvent<HTMLDivElement>) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task-${task.id}`,
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
        'group cursor-pointer rounded-lg border p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        PRIORITY_CARD_CLASSNAMES[task.priority],
        isDragging && 'opacity-40 shadow-lg ring-2 ring-primary/20',
      )}
      onClick={onClick}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onContextAction(event)
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="chronelis-task-card__title line-clamp-2 text-sm font-semibold">{task.title}</p>
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-current/40 opacity-0 transition-opacity hover:text-current/70 group-hover:opacity-100 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3.5" />
        </button>
      </div>
      {task.description && (
        <p className="chronelis-task-card__description mb-2 line-clamp-1 text-xs">{task.description}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="chronelis-task-card__meta flex items-center gap-1.5">
          <TaskPriorityBadge priority={task.priority} />
          <span className="text-[10px]">#{task.id}</span>
        </div>
        <span className="chronelis-task-card__meta max-w-20 truncate text-[10px]">
          {task.assignee?.firstName ?? 'Unassigned'}
        </span>
      </div>
    </div>
  )
}

// ─── Drag Overlay Card ───

function TaskDragOverlay({ task }: { task: Task }) {
  return (
    <div className="w-[min(18rem,calc(100vw-3.5rem))] rounded-lg border border-primary/30 bg-card p-3 shadow-xl ring-2 ring-primary/10 sm:w-72">
      <div className="mb-2">
        <p className="line-clamp-2 text-sm font-medium">{task.title}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <TaskPriorityBadge priority={task.priority} />
        <span className="text-[10px] text-muted-foreground">#{task.id}</span>
      </div>
    </div>
  )
}

// ─── Droppable Column ───

function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  onTaskContextMenu,
  isOver,
}: {
  status: TaskStatus
  tasks: Task[]
  onTaskClick: (taskId: number) => void
  onTaskContextMenu: (event: MouseEvent<HTMLDivElement>, task: Task) => void
  isOver?: boolean
}) {
  const taskIds = useMemo(() => tasks.map((t) => `task-${t.id}`), [tasks])
  const { setNodeRef: setDropRef } = useDroppable({ id: `column-${status.id}` })

  return (
    <div
      ref={setDropRef}
      className={cn(
        'flex w-[min(18rem,calc(100vw-3.5rem))] shrink-0 snap-start flex-col rounded-xl border bg-muted/20 transition-colors duration-200 sm:w-72',
        isOver && 'border-primary/40 bg-primary/5',
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{status.name}</h3>
          <Badge variant="secondary" className="text-[10px]">{tasks.length}</Badge>
        </div>
        {status.isClosed && (
          <Badge variant="outline" className="text-[9px]">Closed</Badge>
        )}
      </div>

      {/* Column body */}
      <ScrollArea className="flex-1">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="min-h-16 space-y-2 p-2">
            {tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task.id)}
                onContextAction={(event) => onTaskContextMenu(event, task)}
              />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  )
}

// ─── Main Kanban Page ───

export function KanbanPage() {
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)
  const queryClient = useQueryClient()
  const openTaskDrawer = useUiStore((s) => s.openTaskDrawer)
  const openTaskDeleteConfirm = useUiStore((s) => s.openTaskDeleteConfirm)

  useProjectRealtime(Number.isFinite(workspaceId) ? workspaceId : null, Number.isFinite(projectId) ? projectId : null)
  const { canManageProject, canManageTask, permissionsReady } = useProjectPermissions({
    workspaceId,
    projectId,
    enabled: Number.isFinite(workspaceId) && Number.isFinite(projectId),
  })

  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [statusName, setStatusName] = useState('')
  const [statusCode, setStatusCode] = useState('')
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskStatusId, setTaskStatusId] = useState<number | null>(null)
  const [taskPriority, setTaskPriority] = useState<TaskPriorityType>('MEDIUM')
  const [taskGoalId, setTaskGoalId] = useState<number | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [overColumnId, setOverColumnId] = useState<number | null>(null)
  const [taskContextMenu, setTaskContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const statusesQuery = useQuery({
    queryKey: queryKeys.statuses.byProject(projectId),
    queryFn: () => taskStatusApi.listByProject(projectId),
    enabled: Number.isFinite(projectId),
  })

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.byProject(projectId, 1, 200),
    queryFn: () => taskApi.listByProject(projectId, { page: 1, size: 200 }),
    enabled: Number.isFinite(projectId),
  })

  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.byProject(projectId, 1, 50),
    queryFn: () => goalApi.listByProject(projectId, { page: 1, size: 50 }),
    enabled: Number.isFinite(projectId),
  })

  const createStatusMutation = useMutation({
    mutationFn: () => {
      if (!canManageProject) {
        throw new Error('Bạn không có quyền tạo cột trạng thái trong project này')
      }

      return taskStatusApi.create({ projectId, name: statusName.trim(), code: statusCode.trim() })
    },
    onSuccess: () => {
      setStatusName('')
      setStatusCode('')
      setStatusDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.statuses.byProject(projectId) })
      toast.success('Tạo cột thành công')
    },
    onError: (error: Error) => {
      toast.error('Tạo cột thất bại', { description: error.message })
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: () => {
      if (!canManageProject) {
        throw new Error('Bạn không có quyền tạo task trong project này')
      }

      return taskApi.create({
        projectId,
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        statusId: taskStatusId ?? 0,
        priority: taskPriority,
        goalId: taskGoalId ?? undefined,
        sourceView: 'KANBAN',
      })
    },
    onSuccess: () => {
      setTaskTitle('')
      setTaskDescription('')
      setTaskGoalId(null)
      setTaskDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId, 1, 200) })
      toast.success('Tạo task thành công')
    },
    onError: (error: Error) => {
      toast.error('Tạo task thất bại', { description: error.message })
    },
  })

  const reorderTaskMutation = useMutation({
    mutationFn: ({ taskId, targetPosition }: { taskId: number; statusId: number; targetPosition: number }) =>
      taskApi.reorder(taskId, targetPosition),
    onMutate: async ({ taskId, statusId, targetPosition }: { taskId: number; statusId: number; targetPosition: number }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'project', projectId] })

      const snapshot = snapshotProjectTaskQueries(queryClient, projectId)
      patchProjectTaskQueries(queryClient, projectId, (tasks) =>
        applyTaskReorder(tasks, {
          taskId,
          statusId,
          targetPosition,
        }),
      )

      return { snapshot }
    },
    onError: (error: Error, _variables, context) => {
      if (context?.snapshot) {
        restoreProjectTaskQueries(queryClient, context.snapshot)
      }
      toast.error('Di chuyển task thất bại', { description: error.message })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] })
    },
  })

  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, statusId, targetPosition }: { taskId: number; statusId: number; targetPosition?: number }) =>
      taskApi.move(taskId, statusId, targetPosition),
    onMutate: async ({ taskId, statusId, targetPosition }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'project', projectId] })

      const snapshot = snapshotProjectTaskQueries(queryClient, projectId)
      patchProjectTaskQueries(queryClient, projectId, (tasks) =>
        applyTaskMove(tasks, {
          taskId,
          targetStatusId: statusId,
          targetPosition,
          statuses: statusesQuery.data ?? [],
        }),
      )

      return { snapshot }
    },
    onError: (error: Error, _variables, context) => {
      if (context?.snapshot) {
        restoreProjectTaskQueries(queryClient, context.snapshot)
      }
      toast.error('Di chuyển task thất bại', { description: error.message })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] })
    },
  })

  // DnD handlers
  function handleDragStart(event: DragStartEvent) {
    setTaskContextMenu(null)
    const { active } = event
    const data = active.data.current
    if (data?.type === 'task') {
      setActiveTask(data.task as Task)
    }
  }

  function openTaskContextMenu(event: MouseEvent<HTMLElement>, task: Task) {
    const x = Math.min(event.clientX, window.innerWidth - 196)
    const y = Math.min(event.clientY, window.innerHeight - 196)
    setTaskContextMenu({ x, y, task })
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event
    if (!over) {
      setOverColumnId(null)
      return
    }

    // Determine which column we're over
    const overData = over.data.current
    if (overData?.type === 'task') {
      const overTask = overData.task as Task
      setOverColumnId(overTask.status.id)
    } else {
      // Over a column droppable area
      const overIdStr = String(over.id)
      if (overIdStr.startsWith('column-')) {
        setOverColumnId(Number(overIdStr.replace('column-', '')))
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    setOverColumnId(null)

    if (!canManageProject) {
      toast.error('Bạn không có quyền sắp xếp task trên Kanban board này')
      return
    }

    if (!over) return

    const activeData = active.data.current
    if (activeData?.type !== 'task') return

    const draggedTask = activeData.task as Task
    let targetStatusId: number | null = null
    let targetPosition: number | undefined

    const overData = over.data.current
    if (overData?.type === 'task') {
      const overTask = overData.task as Task
      targetStatusId = overTask.status.id
      // Calculate target position from the over task's position in its column
      const columnTasks = grouped.get(overTask.status.id) ?? []
      const overIndex = columnTasks.findIndex((t) => t.id === overTask.id)
      targetPosition = overIndex >= 0 ? overIndex : undefined
    } else {
      const overIdStr = String(over.id)
      if (overIdStr.startsWith('column-')) {
        targetStatusId = Number(overIdStr.replace('column-', ''))
      }
    }

    if (!targetStatusId) return

    if (targetStatusId !== draggedTask.status.id) {
      // Cross-column move
      moveTaskMutation.mutate({
        taskId: draggedTask.id,
        statusId: targetStatusId,
        targetPosition,
      })
    } else if (targetPosition != null && active.id !== over.id) {
      // Same column reorder
      reorderTaskMutation.mutate({
        taskId: draggedTask.id,
        statusId: draggedTask.status.id,
        targetPosition,
      })
    }
  }

  if (statusesQuery.isLoading || tasksQuery.isLoading || !permissionsReady) {
    return <LoadingPanel />
  }

  const statuses = statusesQuery.data ?? []
  const tasks = tasksQuery.data?.content ?? []
  const grouped = new Map<number, Task[]>()
  for (const status of statuses) grouped.set(status.id, [])
  for (const task of tasks) {
    if (!grouped.has(task.status.id)) grouped.set(task.status.id, [])
    grouped.get(task.status.id)!.push(task)
  }
  for (const bucket of grouped.values()) bucket.sort((a, b) => a.boardPosition - b.boardPosition)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kanban Board"
        description="Kéo thả task giữa các cột theo workflow"
        actions={
          <div className="flex flex-wrap gap-2">
            {/* Status dialog */}
            <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!canManageProject}>
                  <Plus className="mr-1.5 size-3.5" />
                  Thêm cột
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Thêm cột trạng thái</DialogTitle>
                  <DialogDescription>Tạo một cột mới trên kanban board.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Tên cột</Label>
                    <Input value={statusName} onChange={(e) => setStatusName(e.target.value)} placeholder="Ví dụ: In Review" />
                  </div>
                  <div className="space-y-2">
                    <Label>Code</Label>
                    <Input value={statusCode} onChange={(e) => setStatusCode(e.target.value)} placeholder="Ví dụ: IN_REVIEW" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Hủy</Button>
                  <Button onClick={() => createStatusMutation.mutate()} disabled={createStatusMutation.isPending || !statusName.trim() || !statusCode.trim() || !canManageProject}>
                    {createStatusMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Tạo
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Task dialog */}
            <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!canManageProject}>
                  <Plus className="mr-1.5 size-3.5" />
                  Tạo task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tạo task mới</DialogTitle>
                  <DialogDescription>Thêm task vào một cột trên board.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Tiêu đề</Label>
                    <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Tiêu đề task" />
                  </div>
                  <div className="space-y-2">
                    <Label>Mô tả (tùy chọn)</Label>
                    <Textarea value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Mô tả chi tiết..." rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cột</Label>
                    <div className="flex flex-wrap gap-2">
                      {statuses.map((s) => (
                        <Button key={s.id} type="button" variant={taskStatusId === s.id ? 'default' : 'outline'} size="sm" onClick={() => setTaskStatusId(s.id)}>
                          {s.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Mức ưu tiên</Label>
                    <div className="flex gap-2">
                      {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => (
                        <Button key={p} type="button" variant={taskPriority === p ? 'default' : 'outline'} size="sm" onClick={() => setTaskPriority(p)}>
                          {p}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Goal (tùy chọn)</Label>
                    <Select value={taskGoalId ? String(taskGoalId) : '__none'} onValueChange={(v) => setTaskGoalId(v === '__none' ? null : Number(v))}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Không chọn goal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Không chọn goal</SelectItem>
                        {(goalsQuery.data?.content ?? []).map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              <span className="block max-w-60 truncate" title={g.title}>{g.title}</span>
                            </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Hủy</Button>
                  <Button onClick={() => createTaskMutation.mutate()} disabled={createTaskMutation.isPending || !taskTitle.trim() || !taskStatusId || !canManageProject}>
                    {createTaskMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Tạo
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {statuses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Columns3 className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">Chưa có cột nào</p>
            <p className="mt-1 text-xs text-muted-foreground">Thêm cột trạng thái đầu tiên để bắt đầu</p>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={canManageProject ? sensors : []}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
            {statuses.map((status) => {
              const columnTasks = grouped.get(status.id) ?? []
              return (
                <KanbanColumn
                  key={status.id}
                  status={status}
                  tasks={columnTasks}
                  onTaskClick={(taskId) => openTaskDrawer(taskId, 'view')}
                  onTaskContextMenu={(event, task) => {
                    if (canManageTask(task.goalId)) {
                      openTaskContextMenu(event, task)
                    }
                  }}
                  isOver={overColumnId === status.id}
                />
              )
            })}
          </div>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeTask ? <TaskDragOverlay task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <TaskContextMenu
        open={Boolean(taskContextMenu)}
        x={taskContextMenu?.x ?? 0}
        y={taskContextMenu?.y ?? 0}
        onClose={() => setTaskContextMenu(null)}
        onDuplicate={() => {
          const task = taskContextMenu?.task
          if (task) {
            openTaskDrawer(task.id, 'duplicate')
          }
        }}
        onEdit={() => {
          const task = taskContextMenu?.task
          if (task) {
            openTaskDrawer(task.id, 'edit')
          }
        }}
        onDelete={() => {
          const task = taskContextMenu?.task
          if (task) {
            openTaskDeleteConfirm(task.id)
          }
        }}
      />
    </div>
  )
}
