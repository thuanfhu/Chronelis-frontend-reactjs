import { type MouseEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Plus,
  Loader2,
  Circle,
  CheckCircle2,
  ChevronDown,
  ListTodo,
  Calendar as CalendarIcon,
  Target,
  GripVertical,
  Timer,
  NotebookText,
  Clock3,
  X,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as DatePickerCalendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils/cn'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { taskApi } from '@/lib/api/modules/task-api'
import { taskScheduleApi } from '@/lib/api/modules/task-schedule-api'
import { taskStatusApi } from '@/lib/api/modules/task-status-api'
import { goalApi } from '@/lib/api/modules/goal-api'
import { queryKeys } from '@/lib/api/query-keys'
import { playTaskCompleteSound } from '@/lib/audio/play-task-complete-sound'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
import { useProjectPermissions } from '@/lib/permissions/use-project-permissions'
import { useUiStore } from '@/app/store/ui-store'
import {
  applyTaskCompletion,
  applyTaskReorder,
  patchProjectTaskQueries,
  restoreProjectTaskQueries,
  snapshotProjectTaskQueries,
} from '@/lib/tasks/optimistic-task-cache'
import type { Task, TaskPriorityType } from '@/types/domain'
import { TaskBlockerBadge } from '@/features/tasks/task-blocker-badge'
import { TaskCreateDialog } from '@/features/tasks/task-create-dialog'
import { TaskContextMenu } from '@/features/tasks/task-context-menu'

type GroupMode = 'none' | 'day' | 'goal'
type GoalFilterValue = 'all' | '__nogoal' | `${number}`
type PriorityFilterValue = 'all' | TaskPriorityType

interface ScheduledTodoEntry {
  scheduleId: number
  task: Task
  scheduledStart: string
  scheduledEnd: string
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDateKey(value: string | null): Date | null {
  if (!value) {
    return null
  }

  const parts = value.split('-').map(Number)
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null
  }

  const [year, month, day] = parts
  return new Date(year, month - 1, day)
}

function resolveDateLocale(language: string): string {
  return language.toLowerCase().startsWith('vi') ? 'vi-VN' : 'en-US'
}

function formatScheduleTimeRangeForLocale(startIso: string, endIso: string, locale: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  return `${start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
}

function formatDisplayDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function isToday(date: Date): boolean {
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  )
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

const TODO_PRIORITY_BORDER_CLASSNAMES: Record<TaskPriorityType, string> = {
  LOW: 'border-l-4 border-l-emerald-600 dark:border-l-emerald-400',
  MEDIUM: 'border-l-4 border-l-blue-600 dark:border-l-blue-400',
  HIGH: 'border-l-4 border-l-amber-600 dark:border-l-amber-400',
  URGENT: 'border-l-4 border-l-rose-600 dark:border-l-rose-400',
}

const TODO_PRIORITY_CHIP_CLASSNAMES: Record<TaskPriorityType, string> = {
  LOW: 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/35 dark:bg-emerald-500/20 dark:text-emerald-100',
  MEDIUM: 'border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-400/35 dark:bg-sky-500/20 dark:text-sky-100',
  HIGH: 'border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/25 dark:text-amber-100',
  URGENT: 'border-rose-200 bg-rose-100 text-rose-900 dark:border-rose-400/40 dark:bg-rose-500/25 dark:text-rose-100',
}

const DAY_GROUP_ORDER = ['__overdue', '__today', '__week', '__later', '__nodate']

function getDayGroupLabels(t: TFunction): Record<string, string> {
  return {
    __overdue: t('todo.dayGroupOverdue'),
    __today: t('todo.dayGroupToday'),
    __week: t('todo.dayGroupWeek'),
    __later: t('todo.dayGroupLater'),
    __nodate: t('todo.dayGroupNoDueDate'),
  }
}

function getPriorityLabel(t: TFunction, priority: TaskPriorityType): string {
  switch (priority) {
    case 'LOW':
      return t('task.priorityLow')
    case 'MEDIUM':
      return t('task.priorityMedium')
    case 'HIGH':
      return t('task.priorityHigh')
    case 'URGENT':
      return t('task.priorityUrgent')
    default:
      return priority
  }
}

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

function buildGoalGroups(
  tasks: Task[],
  resolveLabel: (task: Task) => string,
): Map<string, { label: string; tasks: Task[] }> {
  const map = new Map<string, { label: string; tasks: Task[] }>()
  for (const task of tasks) {
    const key = task.goalId ? String(task.goalId) : '__nogoal'
    const label = resolveLabel(task)
    if (!map.has(key)) map.set(key, { label, tasks: [] })
    map.get(key)!.tasks.push(task)
  }
  return map
}

export function TodoPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)
  const queryClient = useQueryClient()
  const openTaskDrawer = useUiStore((s) => s.openTaskDrawer)
  const openTaskDeleteConfirm = useUiStore((s) => s.openTaskDeleteConfirm)
  useProjectRealtime(workspaceId, projectId)
  const { canManageProject, canManageTask, permissionsReady } = useProjectPermissions({
    workspaceId,
    projectId,
    enabled: Number.isFinite(workspaceId) && Number.isFinite(projectId),
  })

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [groupMode, setGroupMode] = useState<GroupMode>('none')
  const [goalFilter, setGoalFilter] = useState<GoalFilterValue>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilterValue>('all')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [taskContextMenu, setTaskContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null)
  const dateLocale = useMemo(
    () => resolveDateLocale(i18n.resolvedLanguage ?? i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  )
  const dayGroupLabels = useMemo(() => getDayGroupLabels(t), [t])

  const selectedDateParam = searchParams.get('todoDate')
  const selectedDate = useMemo(() => parseDateKey(selectedDateParam), [selectedDateParam])
  const selectedDateKey = useMemo(() => (selectedDate ? toDateKey(selectedDate) : null), [selectedDate])
  const isDateFiltered = Boolean(selectedDateKey)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
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

  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.byProject(projectId, 1, 50),
    queryFn: () => goalApi.listByProject(projectId, { page: 1, size: 50 }),
    enabled: Number.isFinite(projectId),
  })

  const daySchedulesQuery = useQuery({
    queryKey: selectedDateKey
      ? queryKeys.schedules.projectCalendar(projectId, selectedDateKey, selectedDateKey, 1, 500)
      : ['task-schedules', 'calendar', 'project', projectId, 'todoDate:none'],
    queryFn: () =>
      taskScheduleApi.projectCalendar(projectId, selectedDateKey!, selectedDateKey!, { page: 1, size: 500 }),
    enabled: Number.isFinite(projectId) && Boolean(selectedDateKey),
  })

  const toggleCompletionMutation = useMutation({
    mutationFn: ({ taskId, isCompleted }: { taskId: number; isCompleted: boolean }) =>
      taskApi.updateCompletion(taskId, isCompleted),
    onMutate: async ({ taskId, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'project', projectId] })

      const snapshot = snapshotProjectTaskQueries(queryClient, projectId)
      patchProjectTaskQueries(queryClient, projectId, (tasks) =>
        applyTaskCompletion(tasks, {
          taskId,
          isCompleted,
          statuses: statusesQuery.data ?? [],
        }),
      )

      return { snapshot }
    },
    onError: (error: Error, _variables, context) => {
      if (context?.snapshot) {
        restoreProjectTaskQueries(queryClient, context.snapshot)
      }
      toast.error(t('task.updateFailed'), { description: error.message })
    },
    onSuccess: (_updatedTask, variables) => {
      if (variables.isCompleted) {
        void playTaskCompleteSound()
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] })
    },
  })

  const reorderMutation = useMutation({
    mutationFn: ({ taskId, targetPosition }: { taskId: number; statusId: number; targetPosition: number }) =>
      taskApi.reorder(taskId, targetPosition),
    onMutate: async ({ taskId, statusId, targetPosition }) => {
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
      toast.error(t('todo.reorderFailed'), { description: error.message })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] })
    },
  })

  function handleDragStart(event: DragStartEvent) {
    setTaskContextMenu(null)
    const task = event.active.data.current?.task as Task | undefined
    if (task) setActiveTask(task)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    if (!canManageProject) {
      toast.error(t('todo.noReorderPermission'))
      return
    }

    const overData = over.data.current
    if (overData?.type === 'task') {
      const overTask = overData.task as Task
      const overIndex = pendingTasks.findIndex((t) => t.id === overTask.id)
      if (overIndex >= 0) {
        const draggedTask = active.data.current?.task as Task
        if (draggedTask) {
          reorderMutation.mutate({
            taskId: draggedTask.id,
            statusId: draggedTask.status.id,
            targetPosition: overIndex,
          })
        }
      }
    }
  }

  if (tasksQuery.isLoading || !permissionsReady) return <LoadingPanel />

  const goalTitleById = new Map((goalsQuery.data?.content ?? []).map((goal) => [goal.id, goal.title] as const))

  const allTasks = tasksQuery.data?.content ?? []
  const filteredTasks = allTasks.filter((task) => {
    const matchesGoal =
      goalFilter === 'all' || (goalFilter === '__nogoal' ? !task.goalId : task.goalId === Number(goalFilter))

    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter

    return matchesGoal && matchesPriority
  })

  const hasActiveFilters = goalFilter !== 'all' || priorityFilter !== 'all'
  const pendingTasks = filteredTasks.filter((t) => !t.isCompleted)
  const completedTasks = filteredTasks.filter((t) => t.isCompleted)

  const daySchedules = daySchedulesQuery.data?.content ?? []
  const dateFilteredEntries: ScheduledTodoEntry[] = []
  if (selectedDateKey) {
    const taskById = new Map(filteredTasks.map((task) => [task.id, task] as const))
    const seenTaskIds = new Set<number>()

    for (const schedule of daySchedules) {
      const task = taskById.get(schedule.taskId)
      if (!task) {
        continue
      }

      seenTaskIds.add(task.id)
      dateFilteredEntries.push({
        scheduleId: schedule.id,
        task,
        scheduledStart: schedule.scheduledStart,
        scheduledEnd: schedule.scheduledEnd,
      })
    }

    for (const task of filteredTasks) {
      if (seenTaskIds.has(task.id) || !task.dueDate) {
        continue
      }

      const dueDate = new Date(task.dueDate)
      if (toDateKey(dueDate) !== selectedDateKey) {
        continue
      }

      dateFilteredEntries.push({
        scheduleId: -task.id,
        task,
        scheduledStart: dueDate.toISOString(),
        scheduledEnd: dueDate.toISOString(),
      })
    }

    dateFilteredEntries.sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())
  }

  const dateFilteredPendingEntries = dateFilteredEntries.filter((entry) => !entry.task.isCompleted)
  const dateFilteredCompletedEntries = dateFilteredEntries.filter((entry) => entry.task.isCompleted)

  const pendingTaskIds = pendingTasks.map((t) => `todo-${t.id}`)

  const dayGroups = groupMode === 'day' ? buildDayGroups(pendingTasks) : null
  const goalGroups =
    groupMode === 'goal'
      ? buildGoalGroups(pendingTasks, (task) => {
          if (task.goalId) {
            return goalTitleById.get(task.goalId) ?? t('task.goalShort', { id: task.goalId })
          }

          return t('task.goalNoneOption')
        })
      : null

  const selectedDateLabel = selectedDate
    ? selectedDate.toLocaleDateString(dateLocale, {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : t('todo.selectDate')

  const setTodoDateFilter = (date: Date | undefined) => {
    const nextParams = new URLSearchParams(searchParams)
    if (date) {
      nextParams.set('todoDate', toDateKey(date))
    } else {
      nextParams.delete('todoDate')
    }
    setSearchParams(nextParams, { replace: false })
    setDatePickerOpen(false)
  }

  const clearTodoDateFilter = () => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('todoDate')
    setSearchParams(nextParams, { replace: false })
  }

  const openTaskPomodoro = (taskId: number) => {
    if (!Number.isFinite(workspaceId) || !Number.isFinite(projectId)) return

    navigate(`/workspaces/${workspaceId}/projects/${projectId}/pomodoro/${taskId}`, {
      state: {
        returnTo: `${location.pathname}${location.search}`,
      },
    })
  }

  const openTaskNotebook = (taskId: number) => {
    if (!Number.isFinite(workspaceId) || !Number.isFinite(projectId)) return

    navigate(`/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/notes`, {
      state: {
        returnTo: `${location.pathname}${location.search}`,
      },
    })
  }

  const handleToggleCompletion = (task: Task, isCompleted: boolean) => {
    if (!canManageTask()) {
      toast.error(t('todo.noManagePermission'))
      return
    }

    toggleCompletionMutation.mutate({ taskId: task.id, isCompleted })
  }

  const openDeleteConfirmIfPermitted = (task: Task) => {
    if (canManageTask()) {
      openTaskDeleteConfirm(task.id)
    }
  }

  const openTaskContextMenu = (event: MouseEvent<HTMLElement>, task: Task) => {
    const x = Math.min(event.clientX, window.innerWidth - 196)
    const y = Math.min(event.clientY, window.innerHeight - 196)
    setTaskContextMenu({ x, y, task })
  }

  return (
    <div className="space-y-5 min-w-0">
      <PageHeader title={t('todo.title')} description={t('todo.pageDescription')} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(['none', 'day', 'goal'] as GroupMode[]).map((mode) => (
            <Button
              key={mode}
              variant={groupMode === mode ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setGroupMode(mode)}
            >
              {mode === 'none' && t('common.all')}
              {mode === 'day' && (
                <>
                  <CalendarIcon className="mr-1 size-3" />
                  {t('todo.groupDay')}
                </>
              )}
              {mode === 'goal' && (
                <>
                  <Target className="mr-1 size-3" />
                  {t('todo.groupGoal')}
                </>
              )}
            </Button>
          ))}
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card/70 px-2 py-1 sm:ml-auto sm:w-auto">
          <Select value={goalFilter} onValueChange={(value) => setGoalFilter(value as GoalFilterValue)}>
            <SelectTrigger className="h-7 w-full min-w-38 text-xs sm:w-40">
              <SelectValue placeholder={t('task.goal')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('todo.allGoals')}</SelectItem>
              <SelectItem value="__nogoal">{t('task.goalNoneOption')}</SelectItem>
              {(goalsQuery.data?.content ?? []).map((goal) => (
                <SelectItem key={goal.id} value={String(goal.id)}>
                  <span className="block max-w-60 truncate" title={goal.title}>
                    {goal.title}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as PriorityFilterValue)}>
            <SelectTrigger className="h-7 w-full min-w-31 text-xs sm:w-33">
              <SelectValue placeholder={t('task.priority')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700 dark:bg-slate-500/20 dark:text-slate-200">
                  {t('todo.allPriorities')}
                </span>
              </SelectItem>
              <SelectItem value="LOW">
                <span className="inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-[11px] text-blue-800 dark:bg-blue-500/20 dark:text-blue-100">
                  {getPriorityLabel(t, 'LOW')}
                </span>
              </SelectItem>
              <SelectItem value="MEDIUM">
                <span className="inline-flex rounded bg-yellow-100 px-1.5 py-0.5 text-[11px] text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-100">
                  {getPriorityLabel(t, 'MEDIUM')}
                </span>
              </SelectItem>
              <SelectItem value="HIGH">
                <span className="inline-flex rounded bg-red-100 px-1.5 py-0.5 text-[11px] text-red-800 dark:bg-red-500/20 dark:text-red-100">
                  {getPriorityLabel(t, 'HIGH')}
                </span>
              </SelectItem>
              <SelectItem value="URGENT">
                <span className="inline-flex rounded bg-fuchsia-100 px-1.5 py-0.5 text-[11px] text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-100">
                  {getPriorityLabel(t, 'URGENT')}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={isDateFiltered ? 'default' : 'outline'}
                size="sm"
                className="h-7 w-full min-w-40 gap-1.5 px-2 text-xs sm:w-auto sm:max-w-46"
              >
                <CalendarIcon className="size-3.5" />
                <span className="truncate">{selectedDateLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <DatePickerCalendar mode="single" selected={selectedDate ?? undefined} onSelect={setTodoDateFilter} />
            </PopoverContent>
          </Popover>

          {isDateFiltered ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={clearTodoDateFilter}
            >
              <X className="size-3" />
              {t('todo.clearDate')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Quick add */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Plus className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTaskTitle.trim() && canManageProject) setTaskDialogOpen(true)
              }}
              placeholder={
                canManageProject ? t('todo.quickCreatePlaceholder') : t('todo.quickCreateDisabledPlaceholder')
              }
              disabled={!canManageProject}
              className="pl-9"
            />
          </div>
          <Button
            onClick={() => setTaskDialogOpen(true)}
            disabled={!newTaskTitle.trim() || !canManageProject}
            size="sm"
          >
            {t('todo.createDetailed')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('todo.quickCreateHint')}</p>
      </div>

      <TaskCreateDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        workspaceId={workspaceId}
        projectId={projectId}
        title={t('todo.createFromTodoTitle')}
        description={t('todo.createFromTodoDescription')}
        submitLabel={t('task.createSubmit')}
        defaultSourceView="TODO"
        defaultStatusId={statusesQuery.data?.[0]?.id ?? null}
        initialValues={{ title: newTaskTitle }}
        onCreated={() => {
          setNewTaskTitle('')
        }}
      />

      {/* Pending tasks */}
      {isDateFiltered ? (
        daySchedulesQuery.isLoading ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('todo.loadingByDate')}
            </CardContent>
          </Card>
        ) : dateFilteredPendingEntries.length === 0 && dateFilteredCompletedEntries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarIcon className="mb-3 size-10 text-muted-foreground/30" />
              <p className="text-sm font-medium">{t('todo.noTasksForDate', { date: selectedDateLabel })}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('todo.tryAnotherDate')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1">
            {dateFilteredPendingEntries.map((entry) => (
              <TodoItem
                key={`todo-date-${entry.scheduleId}-${entry.task.id}`}
                task={entry.task}
                onToggle={() => handleToggleCompletion(entry.task, true)}
                onClick={() => openTaskDrawer(entry.task.id, 'view')}
                onContextAction={(event) => openTaskContextMenu(event, entry.task)}
                onPomodoro={() => openTaskPomodoro(entry.task.id)}
                onNotebook={() => openTaskNotebook(entry.task.id)}
                scheduleLabel={
                  entry.scheduleId > 0
                    ? formatScheduleTimeRangeForLocale(entry.scheduledStart, entry.scheduledEnd, dateLocale)
                    : undefined
                }
              />
            ))}
          </div>
        )
      ) : pendingTasks.length === 0 && completedTasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListTodo className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">{hasActiveFilters ? t('todo.noMatchingTasks') : t('todo.noTasksYet')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasActiveFilters ? t('todo.changeFiltersHint') : t('todo.addFirstTaskHint')}
            </p>
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
                  {dayGroupLabels[key]} ({tasks.length})
                </h3>
                <div className="space-y-1">
                  {tasks.map((task) => (
                    <TodoItem
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggleCompletion(task, true)}
                      onClick={() => openTaskDrawer(task.id, 'view')}
                      onContextAction={(event) => openTaskContextMenu(event, task)}
                      onPomodoro={() => openTaskPomodoro(task.id)}
                      onNotebook={() => openTaskNotebook(task.id)}
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
                    onToggle={() => handleToggleCompletion(task, true)}
                    onClick={() => openTaskDrawer(task.id, 'view')}
                    onContextAction={(event) => openTaskContextMenu(event, task)}
                    onPomodoro={() => openTaskPomodoro(task.id)}
                    onNotebook={() => openTaskNotebook(task.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : hasActiveFilters ? (
        <div className="space-y-1">
          {pendingTasks.map((task) => (
            <TodoItem
              key={task.id}
              task={task}
              onToggle={() => handleToggleCompletion(task, true)}
              onClick={() => openTaskDrawer(task.id, 'view')}
              onContextAction={(event) => openTaskContextMenu(event, task)}
              onPomodoro={() => openTaskPomodoro(task.id)}
              onNotebook={() => openTaskNotebook(task.id)}
            />
          ))}
        </div>
      ) : !canManageProject ? (
        <div className="space-y-1">
          {pendingTasks.map((task) => (
            <TodoItem
              key={task.id}
              task={task}
              onToggle={() => handleToggleCompletion(task, true)}
              onClick={() => openTaskDrawer(task.id, 'view')}
              onContextAction={(event) => openTaskContextMenu(event, task)}
              onPomodoro={() => openTaskPomodoro(task.id)}
              onNotebook={() => openTaskNotebook(task.id)}
            />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={canManageProject ? sensors : []}
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
                  onToggle={() => handleToggleCompletion(task, true)}
                  onClick={() => openTaskDrawer(task.id, 'view')}
                  onContextAction={(event) => openTaskContextMenu(event, task)}
                  onPomodoro={() => openTaskPomodoro(task.id)}
                  onNotebook={() => openTaskNotebook(task.id)}
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
      {(isDateFiltered ? dateFilteredCompletedEntries.length > 0 : completedTasks.length > 0) && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={cn('size-4 transition-transform', !showCompleted && '-rotate-90')} />
            {t('todo.completedSection', {
              count: isDateFiltered ? dateFilteredCompletedEntries.length : completedTasks.length,
            })}
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
                {isDateFiltered
                  ? dateFilteredCompletedEntries.map((entry) => (
                      <TodoItem
                        key={`todo-date-completed-${entry.scheduleId}-${entry.task.id}`}
                        task={entry.task}
                        onToggle={() => handleToggleCompletion(entry.task, false)}
                        onClick={() => openTaskDrawer(entry.task.id, 'view')}
                        onContextAction={(event) => openTaskContextMenu(event, entry.task)}
                        onPomodoro={() => openTaskPomodoro(entry.task.id)}
                        onNotebook={() => openTaskNotebook(entry.task.id)}
                        scheduleLabel={
                          entry.scheduleId > 0
                            ? formatScheduleTimeRangeForLocale(entry.scheduledStart, entry.scheduledEnd, dateLocale)
                            : undefined
                        }
                      />
                    ))
                  : completedTasks.map((task) => (
                      <TodoItem
                        key={task.id}
                        task={task}
                        onToggle={() => handleToggleCompletion(task, false)}
                        onClick={() => openTaskDrawer(task.id, 'view')}
                        onContextAction={(event) => openTaskContextMenu(event, task)}
                        onPomodoro={() => openTaskPomodoro(task.id)}
                        onNotebook={() => openTaskNotebook(task.id)}
                      />
                    ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <TaskContextMenu
        open={Boolean(taskContextMenu)}
        x={taskContextMenu?.x ?? 0}
        y={taskContextMenu?.y ?? 0}
        onClose={() => setTaskContextMenu(null)}
        onDuplicate={() => {
          const selectedTask = taskContextMenu?.task
          if (!selectedTask) {
            return
          }

          if (!canManageTask()) {
            toast.error(t('todo.noManagePermission'))
            return
          }

          openTaskDrawer(selectedTask.id, 'duplicate')
        }}
        onEdit={() => {
          const selectedTask = taskContextMenu?.task
          if (!selectedTask) {
            return
          }

          if (!canManageTask()) {
            toast.error(t('todo.noManagePermission'))
            return
          }

          openTaskDrawer(selectedTask.id, 'edit')
        }}
        onDelete={() => {
          const selectedTask = taskContextMenu?.task
          if (selectedTask) {
            openDeleteConfirmIfPermitted(selectedTask)
          }
        }}
      />
    </div>
  )
}

function SortableTodoItem({
  task,
  onToggle,
  onClick,
  onContextAction,
  onPomodoro,
  onNotebook,
  scheduleLabel,
}: {
  task: Task
  onToggle: () => void
  onClick: () => void
  onContextAction: (event: MouseEvent<HTMLElement>) => void
  onPomodoro: () => void
  onNotebook: () => void
  scheduleLabel?: string
}) {
  const { t, i18n } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `todo-${task.id}`,
    data: { type: 'task', task },
  })
  const dateLocale = resolveDateLocale(i18n.resolvedLanguage ?? i18n.language)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-3 rounded-lg border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm sm:items-center sm:py-3 sm:pr-4 sm:pl-3',
        TODO_PRIORITY_BORDER_CLASSNAMES[task.priority],
        task.isCompleted && 'opacity-60',
        isDragging && 'opacity-40 shadow-lg ring-2 ring-primary/20',
      )}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onContextAction(event)
      }}
    >
      <div className="flex shrink-0 items-center gap-2 self-start pt-0.5 sm:self-auto sm:pt-0">
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab text-muted-foreground/30 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
        >
          {task.isCompleted ? <CheckCircle2 className="size-5 text-primary" /> : <Circle className="size-5" />}
        </button>
      </div>

      {/* Mobile-optimized structure */}
      <div className="min-w-0 flex-1 cursor-pointer sm:hidden" onClick={onClick}>
        <div className="flex flex-col gap-1 w-full">
          <p className={cn('line-clamp-2 text-sm font-semibold text-foreground leading-snug', task.isCompleted && 'line-through text-muted-foreground')}>
            {task.title}
          </p>
          
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span
              className={cn(
                'inline-flex h-5 items-center justify-center rounded px-2 text-[9px] font-bold uppercase tracking-wider',
                TODO_PRIORITY_CHIP_CLASSNAMES[task.priority],
              )}
            >
              {getPriorityLabel(t, task.priority)}
            </span>
            
            {task.dueDate && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100/70 dark:bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground border border-border/40">
                <Clock3 className="size-2.5" />
                {formatDisplayDate(task.dueDate, dateLocale)}
              </span>
            )}
            
            {scheduleLabel && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100/70 dark:bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground border border-border/40">
                <Clock3 className="size-2.5" />
                {scheduleLabel}
              </span>
            )}

            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-100/70 hover:bg-slate-200/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 text-muted-foreground border border-border/40"
              onClick={(e) => {
                e.stopPropagation()
                onNotebook()
              }}
              aria-label={t('task.openNotesButton')}
            >
              <NotebookText className="size-3" />
            </button>

            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-100/70 hover:bg-slate-200/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 text-muted-foreground border border-border/40"
              onClick={(e) => {
                e.stopPropagation()
                onPomodoro()
              }}
              aria-label={t('task.pomodoroTitle')}
            >
              <Timer className="size-3" />
            </button>
          </div>
          <TaskBlockerBadge task={task} compact className="mt-1" />
        </div>
      </div>

      {/* Desktop-optimized structure */}
      <div className="hidden min-w-0 flex-1 cursor-pointer sm:block" onClick={onClick}>
        <p className={cn('line-clamp-1 text-sm font-medium', task.isCompleted && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
        {scheduleLabel && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock3 className="size-3" />
            {scheduleLabel}
          </p>
        )}
        {task.dueDate && (
          <p className="mt-0.5 text-xs text-muted-foreground">{formatDisplayDate(task.dueDate, dateLocale)}</p>
        )}
        <TaskBlockerBadge task={task} compact className="mt-2" />
      </div>

      <div className="hidden sm:block shrink-0">
        <TodoRowMetaActions
          priority={task.priority}
          assigneeName={task.assignee?.firstName}
          onPomodoro={onPomodoro}
          onNotebook={onNotebook}
        />
      </div>
    </div>
  )
}

function TodoItem({
  task,
  onToggle,
  onClick,
  onContextAction,
  onPomodoro,
  onNotebook,
  scheduleLabel,
}: {
  task: Task
  onToggle: () => void
  onClick: () => void
  onContextAction: (event: MouseEvent<HTMLElement>) => void
  onPomodoro: () => void
  onNotebook: () => void
  scheduleLabel?: string
}) {
  const { t, i18n } = useTranslation()
  const dateLocale = resolveDateLocale(i18n.resolvedLanguage ?? i18n.language)

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm sm:items-center sm:py-3 sm:pr-4 sm:pl-3',
        TODO_PRIORITY_BORDER_CLASSNAMES[task.priority],
        task.isCompleted && 'opacity-60',
      )}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onContextAction(event)
      }}
    >
      <div className="flex shrink-0 items-center pt-0.5 sm:pt-0">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
        >
          {task.isCompleted ? <CheckCircle2 className="size-5 text-primary" /> : <Circle className="size-5" />}
        </button>
      </div>

      {/* Mobile-optimized structure */}
      <div className="min-w-0 flex-1 cursor-pointer sm:hidden" onClick={onClick}>
        <div className="flex flex-col gap-1 w-full">
          <p className={cn('line-clamp-2 text-sm font-semibold text-foreground leading-snug', task.isCompleted && 'line-through text-muted-foreground')}>
            {task.title}
          </p>
          
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span
              className={cn(
                'inline-flex h-5 items-center justify-center rounded px-2 text-[9px] font-bold uppercase tracking-wider',
                TODO_PRIORITY_CHIP_CLASSNAMES[task.priority],
              )}
            >
              {getPriorityLabel(t, task.priority)}
            </span>
            
            {task.dueDate && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100/70 dark:bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground border border-border/40">
                <Clock3 className="size-2.5" />
                {formatDisplayDate(task.dueDate, dateLocale)}
              </span>
            )}
            
            {scheduleLabel && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100/70 dark:bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground border border-border/40">
                <Clock3 className="size-2.5" />
                {scheduleLabel}
              </span>
            )}

            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-100/70 hover:bg-slate-200/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 text-muted-foreground border border-border/40"
              onClick={(e) => {
                e.stopPropagation()
                onNotebook()
              }}
              aria-label={t('task.openNotesButton')}
            >
              <NotebookText className="size-3" />
            </button>

            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-100/70 hover:bg-slate-200/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 text-muted-foreground border border-border/40"
              onClick={(e) => {
                e.stopPropagation()
                onPomodoro()
              }}
              aria-label={t('task.pomodoroTitle')}
            >
              <Timer className="size-3" />
            </button>
          </div>

          {task.description && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground bg-slate-50/50 dark:bg-zinc-950/20 px-1.5 py-0.5 rounded border border-border/30 w-fit">
              {task.description}
            </p>
          )}

          <TaskBlockerBadge task={task} compact className="mt-1" />
        </div>
      </div>

      {/* Desktop-optimized structure */}
      <div className="hidden min-w-0 flex-1 cursor-pointer sm:block" onClick={onClick}>
        <p className={cn('line-clamp-1 text-sm font-medium', task.isCompleted && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
        {scheduleLabel && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock3 className="size-3" />
            {scheduleLabel}
          </p>
        )}
        {task.dueDate && (
          <p className="mt-0.5 text-xs text-muted-foreground">{formatDisplayDate(task.dueDate, dateLocale)}</p>
        )}
        {task.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{task.description}</p>}
        <TaskBlockerBadge task={task} compact className="mt-2" />
      </div>

      <div className="hidden sm:block shrink-0">
        <TodoRowMetaActions
          priority={task.priority}
          assigneeName={task.assignee?.firstName}
          onPomodoro={onPomodoro}
          onNotebook={onNotebook}
        />
      </div>
    </div>
  )
}

function TodoRowMetaActions({
  priority,
  assigneeName,
  onPomodoro,
  onNotebook,
}: {
  priority: TaskPriorityType
  assigneeName?: string
  onPomodoro: () => void
  onNotebook: () => void
}) {
  const { t } = useTranslation()
  const resolvedAssigneeName = assigneeName ?? t('task.assigneeNone')

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:grid sm:grid-cols-[auto_minmax(5.5rem,7rem)_1.75rem_1.75rem] sm:items-center sm:gap-2">
      <span
        className={cn(
          'inline-flex h-5 min-w-18 items-center justify-center rounded border px-2 text-[10px] font-semibold uppercase tracking-wide',
          TODO_PRIORITY_CHIP_CLASSNAMES[priority],
        )}
      >
        {getPriorityLabel(t, priority)}
      </span>
      <span
        className={cn(
          'hidden truncate text-right text-[10px] sm:block',
          assigneeName ? 'text-muted-foreground' : 'text-muted-foreground/70',
        )}
        title={resolvedAssigneeName}
      >
        {resolvedAssigneeName}
      </span>
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation()
          onNotebook()
        }}
        aria-label={t('task.openNotesButton')}
      >
        <NotebookText className="size-3.5" />
      </button>
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation()
          onPomodoro()
        }}
        aria-label={t('task.pomodoroTitle')}
      >
        <Timer className="size-3.5" />
      </button>
    </div>
  )
}
