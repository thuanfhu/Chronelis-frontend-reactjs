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
import {
  ChevronLeft, ChevronRight, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { taskScheduleApi } from '@/lib/api/modules/task-schedule-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectPermissions } from '@/lib/permissions/use-project-permissions'
import {
  applyScheduleUpdate,
  patchProjectCalendarQueries,
  patchTaskScheduleQueries,
  restoreProjectCalendarQueries,
  restoreTaskScheduleQueries,
  snapshotProjectCalendarQueries,
  snapshotTaskScheduleQueries,
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
  event: {
    id: string
    start: Date | null
    end: Date | null
    extendedProps: Record<string, unknown>
    title: string
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

  const resolvedEnd = end && end > start
    ? end
    : addMinutes(start, 15)

  return {
    start,
    end: resolvedEnd,
  }
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
  const openTaskDrawer = useUiStore((s) => s.openTaskDrawer)
  const openTaskDeleteConfirm = useUiStore((s) => s.openTaskDeleteConfirm)
  const calendarRef = useRef<FullCalendar | null>(null)
  const calendarMotionControls = useAnimationControls()
  const localeTag = i18n.language === 'vi' ? 'vi-VN' : 'en-US'

  useProjectRealtime(Number.isFinite(workspaceId) ? workspaceId : null, Number.isFinite(projectId) ? projectId : null)
  const { canManageProject, canManageTask, permissionsReady } = useProjectPermissions({
    workspaceId,
    projectId,
    enabled: Number.isFinite(workspaceId) && Number.isFinite(projectId),
  })

  const [view, setView] = useState<CalendarView>('week')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [navigationDirection, setNavigationDirection] = useState<1 | -1>(1)
  const [visibleRange, setVisibleRange] = useState(() => getRangeForView('week', new Date()))
  const headerTitle = view === 'week' ? formatWeekRange(startOfWeek(currentDate), localeTag) : formatMonthYear(currentDate, localeTag)

  // Context menu for calendar events
  const [taskContextMenu, setTaskContextMenu] = useState<{ x: number; y: number; taskId: number; canManage: boolean } | null>(null)

  const openCalendarTaskContextMenu = (event: Pick<MouseEvent, 'clientX' | 'clientY' | 'preventDefault'>, taskId: number, canManage: boolean) => {
    event.preventDefault()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const menuW = 176
    const menuH = 120
    const x = event.clientX + menuW > vw ? vw - menuW - 8 : event.clientX
    const y = event.clientY + menuH > vh ? vh - menuH - 8 : event.clientY
    setTaskContextMenu({ x, y, taskId, canManage })
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

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ scheduleId, start, end }: { scheduleId: number; taskId: number; start: Date; end: Date }) =>
      taskScheduleApi.update(scheduleId, {
        scheduledStart: toApiLocalDateTime(start),
        scheduledEnd: toApiLocalDateTime(end),
      }),
    onMutate: async ({ scheduleId, taskId, start, end }) => {
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

  // Join schedules with task data
  const enrichedSchedules = useMemo<ScheduleWithResolvedTask[]>(() => {
    const schedules = schedulesQuery.data?.content ?? []
    const tasks = tasksQuery.data?.content ?? []
    const taskMap = new Map(tasks.map((t) => [t.id, t]))

    return schedules.flatMap((schedule) => {
      const task = taskMap.get(schedule.taskId)
      return task ? [{ ...schedule, task }] : []
    })
  }, [schedulesQuery.data, tasksQuery.data])

  const dueDateOnlyTasks = useMemo(() => {
    const tasks = tasksQuery.data?.content ?? []
    const scheduledTaskIds = new Set(enrichedSchedules.map((schedule) => schedule.taskId))

    return tasks.filter((task) => Boolean(task.dueDate) && !scheduledTaskIds.has(task.id))
  }, [enrichedSchedules, tasksQuery.data])

  const isLoading = schedulesQuery.isLoading || tasksQuery.isLoading

  const calendarEvents = useMemo<EventInput[]>(() => {
    const scheduledEvents = enrichedSchedules.map((schedule) => {
      const priority = schedule.task.priority

      return {
        id: String(schedule.id),
        title: schedule.task.title,
        start: schedule.scheduledStart,
        end: schedule.scheduledEnd,
        extendedProps: {
          scheduleId: schedule.id,
          taskId: schedule.taskId,
          priority,
          canDelete: canManageTask(),
          task: schedule.task,
          isDueDateOnly: false,
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
        id: `due-${task.id}`,
        title: task.title,
        start: dueDate,
        end: dueEnd,
        editable: false,
        durationEditable: false,
        extendedProps: {
          scheduleId: null,
          taskId: task.id,
          priority: task.priority,
          canDelete: canManageTask(),
          task,
          isDueDateOnly: true,
        },
      })

      return events
    }, [])

    return [...scheduledEvents, ...dueDateEvents]
  }, [canManageTask, dueDateOnlyTasks, enrichedSchedules])

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
    if (!canManageProject) {
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

  const handleEventClick = (arg: CalendarEventInteractionArg) => {
    arg.jsEvent?.preventDefault?.()
    const taskId = Number(arg.event.extendedProps.taskId)
    if (Number.isFinite(taskId)) {
      openTaskDrawer(taskId, 'view')
    }
  }

  const handleEventDrop = async (arg: CalendarEventInteractionArg) => {
    if (arg.event.extendedProps.isDueDateOnly) {
      arg.revert?.()
      return
    }

    const scheduleId = Number(arg.event.id)
    const taskId = Number(arg.event.extendedProps.taskId)
    const task = arg.event.extendedProps.task as Task | undefined
    const range = resolveEventRange(arg.event.start, arg.event.end)
    if (!Number.isFinite(scheduleId) || !Number.isFinite(taskId) || !range || !task) {
      arg.revert?.()
      return
    }

    if (!canManageTask()) {
      toast.error(t('calendar.permissionUpdateTask'))
      arg.revert?.()
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
    if (arg.event.extendedProps.isDueDateOnly) {
      arg.revert?.()
      return
    }

    const scheduleId = Number(arg.event.id)
    const taskId = Number(arg.event.extendedProps.taskId)
    const task = arg.event.extendedProps.task as Task | undefined
    const range = resolveEventRange(arg.event.start, arg.event.end)
    if (!Number.isFinite(scheduleId) || !Number.isFinite(taskId) || !range || !task) {
      arg.revert?.()
      return
    }

    if (!canManageTask()) {
      toast.error(t('calendar.permissionUpdateTask'))
      arg.revert?.()
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

    setVisibleRange((prev) =>
      prev.fromDate === fromDate && prev.toDate === toDate
        ? prev
        : { fromDate, toDate },
    )

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
      {!canManageProject && (
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
          <RefreshCw className={cn('size-3.5', (schedulesQuery.isFetching || tasksQuery.isFetching) && 'animate-spin')} />
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
              <TabsTrigger value="week" className="px-3 text-xs">{t('calendar.week')}</TabsTrigger>
              <TabsTrigger value="month" className="px-3 text-xs">{t('calendar.month')}</TabsTrigger>
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
                selectable={canManageProject}
                selectMirror={canManageProject}
                editable={canManageProject}
                eventStartEditable={canManageProject}
                eventDurationEditable={canManageProject}
                eventResizableFromStart={canManageProject}
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
                        <span className="chronelis-day-header__weekday">{formatWeekdayCompact(arg.date, localeTag)}</span>
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
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                eventDidMount={(arg: CalendarEventMountArg) => {
                  arg.el.oncontextmenu = (event) => {
                    const taskId = Number(arg.event.extendedProps.taskId)
                    const canManage = Boolean(arg.event.extendedProps.canDelete)
                    if (Number.isFinite(taskId)) {
                      openCalendarTaskContextMenu(event as MouseEvent, taskId, canManage)
                    }
                  }
                }}
                viewDidMount={() => {
                  requestAnimationFrame(() => calendarRef.current?.getApi().updateSize())
                }}
                eventClassNames={(arg) => {
                  const priority = String(arg.event.extendedProps.priority ?? 'MEDIUM') as TaskPriorityType
                  return PRIORITY_EVENT_CLASSNAMES[priority] ?? PRIORITY_EVENT_CLASSNAMES.MEDIUM
                }}
                slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false, meridiem: false }}
                eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false, meridiem: false }}
                eventContent={(arg) => (
                  <div
                    className="flex min-w-0 flex-col px-1 py-0.5"
                    onContextMenu={(event) => {
                      const taskId = Number(arg.event.extendedProps.taskId)
                      const canManage = Boolean(arg.event.extendedProps.canDelete)
                      if (Number.isFinite(taskId)) {
                        openCalendarTaskContextMenu(event.nativeEvent, taskId, canManage)
                      }
                    }}
                  >
                    <span className="truncate text-[11px] font-medium leading-tight">{arg.event.title}</span>
                    {arg.view.type !== 'dayGridMonth' && arg.timeText ? (
                      <span className="truncate text-[10px] opacity-80">{arg.timeText}</span>
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
        initialValues={createDialog ? {
          scheduleStart: toInputDateTimeValue(createDialog.start),
          scheduleEnd: toInputDateTimeValue(createDialog.end),
          dueDate: toInputDateTimeValue(createDialog.end),
        } : undefined}
        onCreated={async (task) => {
          await invalidateTaskAndCalendarQueries(task.id)
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
        onFocus={() => {
          const menu = taskContextMenu
          if (!menu) {
            return
          }

          navigate(`/workspaces/${workspaceId}/projects/${projectId}/focus/${menu.taskId}`)
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

          openTaskDeleteConfirm(menu.taskId)
        }}
      />
    </div>
  )
}
