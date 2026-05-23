import { useMemo, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import viLocale from '@fullcalendar/core/locales/vi'
import type { EventInput } from '@fullcalendar/core'
import { motion, useAnimationControls } from 'framer-motion'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { taskScheduleApi } from '@/lib/api/modules/task-schedule-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { queryKeys } from '@/lib/api/query-keys'
import { isNotFoundError } from '@/lib/errors/is-not-found-error'
import { useProjectPermissions } from '@/lib/permissions/use-project-permissions'
import {
  applyScheduleUpdate,
  removeById,
  patchProjectCalendarQueries,
  patchTaskScheduleQueries,
  restoreProjectCalendarQueries,
  restoreTaskScheduleQueries,
  snapshotProjectCalendarQueries,
  snapshotTaskScheduleQueries,
  upsertById,
  markScheduleMutationPending,
  clearScheduleMutationPending,
} from '@/lib/tasks/optimistic-task-cache'
import { useUiStore } from '@/app/store/ui-store'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
import { TaskCreateDialog } from '@/features/tasks/task-create-dialog'
import { TaskContextMenu } from '@/features/tasks/task-context-menu'
import { cn } from '@/lib/utils/cn'
import type { Task, TaskPriorityType, TaskSchedule } from '@/types/domain'

// ─── Date helpers ───

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday start
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function addMinutes(date: Date, minutes: number): Date {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() + minutes)
  return d
}

function roundToQuarter(date: Date): Date {
  const d = new Date(date)
  d.setSeconds(0, 0)
  const roundedMinutes = Math.round(d.getMinutes() / 15) * 15
  if (roundedMinutes === 60) {
    d.setHours(d.getHours() + 1, 0, 0, 0)
  } else {
    d.setMinutes(roundedMinutes, 0, 0)
  }
  return d
}

function formatMonthYear(date: Date, localeTag: string): string {
  return new Intl.DateTimeFormat(localeTag, { month: 'long', year: 'numeric' }).format(date)
}

function formatScheduleTime(date: Date, localeTag: string): string {
  const time = new Intl.DateTimeFormat(localeTag, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
  const dateStr = new Intl.DateTimeFormat(localeTag, { day: 'numeric', month: 'short' }).format(date)
  return `${time}, ${dateStr}`
}

function formatWeekRange(start: Date, localeTag: string): string {
  const end = addDays(start, 6)
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  if (sameMonth) {
    return `${start.getDate()}-${end.getDate()} ${formatMonthYear(start, localeTag)}`
  }
  if (start.getFullYear() === end.getFullYear()) {
    const formatter = new Intl.DateTimeFormat(localeTag, { day: 'numeric', month: 'short' })
    return `${formatter.format(start)} - ${formatter.format(end)}, ${start.getFullYear()}`
  }
  const formatter = new Intl.DateTimeFormat(localeTag, { day: 'numeric', month: 'numeric', year: 'numeric' })
  return `${formatter.format(start)} - ${formatter.format(end)}`
}

function formatWeekdayCompact(date: Date, localeTag: string): string {
  if (localeTag !== 'vi-VN') {
    return new Intl.DateTimeFormat(localeTag, { weekday: 'short' }).format(date).replace(/\./g, '').trim()
  }

  const raw = date.toLocaleDateString('vi-VN', { weekday: 'short' }).replace(/\./g, '').trim()
  const lower = raw.toLowerCase()
  if (lower === 'cn' || lower === 'chủ nhật') {
    return 'CN'
  }

  return raw
    .replace(/^thứ\s*/i, 'T')
    .replace(/^th\s*/i, 'T')
    .replace(/\s+/g, '')
    .toUpperCase()
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const PRIORITY_EVENT_CLASSNAMES: Record<TaskPriorityType, string[]> = {
  URGENT: ['chronelis-event', 'chronelis-event--urgent'],
  HIGH: ['chronelis-event', 'chronelis-event--high'],
  MEDIUM: ['chronelis-event', 'chronelis-event--medium'],
  LOW: ['chronelis-event', 'chronelis-event--low'],
}

// ─── Types ───

interface ScheduleWithResolvedTask extends TaskSchedule {
  task: Task
}

type CalendarView = 'week' | 'month'

interface CalendarDateClickArg {
  date: Date
  allDay: boolean
}

interface CalendarSelectArg {
  start: Date
  end: Date
  allDay: boolean
  view: {
    calendar: {
      unselect: () => void
    }
  }
}

interface CalendarEventInteractionArg {
  el?: HTMLElement
  event: {
    id: string
    start: Date | null
    end: Date | null
    extendedProps: Record<string, unknown>
    title: string
  }
  oldEvent?: {
    start: Date | null
    end: Date | null
  }
  revert?: () => void
  jsEvent?: {
    preventDefault?: () => void
  }
}

interface CalendarEventMountArg {
  el: HTMLElement
  event: {
    extendedProps: Record<string, unknown>
  }
}

interface CalendarDatesSetArg {
  start: Date
  end: Date
  view: {
    type: string
    currentStart: Date
  }
}

function toInputDateTimeValue(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function toApiLocalDateTime(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`
}

function getRangeForView(view: CalendarView, referenceDate: Date): { fromDate: string; toDate: string } {
  if (view === 'week') {
    const weekStart = startOfWeek(referenceDate)
    return {
      fromDate: toDateKey(weekStart),
      toDate: toDateKey(addDays(weekStart, 6)),
    }
  }

  const first = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const last = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0)
  const displayStart = startOfWeek(first)
  const displayEndDate = addDays(startOfWeek(addDays(last, 6)), 6)

  return {
    fromDate: toDateKey(displayStart),
    toDate: toDateKey(displayEndDate),
  }
}

function resolveEventRange(start: Date | null, end: Date | null): { start: Date; end: Date } | null {
  if (!start) return null

  const resolvedEnd = end && end > start ? end : addMinutes(start, 15)

  return {
    start,
    end: resolvedEnd,
  }
}

function readPositiveNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function readFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toCalendarScheduleEventId(scheduleId: number): string {
  return scheduleId > 0 ? `schedule:${scheduleId}` : `temp-schedule:${Math.abs(scheduleId)}`
}

function toDebugDate(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null
}

function parseValidDate(dateValue: string | undefined): Date | null {
  if (!dateValue) {
    return null
  }

  const parsed = new Date(dateValue)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function normalizeCreateRange(start: Date, end: Date, allDay: boolean): { start: Date; end: Date } {
  const safeStart = roundToQuarter(start)
  const safeEnd = roundToQuarter(end)

  if (allDay) {
    safeStart.setHours(9, 0, 0, 0)
    safeEnd.setTime(safeStart.getTime() + 60 * 60 * 1000)
    return { start: safeStart, end: safeEnd }
  }

  if (safeEnd <= safeStart) {
    safeEnd.setTime(safeStart.getTime() + 15 * 60 * 1000)
  }

  return { start: safeStart, end: safeEnd }
}

// ─── Main Component ───

export function CalendarPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const params = useParams()
  const projectId = Number(params.projectId)
  const workspaceId = Number(params.workspaceId)
  const queryClient = useQueryClient()
  const { canManageTask, canScheduleTask, permissionsReady } = useProjectPermissions({
    workspaceId,
    projectId,
    enabled: Number.isFinite(workspaceId) && Number.isFinite(projectId),
  })

  const openTaskDrawer = useUiStore((s) => s.openTaskDrawer)
  const openTaskDeleteConfirm = useUiStore((s) => s.openTaskDeleteConfirm)
  const calendarRef = useRef<FullCalendar | null>(null)
  const updatingScheduleIdsRef = useRef<Set<number>>(new Set())
  const calendarMotionControls = useAnimationControls()
  const localeTag = i18n.language === 'vi' ? 'vi-VN' : 'en-US'

  useProjectRealtime(Number.isFinite(workspaceId) ? workspaceId : null, Number.isFinite(projectId) ? projectId : null)

  const [view, setView] = useState<CalendarView>('week')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [navigationDirection, setNavigationDirection] = useState<1 | -1>(1)
  const [visibleRange, setVisibleRange] = useState(() => getRangeForView('week', new Date()))
  const [updatingScheduleIds, setUpdatingScheduleIds] = useState<Set<number>>(() => new Set())
  const headerTitle =
    view === 'week' ? formatWeekRange(startOfWeek(currentDate), localeTag) : formatMonthYear(currentDate, localeTag)

  // Context menu for calendar events
  const [taskContextMenu, setTaskContextMenu] = useState<{
    x: number
    y: number
    taskId: number
    scheduleId: number | null
    canManage: boolean
    isDueDateOnly: boolean
    isOptimistic: boolean
  } | null>(null)

  const openCalendarTaskContextMenu = (
    event: Pick<MouseEvent, 'clientX' | 'clientY' | 'preventDefault'>,
    taskId: number,
    scheduleId: number | null,
    canManage: boolean,
    isDueDateOnly: boolean,
    isOptimistic: boolean,
  ) => {
    event.preventDefault()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const menuW = 176
    const menuH = 120
    const x = event.clientX + menuW > vw ? vw - menuW - 8 : event.clientX
    const y = event.clientY + menuH > vh ? vh - menuH - 8 : event.clientY
    setTaskContextMenu({ x, y, taskId, scheduleId, canManage, isDueDateOnly, isOptimistic })
  }

  // Create task+schedule from calendar slot click/select
  const [createDialog, setCreateDialog] = useState<{ open: boolean; start: Date; end: Date } | null>(null)

  const invalidateTaskAndCalendarQueries = async (taskId?: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['task-schedules', 'task'] }),
      taskId ? queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTask(taskId) }) : Promise.resolve(),
    ])
  }

  const setScheduleUpdating = (scheduleId: number, isUpdating: boolean) => {
    const currentlyUpdating = updatingScheduleIdsRef.current.has(scheduleId)
    if (currentlyUpdating === isUpdating) {
      return
    }

    const next = new Set(updatingScheduleIdsRef.current)
    if (isUpdating) {
      next.add(scheduleId)
    } else {
      next.delete(scheduleId)
    }
    updatingScheduleIdsRef.current = next
    setUpdatingScheduleIds(next)
  }

  const syncScheduleQueries = async (taskId?: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] }),
      taskId
        ? queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTask(taskId) })
        : queryClient.invalidateQueries({ queryKey: ['task-schedules', 'task'] }),
    ])
  }

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ scheduleId, start, end }: { scheduleId: number; taskId: number; start: Date; end: Date }) => {
      const payload = {
        scheduledStart: toApiLocalDateTime(start),
        scheduledEnd: toApiLocalDateTime(end),
      }
      if (import.meta.env.DEV) {
        console.debug('[Chronelis calendar] PATCH /task-schedules/%s', scheduleId, payload)
      }
      return taskScheduleApi.update(scheduleId, payload)
    },
    onMutate: async ({ scheduleId, taskId, start, end }) => {
      setScheduleUpdating(scheduleId, true)
      markScheduleMutationPending(scheduleId)

      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] }),
        queryClient.cancelQueries({ queryKey: ['task-schedules', 'task', taskId] }),
      ])

      const scheduledStart = toApiLocalDateTime(start)
      const scheduledEnd = toApiLocalDateTime(end)
      const projectCalendarSnapshot = snapshotProjectCalendarQueries(queryClient, projectId)
      const taskScheduleSnapshot = snapshotTaskScheduleQueries(queryClient, taskId)

      patchProjectCalendarQueries(queryClient, projectId, (schedules) =>
        applyScheduleUpdate(schedules, {
          scheduleId,
          scheduledStart,
          scheduledEnd,
        }),
      )

      patchTaskScheduleQueries(queryClient, taskId, (schedules) =>
        applyScheduleUpdate(schedules, {
          scheduleId,
          scheduledStart,
          scheduledEnd,
        }),
      )

      return {
        projectCalendarSnapshot,
        taskScheduleSnapshot,
      }
    },
    onError: (error: Error, variables, context) => {
      if (context?.projectCalendarSnapshot) {
        restoreProjectCalendarQueries(queryClient, context.projectCalendarSnapshot)
      }
      if (context?.taskScheduleSnapshot) {
        restoreTaskScheduleQueries(queryClient, context.taskScheduleSnapshot)
      }
      if (isNotFoundError(error)) {
        toast.info(t('calendar.scheduleSynced', 'Lịch đã được đồng bộ lại'))
        void syncScheduleQueries(variables.taskId)
        return
      }

      toast.error(t('calendar.scheduleUpdateFailedGeneric'))
    },
    onSuccess: (savedSchedule, variables) => {
      patchProjectCalendarQueries(queryClient, projectId, (schedules) => upsertById(schedules, savedSchedule))
      patchTaskScheduleQueries(queryClient, variables.taskId, (schedules) => upsertById(schedules, savedSchedule))

      const timeStr = formatScheduleTime(variables.start, localeTag)
      toast.success(t('calendar.scheduleUpdatedWithTime', `Đã lên lịch lại cho sự kiện lúc ${timeStr}`))
    },
    onSettled: (_data, _error, variables) => {
      setScheduleUpdating(variables.scheduleId, false)
      clearScheduleMutationPending(variables.scheduleId)
    },
  })

  const deleteScheduleMutation = useMutation({
    mutationFn: ({ scheduleId }: { scheduleId: number; taskId: number }) => taskScheduleApi.remove(scheduleId),
    onMutate: async ({ scheduleId, taskId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] }),
        queryClient.cancelQueries({ queryKey: ['task-schedules', 'task', taskId] }),
      ])

      const projectCalendarSnapshot = snapshotProjectCalendarQueries(queryClient, projectId)
      const taskScheduleSnapshot = snapshotTaskScheduleQueries(queryClient, taskId)

      patchProjectCalendarQueries(queryClient, projectId, (schedules) => removeById(schedules, scheduleId))
      patchTaskScheduleQueries(queryClient, taskId, (schedules) => removeById(schedules, scheduleId))

      return {
        projectCalendarSnapshot,
        taskScheduleSnapshot,
      }
    },
    onError: (error: Error, _variables, context) => {
      if (context?.projectCalendarSnapshot) {
        restoreProjectCalendarQueries(queryClient, context.projectCalendarSnapshot)
      }
      if (context?.taskScheduleSnapshot) {
        restoreTaskScheduleQueries(queryClient, context.taskScheduleSnapshot)
      }
      toast.error(t('calendar.updateScheduleFailed'), { description: error.message })
    },
    onSettled: async (_data, _error, variables) => {
      await invalidateTaskAndCalendarQueries(variables.taskId)
    },
  })

  // Fetch schedules
  const schedulesQuery = useQuery({
    queryKey: queryKeys.schedules.projectCalendar(projectId, visibleRange.fromDate, visibleRange.toDate, 1, 500),
    queryFn: () =>
      taskScheduleApi.projectCalendar(projectId, visibleRange.fromDate, visibleRange.toDate, { page: 1, size: 500 }),
    enabled: Number.isFinite(projectId),
    placeholderData: keepPreviousData,
  })

  // Fetch tasks for the project to join with schedules
  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.byProject(projectId, 1, 500),
    queryFn: () => taskApi.listByProject(projectId, { page: 1, size: 500 }),
    enabled: Number.isFinite(projectId),
    placeholderData: keepPreviousData,
  })

  const currentCalendarSchedules = useMemo(() => schedulesQuery.data?.content ?? [], [schedulesQuery.data?.content])
  const currentProjectTasks = useMemo(() => tasksQuery.data?.content ?? [], [tasksQuery.data?.content])

  // Join schedules with task data
  const enrichedSchedules = useMemo<ScheduleWithResolvedTask[]>(() => {
    const taskMap = new Map(currentProjectTasks.map((t) => [t.id, t]))

    return currentCalendarSchedules.flatMap((schedule) => {
      const task = taskMap.get(schedule.taskId)
      return task ? [{ ...schedule, task }] : []
    })
  }, [currentCalendarSchedules, currentProjectTasks])

  const dueDateOnlyTasks = useMemo(() => {
    const scheduledTaskIds = new Set(currentCalendarSchedules.map((schedule) => schedule.taskId))
    const pendingScheduledTaskIds = new Set(
      currentCalendarSchedules.filter((schedule) => schedule.id < 0).map((schedule) => schedule.taskId),
    )
    const hasPendingSchedule = pendingScheduledTaskIds.size > 0

    return currentProjectTasks.filter((task) => {
      if (!task.dueDate || scheduledTaskIds.has(task.id) || pendingScheduledTaskIds.has(task.id)) {
        return false
      }

      if (task.id < 0 && hasPendingSchedule) {
        return false
      }

      if (task.sourceView === 'CALENDAR' && (hasPendingSchedule || schedulesQuery.isFetching)) {
        return false
      }

      return true
    })
  }, [currentCalendarSchedules, currentProjectTasks, schedulesQuery.isFetching])

  const isLoading = schedulesQuery.isLoading || tasksQuery.isLoading

  const calendarEvents = useMemo<EventInput[]>(() => {
    const scheduledEvents = enrichedSchedules.map((schedule) => {
      const priority = schedule.task.priority
      const isOptimistic = schedule.id < 0
      const isUpdating = updatingScheduleIds.has(schedule.id)
      const canEditSchedule = canScheduleTask() && !isOptimistic && !isUpdating

      return {
        id: toCalendarScheduleEventId(schedule.id),
        title: schedule.task.title,
        start: schedule.scheduledStart,
        end: schedule.scheduledEnd,
        editable: canEditSchedule,
        startEditable: canEditSchedule,
        durationEditable: canEditSchedule,
        extendedProps: {
          scheduleId: schedule.id,
          taskId: schedule.taskId,
          projectId,
          workspaceId,
          priority,
          canDelete: canEditSchedule,
          task: schedule.task,
          isDueDateOnly: false,
          isOptimistic,
          isUpdating,
        },
      } satisfies EventInput
    })

    const dueDateEvents = dueDateOnlyTasks.reduce<EventInput[]>((events, task) => {
      const dueDate = parseValidDate(task.dueDate)
      if (!dueDate) {
        return events
      }

      const dueEnd = addMinutes(dueDate, 60)
      events.push({
        id: `due:${task.id}`,
        title: task.title,
        start: dueDate,
        end: dueEnd,
        editable: false,
        startEditable: false,
        durationEditable: false,
        extendedProps: {
          scheduleId: null,
          taskId: task.id,
          projectId,
          workspaceId,
          priority: task.priority,
          canDelete: canManageTask(),
          task,
          isDueDateOnly: true,
          isOptimistic: false,
        },
      })

      return events
    }, [])

    return [...scheduledEvents, ...dueDateEvents]
  }, [canManageTask, canScheduleTask, dueDateOnlyTasks, enrichedSchedules, projectId, updatingScheduleIds, workspaceId])

  const hasScheduleInCurrentCalendarCache = (scheduleId: number) =>
    currentCalendarSchedules.some((schedule) => schedule.id === scheduleId)

  const debugCalendarInteraction = (
    source: 'eventDrop' | 'eventResize',
    arg: CalendarEventInteractionArg,
    scheduleId: number | null,
    taskId: number,
    scheduleInCurrentCalendarCache: boolean,
  ) => {
    if (!import.meta.env.DEV) {
      return
    }

    console.debug(`[Chronelis calendar] ${source}`, {
      eventId: arg.event.id,
      scheduleId,
      rawScheduleId: arg.event.extendedProps.scheduleId,
      taskId: Number.isFinite(taskId) ? taskId : null,
      isOptimistic: Boolean(arg.event.extendedProps.isOptimistic),
      isDueDateOnly: Boolean(arg.event.extendedProps.isDueDateOnly),
      oldStart: toDebugDate(arg.oldEvent?.start),
      oldEnd: toDebugDate(arg.oldEvent?.end),
      newStart: toDebugDate(arg.event.start),
      newEnd: toDebugDate(arg.event.end),
      scheduleInCurrentCalendarCache,
    })
  }

  const runCalendarTransition = async (direction: 1 | -1, action: () => void) => {
    setNavigationDirection(direction)

    await calendarMotionControls.start({
      x: direction > 0 ? -36 : 36,
      opacity: 0,
      transition: { duration: 0.12, ease: [0.22, 1, 0.36, 1] },
    })

    action()

    await calendarMotionControls.set({
      x: direction > 0 ? 36 : -36,
      opacity: 0,
    })

    await calendarMotionControls.start({
      x: 0,
      opacity: 1,
      transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
    })

    calendarRef.current?.getApi().updateSize()
  }

  const openCreateDialog = (start: Date, end: Date, allDay: boolean) => {
    if (!canScheduleTask()) {
      toast.error(t('calendar.permissionCreateTask'))
      return
    }

    const normalizedRange = normalizeCreateRange(start, end, allDay)

    setCreateDialog({
      open: true,
      start: normalizedRange.start,
      end: normalizedRange.end,
    })
  }

  const navigateToTodoDate = (date: Date) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', 'todo')
    nextParams.set('todoDate', toDateKey(date))
    navigate({ search: `?${nextParams.toString()}` })
  }

  const handleDateClick = (arg: CalendarDateClickArg) => {
    openCreateDialog(arg.date, new Date(arg.date.getTime() + 60 * 60 * 1000), arg.allDay)
  }

  const handleSelect = (arg: CalendarSelectArg) => {
    openCreateDialog(arg.start, arg.end, arg.allDay)
    arg.view.calendar.unselect()
  }
  const handleEventDragStart = (arg: CalendarEventInteractionArg) => {
    const el = arg.el
    if (!el || !el.parentNode) return

    // Clone the DOM node to act as a pure visual ghost
    const clone = el.cloneNode(true) as HTMLElement
    clone.id = 'manual-drag-ghost'
    clone.style.visibility = 'visible'
    
    el.parentNode.appendChild(clone)
  }

  const handleEventDragStop = () => {
    const clone = document.getElementById('manual-drag-ghost')
    if (clone) clone.remove()
  }
  const handleEventClick = (arg: CalendarEventInteractionArg) => {
    arg.jsEvent?.preventDefault?.()
    if (arg.event.extendedProps.isDragOriginGhost) return
    if (arg.event.extendedProps.isOptimistic) {
      toast.info(t('calendar.scheduleSaving'))
      return
    }

    const taskId = Number(arg.event.extendedProps.taskId)
    if (Number.isFinite(taskId)) {
      openTaskDrawer(taskId, 'view')
    }
  }

  const handleEventDrop = async (arg: CalendarEventInteractionArg) => {
    const taskId = Number(arg.event.extendedProps.taskId)
    const scheduleId = readPositiveNumber(arg.event.extendedProps.scheduleId)
    const isOptimistic = Boolean(arg.event.extendedProps.isOptimistic)
    const isDueDateOnly = Boolean(arg.event.extendedProps.isDueDateOnly)
    const scheduleInCurrentCalendarCache = scheduleId != null && hasScheduleInCurrentCalendarCache(scheduleId)
    debugCalendarInteraction('eventDrop', arg, scheduleId, taskId, scheduleInCurrentCalendarCache)

    const task = arg.event.extendedProps.task as Task | undefined
    const range = resolveEventRange(arg.event.start, arg.event.end)
    if (!Number.isFinite(taskId) || !range || !task) {
      arg.revert?.()
      return
    }

    if (!canScheduleTask()) {
      toast.error(t('calendar.permissionUpdateTask'))
      arg.revert?.()
      return
    }

    if (isDueDateOnly) {
      toast.info(t('calendar.scheduleRequiredToDrag'))
      arg.revert?.()
      return
    }

    if (isOptimistic) {
      toast.info(t('calendar.scheduleSaving'))
      arg.revert?.()
      return
    }

    if (scheduleId == null) {
      toast.info(t('calendar.scheduleSynced'))
      arg.revert?.()
      void syncScheduleQueries(taskId)
      return
    }

    if (updatingScheduleIdsRef.current.has(scheduleId) || Boolean(arg.event.extendedProps.isUpdating)) {
      toast.info(t('calendar.scheduleSaving'))
      arg.revert?.()
      return
    }

    if (!scheduleInCurrentCalendarCache) {
      toast.info(t('calendar.scheduleSynced'))
      arg.revert?.()
      void syncScheduleQueries(taskId)
      return
    }

    try {
      await updateScheduleMutation.mutateAsync({
        scheduleId,
        taskId,
        start: range.start,
        end: range.end,
      })
    } catch {
      arg.revert?.()
    }
  }

  const handleEventResize = async (arg: CalendarEventInteractionArg) => {
    const taskId = Number(arg.event.extendedProps.taskId)
    const scheduleId = readPositiveNumber(arg.event.extendedProps.scheduleId)
    const isOptimistic = Boolean(arg.event.extendedProps.isOptimistic)
    const isDueDateOnly = Boolean(arg.event.extendedProps.isDueDateOnly)
    const scheduleInCurrentCalendarCache = scheduleId != null && hasScheduleInCurrentCalendarCache(scheduleId)
    debugCalendarInteraction('eventResize', arg, scheduleId, taskId, scheduleInCurrentCalendarCache)

    const task = arg.event.extendedProps.task as Task | undefined
    const range = resolveEventRange(arg.event.start, arg.event.end)
    if (!Number.isFinite(taskId) || !range || !task) {
      arg.revert?.()
      return
    }

    if (!canScheduleTask()) {
      toast.error(t('calendar.permissionUpdateTask'))
      arg.revert?.()
      return
    }

    if (isDueDateOnly) {
      toast.info(t('calendar.scheduleRequiredToDrag'))
      arg.revert?.()
      return
    }

    if (isOptimistic) {
      toast.info(t('calendar.scheduleSaving'))
      arg.revert?.()
      return
    }

    if (scheduleId == null) {
      toast.info(t('calendar.scheduleSynced'))
      arg.revert?.()
      void syncScheduleQueries(taskId)
      return
    }

    if (updatingScheduleIdsRef.current.has(scheduleId) || Boolean(arg.event.extendedProps.isUpdating)) {
      toast.info(t('calendar.scheduleSaving'))
      arg.revert?.()
      return
    }

    if (!scheduleInCurrentCalendarCache) {
      toast.info(t('calendar.scheduleSynced'))
      arg.revert?.()
      void syncScheduleQueries(taskId)
      return
    }

    try {
      await updateScheduleMutation.mutateAsync({
        scheduleId,
        taskId,
        start: range.start,
        end: range.end,
      })
    } catch {
      arg.revert?.()
    }
  }

  const handleDatesSet = (arg: CalendarDatesSetArg) => {
    const fromDate = toDateKey(arg.start)
    const toDate = toDateKey(addDays(arg.end, -1))

    setVisibleRange((prev) => (prev.fromDate === fromDate && prev.toDate === toDate ? prev : { fromDate, toDate }))

    setCurrentDate(new Date(arg.view.currentStart))
  }

  const goToday = () => {
    const api = calendarRef.current?.getApi()
    if (!api) return

    const today = new Date()
    const direction: 1 | -1 = today.getTime() >= currentDate.getTime() ? 1 : -1
    void runCalendarTransition(direction, () => api.today())
  }

  const goPrev = () => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    void runCalendarTransition(-1, () => api.prev())
  }

  const goNext = () => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    void runCalendarTransition(1, () => api.next())
  }

  const handleViewChange = (nextView: CalendarView) => {
    if (nextView === view) return
    const api = calendarRef.current?.getApi()
    const fullCalendarView = nextView === 'week' ? 'timeGridWeek' : 'dayGridMonth'
    const direction: 1 | -1 = nextView === 'month' ? 1 : -1

    if (!api) {
      setView(nextView)
      setVisibleRange(getRangeForView(nextView, currentDate))
      return
    }

    void runCalendarTransition(direction, () => {
      setView(nextView)
      api.changeView(fullCalendarView)
    })
  }

  if (isLoading || !permissionsReady) return <LoadingPanel />

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      {!canScheduleTask() && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="font-medium">{t('calendar.readOnlyTitle')}</span> {t('calendar.readOnlyDescription')}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t('calendar.title')}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('calendar.pageDescription')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => void invalidateTaskAndCalendarQueries()}
        >
          <RefreshCw
            className={cn('size-3.5', (schedulesQuery.isFetching || tasksQuery.isFetching) && 'animate-spin')}
          />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Calendar toolbar */}
      <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/70 bg-card/70 px-2.5 py-2 backdrop-blur-sm sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs font-medium" onClick={goToday}>
            {t('calendar.today')}
          </Button>
          <div className="flex items-center rounded-md border border-border bg-background/80">
            <Button variant="ghost" size="icon" className="size-8 rounded-r-none" onClick={goPrev}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8 rounded-l-none" onClick={goNext}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <h2 className="truncate text-center text-sm font-semibold tracking-tight text-foreground/90 sm:px-3 sm:text-base">
          {headerTitle}
        </h2>
        <div className="justify-self-start sm:justify-self-end">
          <Tabs value={view} onValueChange={(v) => handleViewChange(v as CalendarView)}>
            <TabsList className="h-8 bg-muted/70">
              <TabsTrigger value="week" className="px-3 text-xs">
                {t('calendar.week')}
              </TabsTrigger>
              <TabsTrigger value="month" className="px-3 text-xs">
                {t('calendar.month')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Calendar view */}
      <div className="flex min-h-0 flex-1 flex-col">
        <motion.div
          initial={false}
          animate={calendarMotionControls}
          custom={navigationDirection}
          className="flex h-full min-h-0 flex-col"
        >
          <div className="flex min-h-0 flex-1 overflow-x-auto">
            <div className="chronelis-calendar-frame flex h-full min-h-0 min-w-190 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:min-w-0">
              <FullCalendar
                ref={calendarRef}
                plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                initialView={view === 'week' ? 'timeGridWeek' : 'dayGridMonth'}
                locale={i18n.language === 'vi' ? viLocale : undefined}
                firstDay={1}
                initialDate={currentDate}
                headerToolbar={false}
                height="100%"
                nowIndicator={view === 'week'}
                allDaySlot={false}
                slotDuration="00:15:00"
                slotLabelInterval="01:00:00"
                snapDuration="00:15:00"
                scrollTime="08:00:00"
                selectable={canScheduleTask()}
                selectMirror={canScheduleTask()}
                editable={canScheduleTask()}
                eventStartEditable={canScheduleTask()}
                eventDurationEditable={canScheduleTask()}
                eventResizableFromStart={canScheduleTask()}
                expandRows
                dayMaxEvents={3}
                events={calendarEvents}
                datesSet={handleDatesSet}
                dayHeaderContent={(arg) => {
                  if (arg.view.type === 'timeGridWeek') {
                    return (
                      <button
                        type="button"
                        className={`chronelis-day-header chronelis-day-header--clickable ${arg.isToday ? 'is-today' : ''}`}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          navigateToTodoDate(arg.date)
                        }}
                        title={t('calendar.openTodoForDay')}
                      >
                        <span className="chronelis-day-header__weekday">
                          {formatWeekdayCompact(arg.date, localeTag)}
                        </span>
                        <span className="chronelis-day-header__date">{arg.date.getDate()}</span>
                      </button>
                    )
                  }

                  return (
                    <button
                      type="button"
                      className={`chronelis-day-header chronelis-day-header--month chronelis-day-header--clickable ${arg.isToday ? 'is-today' : ''}`}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        navigateToTodoDate(arg.date)
                      }}
                      title={t('calendar.openTodoForDay')}
                    >
                      <span className="chronelis-day-header__weekday">{formatWeekdayCompact(arg.date, localeTag)}</span>
                    </button>
                  )
                }}
                dateClick={handleDateClick}
                select={handleSelect}
                eventClick={handleEventClick}
                eventDragStart={handleEventDragStart}
                eventDragStop={handleEventDragStop}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                eventDidMount={(arg: CalendarEventMountArg) => {
                  if (arg.event.extendedProps.isDragOriginGhost) return
                  arg.el.oncontextmenu = (event) => {
                    const taskId = Number(arg.event.extendedProps.taskId)
                    const scheduleId = readFiniteNumber(arg.event.extendedProps.scheduleId)
                    const canManage = Boolean(arg.event.extendedProps.canDelete)
                    const isDueDateOnly = Boolean(arg.event.extendedProps.isDueDateOnly)
                    const isOptimistic = Boolean(arg.event.extendedProps.isOptimistic)
                    if (Number.isFinite(taskId)) {
                      openCalendarTaskContextMenu(event as MouseEvent, taskId, scheduleId, canManage, isDueDateOnly, isOptimistic)
                    }
                  }
                }}
                viewDidMount={() => {
                  requestAnimationFrame(() => calendarRef.current?.getApi().updateSize())
                }}
                eventClassNames={(arg) => {
                  const priority = String(arg.event.extendedProps.priority ?? 'MEDIUM') as TaskPriorityType
                  const classNames = [...(PRIORITY_EVENT_CLASSNAMES[priority] ?? PRIORITY_EVENT_CLASSNAMES.MEDIUM)]
                  if (arg.event.extendedProps.isOptimistic || arg.event.extendedProps.isUpdating) {
                    classNames.push('chronelis-event--saving')
                  }
                  return classNames
                }}
                slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false, meridiem: false }}
                eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false, meridiem: false }}
                eventContent={(arg) => (
                  <div
                    className="flex min-w-0 flex-col px-1 py-0.5"
                    onContextMenu={(event) => {
                      if (arg.event.extendedProps.isDragOriginGhost) return
                      const taskId = Number(arg.event.extendedProps.taskId)
                      const scheduleId = readFiniteNumber(arg.event.extendedProps.scheduleId)
                      const canManage = Boolean(arg.event.extendedProps.canDelete)
                      const isDueDateOnly = Boolean(arg.event.extendedProps.isDueDateOnly)
                      const isOptimistic = Boolean(arg.event.extendedProps.isOptimistic)
                      if (Number.isFinite(taskId)) {
                        openCalendarTaskContextMenu(event.nativeEvent, taskId, scheduleId, canManage, isDueDateOnly, isOptimistic)
                      }
                    }}
                  >
                    <span className="fc-event-title truncate text-[11px] font-medium leading-tight">
                      {arg.event.title}
                    </span>
                    {arg.view.type !== 'dayGridMonth' && arg.timeText ? (
                      <span className="fc-event-time truncate text-[10px]">{arg.timeText}</span>
                    ) : null}
                  </div>
                )}
              />
            </div>
          </div>
        </motion.div>
      </div>

      <TaskCreateDialog
        open={Boolean(createDialog?.open)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setCreateDialog(null)
          }
        }}
        workspaceId={workspaceId}
        projectId={projectId}
        title={t('calendar.createTaskTitle')}
        description={t('calendar.createTaskDesc')}
        submitLabel={t('calendar.createTaskSubmit')}
        defaultSourceView="CALENDAR"
        requireSchedule
        initialValues={
          createDialog
            ? {
                scheduleStart: toInputDateTimeValue(createDialog.start),
                scheduleEnd: toInputDateTimeValue(createDialog.end),
              }
            : undefined
        }
        onCreated={() => {
          setCreateDialog(null)
        }}
      />

      <TaskContextMenu
        open={Boolean(taskContextMenu)}
        x={taskContextMenu?.x ?? 0}
        y={taskContextMenu?.y ?? 0}
        onClose={() => setTaskContextMenu(null)}
        onDuplicate={() => {
          const menu = taskContextMenu
          if (!menu) return
          if (!menu.canManage) {
            toast.error(t('calendar.permissionEditTask'))
            return
          }
          openTaskDrawer(menu.taskId, 'duplicate')
        }}
        onEdit={() => {
          const menu = taskContextMenu
          if (!menu) return
          if (!menu.canManage) {
            toast.error(t('calendar.permissionEditTask'))
            return
          }
          openTaskDrawer(menu.taskId, 'edit')
        }}
        onDelete={() => {
          const menu = taskContextMenu
          if (!menu) {
            return
          }

          if (!menu.canManage) {
            toast.error(t('calendar.permissionDeleteTask'))
            return
          }

          if (menu.isOptimistic) {
            toast.info(t('calendar.scheduleSaving'))
            return
          }

          if (menu.scheduleId != null && menu.scheduleId > 0) {
            deleteScheduleMutation.mutate({ scheduleId: menu.scheduleId, taskId: menu.taskId })
            return
          }

          openTaskDeleteConfirm(menu.taskId)
        }}
      />
    </div>
  )
}
