import { type MouseEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Loader2, GripVertical, Columns3, RefreshCw } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  rectIntersection,
  pointerWithin,
  useDroppable,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
import { useProjectPermissions } from '@/lib/permissions/use-project-permissions'
import { useUiStore } from '@/app/store/ui-store'
import { TaskBlockerBadge } from '@/features/tasks/task-blocker-badge'
import { TaskCreateDialog } from '@/features/tasks/task-create-dialog'
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
      <TaskBlockerBadge task={task} compact className="mt-2" />
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
  const { t } = useTranslation()
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
          <Badge variant="outline" className="text-[9px]">{t('kanban.closed')}</Badge>
        )}
      </div>

      {/* Column body */}
      <ScrollArea className="flex-1">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="min-h-32 space-y-2 p-2">
            {tasks.length === 0 && (
              <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border/50 text-xs text-muted-foreground">
                {t('kanban.dragHere')}
              </div>
            )}
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
  const { t } = useTranslation()

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
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [overColumnId, setOverColumnId] = useState<number | null>(null)
  const [taskContextMenu, setTaskContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // Custom collision detection: prefer pointerWithin first (catches empty columns),
  // then fall back to closestCorners for task-level precision
  const customCollisionDetection: CollisionDetection = (args) => {
    // First check if pointer is within any droppable (works well for empty columns)
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      // Prefer column-level droppables when pointer is inside them
      const columnCollision = pointerCollisions.find((c) => String(c.id).startsWith('column-'))
      // If we're over a task, use that; otherwise use the column
      const taskCollision = pointerCollisions.find((c) => String(c.id).startsWith('task-'))
      if (taskCollision) return [taskCollision]
      if (columnCollision) return [columnCollision]
      return pointerCollisions
    }
    // Fallback to rect intersection then closest corners
    const rectCollisions = rectIntersection(args)
    if (rectCollisions.length > 0) return rectCollisions
    return closestCorners(args)
  }

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

  const createStatusMutation = useMutation({
    mutationFn: () => {
      if (!canManageProject) {
        throw new Error(t('kanban.noPermissionColumn'))
      }

      return taskStatusApi.create({ projectId, name: statusName.trim(), code: statusCode.trim() })
    },
    onSuccess: () => {
      setStatusName('')
      setStatusCode('')
      setStatusDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.statuses.byProject(projectId) })
      toast.success(t('kanban.createColumnSuccess'))
    },
    onError: (error: Error) => {
      toast.error(t('kanban.createColumnError'), { description: error.message })
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
      toast.error(t('kanban.moveTaskError'), { description: error.message })
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
      toast.error(t('kanban.moveTaskError'), { description: error.message })
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
      toast.error(t('kanban.noPermission'))
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
    <div className="space-y-5 min-w-0">
      <PageHeader
        title={t('kanban.title')}
        description={t('kanban.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId, 1, 200) })
                void queryClient.invalidateQueries({ queryKey: queryKeys.statuses.byProject(projectId) })
              }}
            >
              <RefreshCw className={cn('size-3.5', (tasksQuery.isFetching || statusesQuery.isFetching) && 'animate-spin')} />
              {t('common.refresh')}
            </Button>
            <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!canManageProject}>
                  <Plus className="mr-1.5 size-3.5" />
                  {t('kanban.addColumn')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('kanban.addColumnTitle')}</DialogTitle>
                  <DialogDescription>{t('kanban.addColumnDesc')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>{t('kanban.columnName')}</Label>
                    <Input value={statusName} onChange={(e) => setStatusName(e.target.value)} placeholder={t('kanban.columnNamePlaceholder')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('kanban.columnCode')}</Label>
                    <Input value={statusCode} onChange={(e) => setStatusCode(e.target.value)} placeholder={t('kanban.columnCodePlaceholder')} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>{t('common.cancel')}</Button>
                  <Button onClick={() => createStatusMutation.mutate()} disabled={createStatusMutation.isPending || !statusName.trim() || !statusCode.trim() || !canManageProject}>
                    {createStatusMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {t('common.create')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button size="sm" disabled={!canManageProject} onClick={() => setTaskDialogOpen(true)}>
              <Plus className="mr-1.5 size-3.5" />
              {t('kanban.createTask')}
            </Button>
          </div>
        }
      />

      <TaskCreateDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        workspaceId={workspaceId}
        projectId={projectId}
        title={t('kanban.createTaskTitle')}
        description={t('kanban.createTaskDesc')}
        submitLabel={t('task.createSubmit')}
        defaultSourceView="KANBAN"
        defaultStatusId={statusesQuery.data?.[0]?.id ?? null}
      />

      {statuses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Columns3 className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">{t('kanban.noColumns')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('kanban.noColumnsDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={canManageProject ? sensors : []}
          collisionDetection={customCollisionDetection}
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
                    if (canManageTask()) {
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
