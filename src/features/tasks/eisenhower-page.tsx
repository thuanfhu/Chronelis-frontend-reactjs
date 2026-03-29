import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Loader2, GripVertical } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils/cn'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { taskApi } from '@/lib/api/modules/task-api'
import { taskStatusApi } from '@/lib/api/modules/task-status-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
import { useUiStore } from '@/app/store/ui-store'
import type { ImportanceLevel, Task, UrgencyLevel } from '@/types/domain'

interface Quadrant {
  importance: ImportanceLevel
  urgency: UrgencyLevel
  title: string
  label: string
  bgColor: string
  textColor: string
  hoverRing: string
}

const quadrants: Quadrant[] = [
  {
    importance: 'HIGH', urgency: 'HIGH',
    title: 'DO', label: 'Quan trọng & Khẩn cấp',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    hoverRing: 'ring-emerald-500/30',
  },
  {
    importance: 'HIGH', urgency: 'LOW',
    title: 'DECIDE', label: 'Quan trọng & Không khẩn',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/15',
    textColor: 'text-amber-600 dark:text-amber-400',
    hoverRing: 'ring-amber-500/30',
  },
  {
    importance: 'LOW', urgency: 'HIGH',
    title: 'DELEGATE', label: 'Không quan trọng & Khẩn cấp',
    bgColor: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    hoverRing: 'ring-cyan-500/30',
  },
  {
    importance: 'LOW', urgency: 'LOW',
    title: 'DELETE', label: 'Không quan trọng & Không khẩn',
    bgColor: 'bg-red-500/10 dark:bg-red-500/15',
    textColor: 'text-red-600 dark:text-red-400',
    hoverRing: 'ring-red-500/30',
  },
]

export function EisenhowerPage() {
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)
  const queryClient = useQueryClient()
  const setTaskDrawerTaskId = useUiStore((s) => s.setTaskDrawerTaskId)

  useProjectRealtime(Number.isFinite(workspaceId) ? workspaceId : null, Number.isFinite(projectId) ? projectId : null)

  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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

  const moveQuadrantMutation = useMutation({
    mutationFn: ({ taskId, importanceLevel, urgencyLevel }: { taskId: number; importanceLevel: ImportanceLevel; urgencyLevel: UrgencyLevel }) =>
      taskApi.update(taskId, { importanceLevel, urgencyLevel }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId, 1, 500) })
    },
    onError: (err: Error) => toast.error('Cập nhật thất bại', { description: err.message }),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return
    const task = active.data.current?.task as Task | undefined
    if (!task) return
    const overId = String(over.id)
    if (!overId.startsWith('Q_')) return
    const parts = overId.split('_')
    const importance = parts[1] as ImportanceLevel
    const urgency = parts[2] as UrgencyLevel
    if (task.importanceLevel !== importance || task.urgencyLevel !== urgency) {
      moveQuadrantMutation.mutate({ taskId: task.id, importanceLevel: importance, urgencyLevel: urgency })
    }
  }

  if (tasksQuery.isLoading) return <LoadingPanel />

  const allTasks = (tasksQuery.data?.content ?? []).filter((t) => !t.isCompleted)

  const getQuadrantTasks = (importance: ImportanceLevel, urgency: UrgencyLevel) =>
    allTasks.filter((t) => t.importanceLevel === importance && t.urgencyLevel === urgency)

  const unassigned = allTasks.filter((t) => !t.importanceLevel || !t.urgencyLevel)

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-bold">The Eisenhower Time Matrix</h2>
        <p className="text-xs text-muted-foreground">Kéo thả task để phân loại theo mức độ quan trọng và khẩn cấp</p>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(e) => {
          const task = e.active.data.current?.task as Task | undefined
          if (task) setActiveTask(task)
        }}
        onDragEnd={handleDragEnd}
      >
        {/* Matrix with axis labels */}
        <div className="flex gap-0">
          {/* Y-axis label */}
          <div className="flex w-6 shrink-0 flex-col items-center justify-around">
            <span
              style={{ writingMode: 'vertical-lr' }}
              className="rotate-180 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
            >
              Important
            </span>
            <span
              style={{ writingMode: 'vertical-lr' }}
              className="rotate-180 text-[11px] font-semibold text-red-500 dark:text-red-400"
            >
              Not Important
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-0">
            {/* X-axis labels */}
            <div className="mb-1 flex">
              <div className="flex-1 text-center text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Urgent
              </div>
              <div className="flex-1 text-center text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                Not Urgent
              </div>
            </div>

            {/* 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2">
              {quadrants.map((q) => (
                <QuadrantCell
                  key={`${q.importance}-${q.urgency}`}
                  quadrant={q}
                  tasks={getQuadrantTasks(q.importance, q.urgency)}
                  projectId={projectId}
                  defaultStatusId={statusesQuery.data?.[0]?.id}
                  onTaskClick={(taskId) => setTaskDrawerTaskId(taskId)}
                  onInvalidate={() => queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId, 1, 500) })}
                />
              ))}
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activeTask ? (
            <div className="w-64 rounded-md border border-primary/40 bg-card px-3 py-2 shadow-xl ring-2 ring-primary/10">
              <span className="text-xs font-medium">{activeTask.title}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Unassigned tasks */}
      {unassigned.length > 0 && (
        <div className="rounded-xl border border-dashed p-4">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Chưa phân loại ({unassigned.length})
          </p>
          <div className="space-y-1">
            {unassigned.map((task) => (
              <EisenhowerTaskItem
                key={task.id}
                task={task}
                onClick={() => setTaskDrawerTaskId(task.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function QuadrantCell({
  quadrant,
  tasks,
  projectId,
  defaultStatusId,
  onTaskClick,
  onInvalidate,
}: {
  quadrant: Quadrant
  tasks: Task[]
  projectId: number
  defaultStatusId?: number
  onTaskClick: (taskId: number) => void
  onInvalidate: () => void
}) {
  const [newTitle, setNewTitle] = useState('')

  const quadrantDropId = `Q_${quadrant.importance}_${quadrant.urgency}`
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: quadrantDropId })

  const createMutation = useMutation({
    mutationFn: () => {
      if (!defaultStatusId) throw new Error('Chưa có cột trạng thái')
      return taskApi.create({
        projectId,
        title: newTitle.trim(),
        statusId: defaultStatusId,
        priority: 'MEDIUM',
        importanceLevel: quadrant.importance,
        urgencyLevel: quadrant.urgency,
        sourceView: 'EISENHOWER',
      })
    },
    onSuccess: () => {
      setNewTitle('')
      onInvalidate()
      toast.success('Tạo task thành công')
    },
    onError: (error: Error) => toast.error('Tạo task thất bại', { description: error.message }),
  })

  return (
    <div
      ref={setDropRef}
      className={cn(
        'flex min-h-[220px] flex-col rounded-xl border p-3 transition-all duration-150',
        quadrant.bgColor,
        isOver && `ring-2 ${quadrant.hoverRing}`,
      )}
    >
      {/* Quadrant header */}
      <div className="mb-2 text-center">
        <h3 className={cn('text-2xl font-black tracking-wider', quadrant.textColor)}>
          {quadrant.title}
        </h3>
        <p className="text-[10px] text-muted-foreground">{quadrant.label}</p>
      </div>

      {/* Quick add */}
      <div className="mb-2 flex gap-1.5">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && newTitle.trim()) createMutation.mutate() }}
          placeholder="Thêm task..."
          className="h-7 text-xs"
        />
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !newTitle.trim()}
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
        >
          {createMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
        </Button>
      </div>

      {/* Task list */}
      <ScrollArea className="flex-1">
        <div className="space-y-1">
          {tasks.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-muted-foreground/50">Chưa có task</p>
          ) : (
            tasks.map((task) => (
              <EisenhowerTaskItem key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function EisenhowerTaskItem({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { task },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      onClick={onClick}
      className={cn(
        'group flex cursor-pointer items-center gap-2 rounded-md border bg-card/80 px-3 py-1.5 text-xs transition-all hover:border-primary/30 hover:shadow-sm',
        isDragging && 'opacity-40 ring-2 ring-primary/20',
      )}
    >
      <button
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="size-3 shrink-0 text-muted-foreground/40" />
      </button>
      <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
      {task.assignee && (
        <span className="max-w-14 shrink-0 truncate text-[10px] text-muted-foreground">
          {task.assignee.firstName}
        </span>
      )}
    </div>
  )
}
