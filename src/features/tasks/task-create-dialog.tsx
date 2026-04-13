import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlignLeft,
  Calendar,
  CalendarClock,
  Clock3,
  Flag,
  Link2,
  Loader2,
  Rows3,
  Shapes,
  Target,
  User,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelectPopover } from '@/components/shared/searchable-select-popover'
import { goalApi } from '@/lib/api/modules/goal-api'
import { queryKeys } from '@/lib/api/query-keys'
import { taskApi } from '@/lib/api/modules/task-api'
import { taskScheduleApi } from '@/lib/api/modules/task-schedule-api'
import { taskStatusApi } from '@/lib/api/modules/task-status-api'
import { taskTypeApi } from '@/lib/api/modules/task-type-api'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { cn } from '@/lib/utils/cn'
import { toLocalDateTimePayload } from '@/lib/utils/datetime'
import type { SourceViewType, Task, TaskPriorityType } from '@/types/domain'

const PRIORITY_OPTIONS: Array<{
  value: TaskPriorityType
  labelKey: string
  className: string
}> = [
  {
    value: 'LOW',
    labelKey: 'task.priorityLow',
    className: 'border-slate-300 text-slate-700 data-[active=true]:border-slate-600 data-[active=true]:bg-slate-600 data-[active=true]:text-white dark:border-slate-600 dark:text-slate-200',
  },
  {
    value: 'MEDIUM',
    labelKey: 'task.priorityMedium',
    className: 'border-sky-300 text-sky-700 data-[active=true]:border-sky-500 data-[active=true]:bg-sky-500 data-[active=true]:text-white dark:border-sky-500/40 dark:text-sky-200',
  },
  {
    value: 'HIGH',
    labelKey: 'task.priorityHigh',
    className: 'border-amber-300 text-amber-700 data-[active=true]:border-amber-500 data-[active=true]:bg-amber-500 data-[active=true]:text-white dark:border-amber-500/40 dark:text-amber-200',
  },
  {
    value: 'URGENT',
    labelKey: 'task.priorityUrgent',
    className: 'border-rose-300 text-rose-700 data-[active=true]:border-rose-500 data-[active=true]:bg-rose-500 data-[active=true]:text-white dark:border-rose-500/40 dark:text-rose-200',
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
  const [form, setForm] = useState<TaskCreateFormState>(() => buildInitialFormState({ initialValues, defaultStatusId }))
  const [dependencyCandidateId, setDependencyCandidateId] = useState<string | undefined>(undefined)

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

    setForm(buildInitialFormState({
      initialValues,
      defaultStatusId: initialValues?.statusId ?? defaultStatusId,
    }))
    setDependencyCandidateId(undefined)
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
              {member.user.firstName.charAt(0)}{member.user.lastName.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ),
      })),
    ],
    [membersQuery.data, t],
  )

  const dependencyOptions = useMemo(
    () => (projectTasksQuery.data?.content ?? []).map((task) => ({
      value: String(task.id),
      label: task.title,
      description: `${task.status.name} • ${task.priority}${task.goalId ? ` • ${t('task.goalShort', { id: task.goalId })}` : ''}`,
      searchText: `${task.description ?? ''} ${task.priority} ${task.status.name}`,
    })),
    [projectTasksQuery.data?.content, t],
  )

  const selectedDependencyTasks = useMemo(() => {
    const taskById = new Map((projectTasksQuery.data?.content ?? []).map((task) => [task.id, task] as const))
    return form.dependencyTaskIds
      .map((taskId) => taskById.get(taskId))
      .filter((task): task is Task => Boolean(task))
  }, [form.dependencyTaskIds, projectTasksQuery.data?.content])

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const titleValue = form.title.trim()
      if (!titleValue) {
        throw new Error(t('task.titleRequired'))
      }

      if (!form.statusId) {
        throw new Error(t('task.statusError'))
      }

      const estimatedMinutes = form.estimatedMinutes.trim()
        ? Number(form.estimatedMinutes)
        : undefined

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

      let createdTask = await taskApi.create({
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
        await taskScheduleApi.create({
          taskId: createdTask.id,
          scheduledStart: toLocalDateTimePayload(form.scheduleStart),
          scheduledEnd: toLocalDateTimePayload(form.scheduleEnd),
        })
      }

      if (form.dependencyTaskIds.length > 0 || form.blockerNote.trim()) {
        await taskApi.updateDependencies(createdTask.id, {
          dependencyTaskIds: form.dependencyTaskIds,
          blockerNote: form.blockerNote.trim() || undefined,
        })
      }

      return createdTask
    },
    onSuccess: async (createdTask) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.myWork }),
        queryClient.invalidateQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTask(createdTask.id) }),
      ])

      if (onCreated) {
        await onCreated(createdTask)
      }

      toast.success(t('task.createSuccess'))
      onOpenChange(false)
    },
    onError: (error: Error) => {
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
      <DialogContent className="max-h-[92vh] max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
              <AlignLeft className="size-4 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base">{resolvedTitle}</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs leading-5">
                {resolvedDescription}
              </DialogDescription>
            </div>
            <span className="rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {t(SOURCE_VIEW_LABELS[defaultSourceView])}
            </span>
          </div>
        </DialogHeader>

        {/* Tab navigation */}
        <div className="flex gap-1 border-b border-border/60 px-6">
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
                activeTab === tab.key
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/80',
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

        <ScrollArea className="max-h-[calc(92vh-12rem)]">
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
                        className={cn('h-8 flex-1 rounded-lg border text-sm font-semibold transition-all', option.className)}
                        onClick={() => setForm((current) => ({ ...current, priority: option.value }))}
                      >
                        {t(option.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2-column row: Status + Goal */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Rows3 className="size-3.5 text-muted-foreground" /> {t('task.status')}
                    </Label>
                    <Select
                      value={form.statusId != null ? String(form.statusId) : undefined}
                      onValueChange={(value) => setForm((current) => ({ ...current, statusId: Number(value) }))}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={statusesQuery.isLoading ? t('common.loading') : t('task.statusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status.id} value={String(status.id)}>{status.name}</SelectItem>
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
                      onValueChange={(value) => setForm((current) => ({ ...current, goalId: value === '__none' ? null : Number(value) }))}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={t('task.goalNone')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">{t('task.goalNone')}</SelectItem>
                        {goals.map((goal) => (
                          <SelectItem key={goal.id} value={String(goal.id)}>
                            <span className="block max-w-52 truncate" title={goal.title}>{goal.title}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Divider with section label */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('task.assignment')}</span>
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
                    onValueChange={(value) => setForm((current) => ({ ...current, assigneeId: value === '__unassigned' ? null : value }))}
                  />
                </div>

                {/* 3-column row: Deadline + Estimated + Task Type */}
                <div className="grid grid-cols-3 gap-3">
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
                      onValueChange={(value) => setForm((current) => ({ ...current, taskTypeId: value === '__none' ? null : Number(value) }))}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={t('task.taskTypeNone')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">{t('task.taskTypeNone')}</SelectItem>
                        {taskTypes.map((taskType) => (
                          <SelectItem key={taskType.id} value={String(taskType.id)}>
                            <span className="flex items-center gap-1.5">
                              {taskType.icon ? <span>{taskType.icon}</span> : null}
                              <span>{taskType.name}</span>
                            </span>
                          </SelectItem>
                        ))}
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
                        {requireSchedule
                          ? t('task.scheduleRequired')
                          : t('task.scheduleOptional')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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

                {form.scheduleStart && form.scheduleEnd && (
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
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <SearchableSelectPopover
                        value={dependencyCandidateId}
                        options={dependencyOptions}
                        placeholder={projectTasksQuery.isLoading ? t('common.loading') : t('task.dependencySearch')}
                        searchPlaceholder={t('task.dependencySearchPlaceholder')}
                        emptyLabel={t('task.dependencyEmpty')}
                        disabled={projectTasksQuery.isLoading || projectTasksQuery.isError}
                        triggerClassName="h-9"
                        onValueChange={setDependencyCandidateId}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0"
                      disabled={!dependencyCandidateId}
                      onClick={() => {
                        const nextDependencyId = Number(dependencyCandidateId)
                        if (!Number.isFinite(nextDependencyId)) return
                        setForm((current) => ({
                          ...current,
                          dependencyTaskIds: current.dependencyTaskIds.includes(nextDependencyId)
                            ? current.dependencyTaskIds
                            : [...current.dependencyTaskIds, nextDependencyId],
                        }))
                        setDependencyCandidateId(undefined)
                      }}
                    >
                      {t('task.dependencyAdd')}
                    </Button>
                  </div>
                </div>

                {selectedDependencyTasks.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">{t('task.dependencySelected', { count: selectedDependencyTasks.length })}</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedDependencyTasks.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20"
                          onClick={() => setForm((current) => ({
                            ...current,
                            dependencyTaskIds: current.dependencyTaskIds.filter((taskId) => taskId !== task.id),
                          }))}
                        >
                          <Link2 className="size-3" />
                          <span className="max-w-48 truncate">{task.title}</span>
                          <span className="text-[10px] opacity-60">✕</span>
                        </button>
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

        <DialogFooter className="border-t border-border/60 px-6 py-3">
          <div className="flex w-full items-center justify-between">
            <div className="flex gap-1">
              {form.scheduleStart && form.scheduleEnd && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">{t('task.scheduled')}</span>
              )}
              {form.dependencyTaskIds.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{t('task.dependencyCount', { count: form.dependencyTaskIds.length })}</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={createTaskMutation.isPending}>
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