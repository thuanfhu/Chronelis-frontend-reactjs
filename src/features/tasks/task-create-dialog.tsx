import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlignLeft, Calendar, CalendarClock, Clock3, Flag, Loader2, Rows3, Shapes, Target, User, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/app/store/auth-store'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelectPopover } from '@/components/shared/searchable-select-popover'
import { goalApi } from '@/lib/api/modules/goal-api'
import { queryKeys } from '@/lib/api/query-keys'
import { taskApi } from '@/lib/api/modules/task-api'
import { taskScheduleApi } from '@/lib/api/modules/task-schedule-api'
import { taskStatusApi } from '@/lib/api/modules/task-status-api'
import { taskTypeApi } from '@/lib/api/modules/task-type-api'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { resolveTaskTypeIcon } from '@/lib/task-types/task-type-icons'
import {
  clearOptimisticTaskCreateDiscarded,
  isOptimisticTaskCreateDiscarded,
  patchProjectCalendarQueries,
  patchProjectTaskQueries,
  patchTaskScheduleQueries,
  removeById,
  removeOptimisticSchedulesForTask,
  restoreProjectCalendarQueries,
  restoreProjectTaskQueries,
  restoreTaskScheduleQueries,
  snapshotProjectCalendarQueries,
  snapshotProjectTaskQueries,
  snapshotTaskScheduleQueries,
  upsertById,
} from '@/lib/tasks/optimistic-task-cache'
import { cn } from '@/lib/utils/cn'
import { toLocalDateTimePayload, isAfter } from '@/lib/utils/datetime'
import type { SourceViewType, Task, TaskPriorityType, TaskSchedule, UserSummary } from '@/types/domain'

const PRIORITY_OPTIONS: Array<{
  value: TaskPriorityType
  labelKey: string
  className: string
}> = [
  {
    value: 'LOW',
    labelKey: 'task.priorityLow',
    className:
      'border-slate-300 text-slate-700 data-[active=true]:border-slate-600 data-[active=true]:bg-slate-600 data-[active=true]:text-white dark:border-slate-600 dark:text-slate-200',
  },
  {
    value: 'MEDIUM',
    labelKey: 'task.priorityMedium',
    className:
      'border-sky-300 text-sky-700 data-[active=true]:border-sky-500 data-[active=true]:bg-sky-500 data-[active=true]:text-white dark:border-sky-500/40 dark:text-sky-200',
  },
  {
    value: 'HIGH',
    labelKey: 'task.priorityHigh',
    className:
      'border-amber-300 text-amber-700 data-[active=true]:border-amber-500 data-[active=true]:bg-amber-500 data-[active=true]:text-white dark:border-amber-500/40 dark:text-amber-200',
  },
  {
    value: 'URGENT',
    labelKey: 'task.priorityUrgent',
    className:
      'border-rose-300 text-rose-700 data-[active=true]:border-rose-500 data-[active=true]:bg-rose-500 data-[active=true]:text-white dark:border-rose-500/40 dark:text-rose-200',
  },
]

const SOURCE_VIEW_LABELS: Record<SourceViewType, string> = {
  KANBAN: 'task.sourceKanban',
  TODO: 'task.sourceTodo',
  CALENDAR: 'task.sourceCalendar',
}

interface TaskCreateDialogInitialValues {
  title?: string
  description?: string
  statusId?: number | null
  priority?: TaskPriorityType
  goalId?: number | null
  assigneeId?: string | null
  dueDate?: string
  estimatedMinutes?: number | null
  taskTypeId?: number | null
  scheduleStart?: string
  scheduleEnd?: string
  blockerNote?: string
  dependencyTaskIds?: number[]
}

interface TaskCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: number
  projectId: number
  title?: string
  description?: string
  submitLabel?: string
  defaultSourceView?: SourceViewType
  defaultStatusId?: number | null
  requireSchedule?: boolean
  initialValues?: TaskCreateDialogInitialValues
  onCreated?: (task: Task) => void | Promise<void>
}

interface TaskCreateFormState {
  title: string
  description: string
  statusId: number | null
  priority: TaskPriorityType
  goalId: number | null
  assigneeId: string | null
  dueDate: string
  estimatedMinutes: string
  taskTypeId: number | null
  scheduleStart: string
  scheduleEnd: string
  blockerNote: string
  dependencyTaskIds: number[]
}

interface TaskCreateOptimisticContext {
  optimisticTaskId: number
  optimisticScheduleId?: number
  projectTasksSnapshot: ReturnType<typeof snapshotProjectTaskQueries>
  projectCalendarSnapshot: ReturnType<typeof snapshotProjectCalendarQueries>
  taskScheduleSnapshot: ReturnType<typeof snapshotTaskScheduleQueries>
}

interface CreateTaskResult {
  task: Task
  schedule?: TaskSchedule
  scheduleError?: string
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function buildInitialFormState(args: {
  initialValues?: TaskCreateDialogInitialValues
  defaultStatusId?: number | null
}): TaskCreateFormState {
  const { initialValues, defaultStatusId } = args

  return {
    title: initialValues?.title ?? '',
    description: initialValues?.description ?? '',
    statusId: initialValues?.statusId ?? defaultStatusId ?? null,
    priority: initialValues?.priority ?? 'MEDIUM',
    goalId: initialValues?.goalId ?? null,
    assigneeId: initialValues?.assigneeId ?? null,
    dueDate: initialValues?.dueDate ?? '',
    estimatedMinutes: initialValues?.estimatedMinutes != null ? String(initialValues.estimatedMinutes) : '',
    taskTypeId: initialValues?.taskTypeId ?? null,
    scheduleStart: initialValues?.scheduleStart ?? '',
    scheduleEnd: initialValues?.scheduleEnd ?? '',
    blockerNote: initialValues?.blockerNote ?? '',
    dependencyTaskIds: initialValues?.dependencyTaskIds ?? [],
  }
}

export function TaskCreateDialog({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  title,
  description,
  submitLabel,
  defaultSourceView = 'KANBAN',
  defaultStatusId = null,
  requireSchedule = false,
  initialValues,
  onCreated,
}: TaskCreateDialogProps) {
  const { t } = useTranslation()
  const resolvedTitle = title ?? t('task.createTitle')
  const resolvedDescription = description ?? t('task.createDescription')
  const resolvedSubmitLabel = submitLabel ?? t('task.createSubmit')
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.currentUser)
  const [form, setForm] = useState<TaskCreateFormState>(() => buildInitialFormState({ initialValues, defaultStatusId }))

  const queryEnabled = open && Number.isFinite(projectId) && Number.isFinite(workspaceId)

  const statusesQuery = useQuery({
    queryKey: queryKeys.statuses.byProject(projectId),
    queryFn: () => taskStatusApi.listByProject(projectId),
    enabled: queryEnabled,
    staleTime: 60_000,
  })

  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.byProject(projectId, 1, 100),
    queryFn: () => goalApi.listByProject(projectId, { page: 1, size: 100 }),
    enabled: queryEnabled,
    staleTime: 60_000,
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId),
    queryFn: () => workspaceApi.members(workspaceId),
    enabled: queryEnabled,
    staleTime: 60_000,
  })

  const taskTypesQuery = useQuery({
    queryKey: queryKeys.taskTypes.byProject(projectId),
    queryFn: () => taskTypeApi.listByProject(projectId),
    enabled: queryEnabled,
    staleTime: 60_000,
  })

  const projectTasksQuery = useQuery({
    queryKey: queryKeys.tasks.byProject(projectId, 1, 500),
    queryFn: () => taskApi.listByProject(projectId, { page: 1, size: 500 }),
    enabled: queryEnabled,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!open) {
      return
    }

    setForm(
      buildInitialFormState({
        initialValues,
        defaultStatusId: initialValues?.statusId ?? defaultStatusId,
      }),
    )
  }, [defaultStatusId, initialValues, open])

  useEffect(() => {
    if (!open || form.statusId != null) {
      return
    }

    const fallbackStatusId = defaultStatusId ?? statusesQuery.data?.[0]?.id ?? null
    if (fallbackStatusId != null) {
      setForm((current) => ({ ...current, statusId: fallbackStatusId }))
    }
  }, [defaultStatusId, form.statusId, open, statusesQuery.data])

  const assigneeOptions = useMemo(
    () => [
      {
        value: '__unassigned',
        label: t('task.assigneeNone'),
        description: t('task.assigneeNoneDesc'),
        searchText: 'unassigned none',
      },
      ...(membersQuery.data ?? []).map((member) => ({
        value: member.user.userId,
        label: `${member.user.firstName} ${member.user.lastName}`,
        description: `${member.user.email} • ${member.role}`,
        searchText: `${member.user.email} ${member.user.firstName} ${member.user.lastName} ${member.role}`,
        prefix: (
          <Avatar className="size-6">
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
              {member.user.firstName.charAt(0)}
              {member.user.lastName.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ),
      })),
    ],
    [membersQuery.data, t],
  )

  const dependencyOptions = useMemo(
    () =>
      (projectTasksQuery.data?.content ?? [])
        .filter((task) => !form.dependencyTaskIds.includes(task.id))
        .map((task) => ({
          value: String(task.id),
          label: task.title,
          description: `${task.status.name} • ${task.priority}${task.goalId ? ` • ${t('task.goalShort', { id: task.goalId })}` : ''}`,
          searchText: `${task.description ?? ''} ${task.priority} ${task.status.name}`,
          statusName: task.status.name,
          priority: task.priority,
          goalId: task.goalId,
        })),
    [projectTasksQuery.data?.content, t, form.dependencyTaskIds],
  )

  const selectedDependencyTasks = useMemo(() => {
    const taskById = new Map((projectTasksQuery.data?.content ?? []).map((task) => [task.id, task] as const))
    return form.dependencyTaskIds.map((taskId) => taskById.get(taskId)).filter((task): task is Task => Boolean(task))
  }, [form.dependencyTaskIds, projectTasksQuery.data?.content])

  const createTaskMutation = useMutation<CreateTaskResult, Error, void, TaskCreateOptimisticContext | undefined>({
    mutationFn: async () => {
      const titleValue = form.title.trim()
      if (!titleValue) {
        throw new Error(t('task.titleRequired'))
      }

      if (!form.statusId) {
        throw new Error(t('task.statusError'))
      }

      const estimatedMinutes = form.estimatedMinutes.trim() ? Number(form.estimatedMinutes) : undefined

      if (estimatedMinutes != null && (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 0)) {
        throw new Error(t('task.estimatedError'))
      }

      if (requireSchedule && (!form.scheduleStart || !form.scheduleEnd)) {
        throw new Error(t('task.scheduleRequiredError'))
      }

      if ((form.scheduleStart && !form.scheduleEnd) || (!form.scheduleStart && form.scheduleEnd)) {
        throw new Error(t('task.scheduleBothError'))
      }

      if (form.scheduleStart && form.scheduleEnd) {
        const startDate = new Date(form.scheduleStart)
        const endDate = new Date(form.scheduleEnd)
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
          throw new Error(t('task.scheduleOrderError'))
        }
      }

      let createdTask: Task
      let createdSchedule: TaskSchedule | undefined
      let scheduleError: string | undefined

      createdTask = await taskApi.create({
        projectId,
        title: titleValue,
        description: form.description.trim() || undefined,
        statusId: form.statusId,
        priority: form.priority,
        goalId: form.goalId ?? undefined,
        dueDate: form.dueDate ? toLocalDateTimePayload(form.dueDate) : undefined,
        estimatedMinutes,
        taskTypeId: form.taskTypeId ?? undefined,
        sourceView: defaultSourceView,
      })

      if (form.assigneeId) {
        createdTask = await taskApi.assign(createdTask.id, form.assigneeId)
      }

      if (form.scheduleStart && form.scheduleEnd) {
        try {
          createdSchedule = await taskScheduleApi.create({
            taskId: createdTask.id,
            scheduledStart: toLocalDateTimePayload(form.scheduleStart),
            scheduledEnd: toLocalDateTimePayload(form.scheduleEnd),
          })
        } catch (error) {
          scheduleError = getErrorMessage(error)
        }
      }

      if (form.dependencyTaskIds.length > 0 || form.blockerNote.trim()) {
        await taskApi.updateDependencies(createdTask.id, {
          dependencyTaskIds: form.dependencyTaskIds,
          blockerNote: form.blockerNote.trim() || undefined,
        })
      }

      return { task: createdTask, schedule: createdSchedule, scheduleError }
    },
    onMutate: async () => {
      const titleValue = form.title.trim()
      const selectedStatus = statusesQuery.data?.find((status) => status.id === form.statusId)
      const estimatedMinutes = form.estimatedMinutes.trim() ? Number(form.estimatedMinutes) : undefined

      if (!titleValue || !form.statusId || !selectedStatus) {
        return undefined
      }

      if (estimatedMinutes != null && (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 0)) {
        return undefined
      }

      if (requireSchedule && (!form.scheduleStart || !form.scheduleEnd)) {
        return undefined
      }

      if ((form.scheduleStart && !form.scheduleEnd) || (!form.scheduleStart && form.scheduleEnd)) {
        return undefined
      }

      if (form.scheduleStart && form.scheduleEnd) {
        const startDate = new Date(form.scheduleStart)
        const endDate = new Date(form.scheduleEnd)
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
          return undefined
        }
      }

      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['tasks', 'project', projectId] }),
        queryClient.cancelQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] }),
      ])

      const nowIso = new Date().toISOString()
      const optimisticTaskId = -Date.now()
      const optimisticScheduleId = optimisticTaskId - 1
      const projectTasksSnapshot = snapshotProjectTaskQueries(queryClient, projectId)
      const projectCalendarSnapshot = snapshotProjectCalendarQueries(queryClient, projectId)
      const taskScheduleSnapshot = snapshotTaskScheduleQueries(queryClient, optimisticTaskId)
      const cachedProjectTasks = projectTasksQuery.data?.content ?? []
      const assignee = form.assigneeId
        ? membersQuery.data?.find((member) => member.user.userId === form.assigneeId)?.user
        : undefined
      const createdBy: UserSummary = currentUser
        ? {
            userId: currentUser.userId,
            email: currentUser.email,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
          }
        : {
            userId: '',
            email: '',
            firstName: '',
            lastName: '',
          }

      const optimisticTask: Task = {
        id: optimisticTaskId,
        workspaceId,
        projectId,
        goalId: form.goalId ?? undefined,
        status: selectedStatus,
        title: titleValue,
        description: form.description.trim() || undefined,
        priority: form.priority,
        taskType: taskTypesQuery.data?.find((taskType) => taskType.id === form.taskTypeId),
        sourceView: defaultSourceView,
        assignee,
        createdBy,
        dueDate: form.dueDate ? toLocalDateTimePayload(form.dueDate) : undefined,
        estimatedMinutes: estimatedMinutes ?? 0,
        boardPosition:
          Math.max(
            -1,
            ...cachedProjectTasks
              .filter((task) => task.status.id === selectedStatus.id)
              .map((task) => task.boardPosition),
          ) + 1,
        isCompleted: Boolean(selectedStatus.isClosed),
        completedAt: selectedStatus.isClosed ? nowIso : undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      }

      patchProjectTaskQueries(queryClient, projectId, (tasks) => upsertById(tasks, optimisticTask))
      queryClient.setQueryData(queryKeys.tasks.detail(optimisticTaskId), optimisticTask)

      if (form.scheduleStart && form.scheduleEnd) {
        const scheduledStart = toLocalDateTimePayload(form.scheduleStart)
        const scheduledEnd = toLocalDateTimePayload(form.scheduleEnd)
        const optimisticSchedule: TaskSchedule = {
          id: optimisticScheduleId,
          taskId: optimisticTaskId,
          scheduledStart,
          scheduledEnd,
          scheduledDate: scheduledStart.slice(0, 10),
          createdBy,
          createdAt: nowIso,
          updatedAt: nowIso,
        }

        patchProjectCalendarQueries(queryClient, projectId, (schedules) => upsertById(schedules, optimisticSchedule))
        patchTaskScheduleQueries(queryClient, optimisticTaskId, (schedules) => upsertById(schedules, optimisticSchedule))
      }

      onOpenChange(false)

      return {
        optimisticTaskId,
        optimisticScheduleId: form.scheduleStart && form.scheduleEnd ? optimisticScheduleId : undefined,
        projectTasksSnapshot,
        projectCalendarSnapshot,
        taskScheduleSnapshot,
      }
    },
    onSuccess: async (result, _variables, context) => {
      const createdTask = result.task
      const createdSchedule = result.schedule
      const scheduleError = result.scheduleError

      if (
        context?.optimisticTaskId != null &&
        isOptimisticTaskCreateDiscarded(queryClient, context.optimisticTaskId)
      ) {
        queryClient.setQueryData(queryKeys.tasks.detail(context.optimisticTaskId), undefined)
        queryClient.setQueryData(queryKeys.tasks.detail(createdTask.id), undefined)
        patchProjectTaskQueries(queryClient, projectId, (tasks) =>
          tasks.filter((task) => task.id !== context.optimisticTaskId && task.id !== createdTask.id),
        )
        patchProjectCalendarQueries(queryClient, projectId, (schedules) =>
          schedules.filter(
            (schedule) =>
              schedule.id !== context.optimisticScheduleId &&
              schedule.taskId !== context.optimisticTaskId &&
              schedule.taskId !== createdTask.id,
          ),
        )
        clearOptimisticTaskCreateDiscarded(queryClient, context.optimisticTaskId)

        try {
          await taskApi.remove(createdTask.id)
        } catch {
          // The user already removed the optimistic item locally; a later refetch/realtime event will reconcile.
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.myWork }),
          queryClient.invalidateQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTask(createdTask.id) }),
        ])
        return
      }

      queryClient.setQueryData(queryKeys.tasks.detail(createdTask.id), createdTask)

      if (context?.optimisticTaskId) {
        patchProjectTaskQueries(queryClient, projectId, (tasks) => {
          const replacedTasks = tasks.map((task) => (task.id === context.optimisticTaskId ? createdTask : task))
          const dedupedTasks = replacedTasks.filter(
            (task, index, allTasks) => allTasks.findIndex((item) => item.id === task.id) === index,
          )
          return dedupedTasks.some((task) => task.id === createdTask.id) ? dedupedTasks : [...dedupedTasks, createdTask]
        })

        if (context.optimisticScheduleId != null) {
          patchProjectCalendarQueries(queryClient, projectId, (schedules) => {
            const withoutOptimistic = removeOptimisticSchedulesForTask(
              removeById(schedules, context.optimisticScheduleId!),
              context.optimisticTaskId,
            )
            return createdSchedule ? upsertById(withoutOptimistic, createdSchedule) : withoutOptimistic
          })

          queryClient.setQueryData(queryKeys.schedules.byTask(context.optimisticTaskId), [])

          if (createdSchedule) {
            patchTaskScheduleQueries(queryClient, createdTask.id, (schedules) => upsertById(schedules, createdSchedule))
          }
        }
      } else if (createdSchedule) {
        patchProjectCalendarQueries(queryClient, projectId, (schedules) => upsertById(schedules, createdSchedule))
        patchTaskScheduleQueries(queryClient, createdTask.id, (schedules) => upsertById(schedules, createdSchedule))
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.myWork }),
        queryClient.invalidateQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTask(createdTask.id) }),
      ])

      if (onCreated) {
        await onCreated(createdTask)
      }

      if (scheduleError) {
        toast.error(t('calendar.updateScheduleFailed'), { description: scheduleError })
      } else {
        toast.success(t('task.createSuccess'))
      }
      onOpenChange(false)
    },
    onError: (error: Error, _variables, context) => {
      if (
        context?.optimisticTaskId != null &&
        isOptimisticTaskCreateDiscarded(queryClient, context.optimisticTaskId)
      ) {
        clearOptimisticTaskCreateDiscarded(queryClient, context.optimisticTaskId)
        return
      }

      if (context?.projectTasksSnapshot) {
        restoreProjectTaskQueries(queryClient, context.projectTasksSnapshot)
      }
      if (context?.projectCalendarSnapshot) {
        restoreProjectCalendarQueries(queryClient, context.projectCalendarSnapshot)
      }
      if (context?.taskScheduleSnapshot) {
        restoreTaskScheduleQueries(queryClient, context.taskScheduleSnapshot)
      }

      toast.error(t('task.createError'), { description: error.message })
    },
  })

  const statusOptions = statusesQuery.data ?? []
  const goals = goalsQuery.data?.content ?? []
  const taskTypes = taskTypesQuery.data ?? []
  const canSubmit = !createTaskMutation.isPending && form.title.trim().length > 0 && Boolean(form.statusId)

  const [activeTab, setActiveTab] = useState<'basic' | 'schedule' | 'dependency'>('basic')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(720px,92vh)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
              <AlignLeft className="size-4 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base">{resolvedTitle}</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs leading-5">{resolvedDescription}</DialogDescription>
            </div>
            <span className="rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {t(SOURCE_VIEW_LABELS[defaultSourceView])}
            </span>
          </div>
        </DialogHeader>

        {/* Tab navigation */}
        <div className="flex shrink-0 gap-1 border-b border-border/60 px-6">
          {[
            { key: 'basic' as const, label: t('task.basicTab') },
            { key: 'schedule' as const, label: t('task.scheduleTab') },
            { key: 'dependency' as const, label: t('task.dependencyTab') },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={cn(
                'relative px-3 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80',
              )}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5">
            {/* ── Tab: Basic Info ── */}
            {activeTab === 'basic' && (
              <div className="space-y-5">
                {/* Title */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    {t('task.title')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder={t('task.titlePlaceholder')}
                    className="h-10 text-sm"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">{t('task.description')}</Label>
                  <Textarea
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder={t('task.descriptionPlaceholder')}
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <Flag className="size-3.5 text-muted-foreground" /> {t('task.priority')}
                  </Label>
                  <div className="flex gap-2">
                    {PRIORITY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        data-active={form.priority === option.value}
                        className={cn(
                          'h-8 flex-1 rounded-lg border text-sm font-semibold transition-all',
                          option.className,
                        )}
                        onClick={() => setForm((current) => ({ ...current, priority: option.value }))}
                      >
                        {t(option.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2-column row: Status + Goal */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Rows3 className="size-3.5 text-muted-foreground" /> {t('task.status')}
                    </Label>
                    <Select
                      value={form.statusId != null ? String(form.statusId) : undefined}
                      onValueChange={(value) => setForm((current) => ({ ...current, statusId: Number(value) }))}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue
                          placeholder={statusesQuery.isLoading ? t('common.loading') : t('task.statusPlaceholder')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status.id} value={String(status.id)}>
                            {status.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Target className="size-3.5 text-muted-foreground" /> {t('task.goal')}
                    </Label>
                    <Select
                      value={form.goalId != null ? String(form.goalId) : '__none'}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, goalId: value === '__none' ? null : Number(value) }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={t('task.goalNone')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">{t('task.goalNone')}</SelectItem>
                        {goals.map((goal) => (
                          <SelectItem key={goal.id} value={String(goal.id)}>
                            <span className="block max-w-52 truncate" title={goal.title}>
                              {goal.title}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Divider with section label */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('task.assignment')}
                  </span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>

                {/* Assignee */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <User className="size-3.5 text-muted-foreground" /> {t('task.assignee')}
                  </Label>
                  <SearchableSelectPopover
                    value={form.assigneeId ?? '__unassigned'}
                    options={assigneeOptions}
                    placeholder={membersQuery.isLoading ? t('common.loading') : t('task.assigneePlaceholder')}
                    searchPlaceholder={t('task.assigneeSearch')}
                    emptyLabel={t('task.assigneeEmpty')}
                    disabled={membersQuery.isLoading || membersQuery.isError}
                    triggerClassName="h-9"
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, assigneeId: value === '__unassigned' ? null : value }))
                    }
                  />
                </div>

                {/* 3-column row: Deadline + Estimated + Task Type */}
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Calendar className="size-3.5 text-muted-foreground" /> {t('task.deadline')}
                    </Label>
                    <Input
                      type="datetime-local"
                      step={900}
                      value={form.dueDate}
                      onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Clock3 className="size-3.5 text-muted-foreground" /> {t('task.estimated')}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step={15}
                      inputMode="numeric"
                      value={form.estimatedMinutes}
                      onChange={(event) => setForm((current) => ({ ...current, estimatedMinutes: event.target.value }))}
                      placeholder={t('task.estimatedPlaceholder')}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Shapes className="size-3.5 text-muted-foreground" /> {t('task.taskType')}
                    </Label>
                    <Select
                      value={form.taskTypeId != null ? String(form.taskTypeId) : '__none'}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, taskTypeId: value === '__none' ? null : Number(value) }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={t('task.taskTypeNone')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">{t('task.taskTypeNone')}</SelectItem>
                        {taskTypes.map((taskType) => {
                          const TaskTypeIcon = resolveTaskTypeIcon(taskType.icon)
                          return (
                            <SelectItem key={taskType.id} value={String(taskType.id)}>
                              <span className="flex items-center gap-1.5">
                                <TaskTypeIcon
                                  className="size-3.5"
                                  style={taskType.color ? { color: taskType.color } : undefined}
                                />
                                <span>{taskType.name}</span>
                              </span>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Schedule ── */}
            {activeTab === 'schedule' && (
              <div className="space-y-5">
                <div className="rounded-xl border border-sky-200/50 bg-sky-50/50 p-4 dark:border-sky-800/40 dark:bg-sky-950/20">
                  <div className="flex items-start gap-3">
                    <CalendarClock className="mt-0.5 size-5 text-sky-600 dark:text-sky-400" />
                    <div>
                      <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">{t('task.scheduleTitle')}</p>
                      <p className="mt-0.5 text-xs leading-5 text-sky-700/80 dark:text-sky-300/80">
                        {requireSchedule ? t('task.scheduleRequired') : t('task.scheduleOptional')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('task.scheduleStart')}</Label>
                    <Input
                      type="datetime-local"
                      step={900}
                      value={form.scheduleStart}
                      onChange={(event) => setForm((current) => ({ ...current, scheduleStart: event.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('task.scheduleEnd')}</Label>
                    <Input
                      type="datetime-local"
                      step={900}
                      value={form.scheduleEnd}
                      onChange={(event) => setForm((current) => ({ ...current, scheduleEnd: event.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {form.scheduleStart && form.scheduleEnd && !isAfter(form.scheduleEnd, form.scheduleStart) && (
                  <p className="text-xs text-destructive">{t('task.scheduleEndValidation')}</p>
                )}
                {form.scheduleStart && form.scheduleEnd && isAfter(form.scheduleEnd, form.scheduleStart) && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-200">
                    &#10003; {t('task.scheduleSet')}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Dependency ── */}
            {activeTab === 'dependency' && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">{t('task.dependencyTitle')}</Label>
                  <SearchableSelectPopover
                    value={undefined}
                    options={dependencyOptions}
                    placeholder={projectTasksQuery.isLoading ? t('common.loading') : t('task.dependencySearch')}
                    searchPlaceholder={t('task.dependencySearchPlaceholder')}
                    emptyLabel={t('task.dependencyEmpty')}
                    disabled={projectTasksQuery.isLoading || projectTasksQuery.isError}
                    triggerClassName="h-9"
                    onValueChange={(value) => {
                      const nextDependencyId = Number(value)
                      if (!Number.isFinite(nextDependencyId)) return
                      setForm((current) => ({
                        ...current,
                        dependencyTaskIds: current.dependencyTaskIds.includes(nextDependencyId)
                          ? current.dependencyTaskIds
                          : [...current.dependencyTaskIds, nextDependencyId],
                      }))
                    }}
                  />
                </div>

                {selectedDependencyTasks.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {t('task.dependencySelected', { count: selectedDependencyTasks.length })}
                    </p>
                    <div className="grid gap-2">
                      {selectedDependencyTasks.map((task) => (
                        <div
                          key={task.id}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm w-full max-w-full overflow-hidden transition-colors hover:bg-muted/30"
                        >
                          <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium truncate" title={task.title}>
                                {task.title}
                              </span>
                              <span className="text-xs text-muted-foreground/70 font-normal shrink-0 ml-auto">
                                #{task.id}
                              </span>
                            </div>
                            <div className="grid grid-cols-[80px_80px_auto] gap-1.5 text-xs items-center">
                              <span
                                className={cn(
                                  'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border w-full',
                                  (() => {
                                    const name = task.status.name.toLowerCase()
                                    if (name.includes('todo') || name.includes('to do'))
                                      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                    if (name.includes('progress') || name.includes('doing'))
                                      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800'
                                    if (name.includes('done') || name.includes('complete'))
                                      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800'
                                    return 'bg-background text-muted-foreground border-border/70'
                                  })(),
                                )}
                              >
                                {task.status.name}
                              </span>

                              <span
                                className={cn(
                                  'inline-flex items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium border w-full',
                                  task.priority === 'LOW' &&
                                    'border-emerald-800/60 bg-emerald-700/30 text-emerald-950 dark:border-emerald-200/70 dark:bg-emerald-500/44 dark:text-emerald-50',
                                  task.priority === 'MEDIUM' &&
                                    'border-blue-700/60 bg-blue-600/30 text-blue-950 dark:border-blue-300/70 dark:bg-blue-500/40 dark:text-blue-50',
                                  task.priority === 'HIGH' &&
                                    'border-orange-700/60 bg-orange-600/30 text-orange-950 dark:border-orange-300/70 dark:bg-orange-500/40 dark:text-orange-50',
                                  task.priority === 'URGENT' &&
                                    'border-rose-700/60 bg-rose-600/30 text-rose-950 dark:border-rose-300/70 dark:bg-rose-500/42 dark:text-rose-50',
                                )}
                              >
                                <span
                                  className={cn(
                                    'inline-block size-1 rounded-full',
                                    task.priority === 'LOW' && 'bg-emerald-800 dark:bg-emerald-200',
                                    task.priority === 'MEDIUM' && 'bg-blue-700 dark:bg-blue-300',
                                    task.priority === 'HIGH' && 'bg-orange-700 dark:bg-orange-300',
                                    task.priority === 'URGENT' && 'bg-rose-700 dark:bg-rose-300',
                                  )}
                                />
                                {task.priority}
                              </span>

                              {task.goalId ? (
                                <span className="inline-flex items-center rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 w-fit justify-self-start">
                                  {t('task.goalShort', { id: task.goalId })}
                                </span>
                              ) : (
                                <div />
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full shrink-0 transition-colors"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                dependencyTaskIds: current.dependencyTaskIds.filter((taskId) => taskId !== task.id),
                              }))
                            }
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('task.dependencyNone')}</p>
                )}

                <div className="h-px bg-border/60" />

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">{t('task.blockerNote')}</Label>
                  <Textarea
                    value={form.blockerNote}
                    onChange={(event) => setForm((current) => ({ ...current, blockerNote: event.target.value }))}
                    placeholder={t('task.blockerNotePlaceholder')}
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-3">
          <div className="flex w-full items-center justify-between">
            <div className="flex gap-1">
              {form.scheduleStart && form.scheduleEnd && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                  {t('task.scheduled')}
                </span>
              )}
              {form.dependencyTaskIds.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {t('task.dependencyCount', { count: form.dependencyTaskIds.length })}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={createTaskMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button type="button" size="sm" onClick={() => createTaskMutation.mutate()} disabled={!canSubmit}>
                {createTaskMutation.isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                {resolvedSubmitLabel}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
