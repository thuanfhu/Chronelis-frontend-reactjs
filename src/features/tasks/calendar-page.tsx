import { useMemo, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import viLocale from '@fullcalendar/core/locales/vi'
import type { EventInput } from '@fullcalendar/core'
import { motion, useAnimationControls } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { taskScheduleApi } from '@/lib/api/modules/task-schedule-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { taskStatusApi } from '@/lib/api/modules/task-status-api'
import { goalApi } from '@/lib/api/modules/goal-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useUiStore } from '@/app/store/ui-store'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
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

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6)
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) {
    return `${start.getDate()} – ${end.getDate()} ${start.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}`
  }
  return `${start.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const PRIORITY_EVENT_CLASSNAMES: Record<TaskPriorityType, string[]> = {
  URGENT: ['!bg-destructive/15', '!border-destructive/35', '!text-destructive'],
  HIGH: ['!bg-orange-500/10', '!border-orange-500/30', '!text-orange-700', 'dark:!text-orange-400'],
  MEDIUM: ['!bg-primary/10', '!border-primary/30', '!text-primary'],
  LOW: ['!bg-muted', '!border-muted-foreground/20', '!text-muted-foreground'],
}

// ─── Types ───

interface ScheduleWithTask extends TaskSchedule {
  task?: Task
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

function parseInputDateTimeValue(value: string): Date {
  const [datePart, timePart = '00:00'] = value.split('T')
  const [yyyy, mm, dd] = datePart.split('-').map(Number)
  const [hh, mi, ss = 0] = timePart.split(':').map(Number)
  return new Date(yyyy, (mm - 1), dd, hh, mi, ss)
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
    : new Date(start.getTime() + 60 * 60 * 1000)

  return {
    start,
    end: resolvedEnd,
  }
}

function normalizeCreateRange(start: Date, end: Date, allDay: boolean): { start: Date; end: Date } {
  const safeStart = new Date(start)
  const safeEnd = new Date(end)

  if (allDay) {
    safeStart.setHours(9, 0, 0, 0)
    safeEnd.setTime(safeStart.getTime() + 60 * 60 * 1000)
    return { start: safeStart, end: safeEnd }
  }

  if (safeEnd <= safeStart) {
    safeEnd.setTime(safeStart.getTime() + 60 * 60 * 1000)
  }

  return { start: safeStart, end: safeEnd }
}

// ─── Main Component ───

export function CalendarPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const workspaceId = Number(params.workspaceId)
  const queryClient = useQueryClient()
  const setTaskDrawerTaskId = useUiStore((s) => s.setTaskDrawerTaskId)
  const calendarRef = useRef<FullCalendar | null>(null)
  const calendarMotionControls = useAnimationControls()

  useProjectRealtime(Number.isFinite(workspaceId) ? workspaceId : null, Number.isFinite(projectId) ? projectId : null)

  const [view, setView] = useState<CalendarView>('week')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [headerTitle, setHeaderTitle] = useState(() => formatWeekRange(startOfWeek(new Date())))
  const [navigationDirection, setNavigationDirection] = useState<1 | -1>(1)
  const [visibleRange, setVisibleRange] = useState(() => getRangeForView('week', new Date()))

  // Create task+schedule from calendar slot click/select
  const [createDialog, setCreateDialog] = useState<{ open: boolean; start: Date; end: Date } | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriorityType>('MEDIUM')
  const [newStartDateTime, setNewStartDateTime] = useState('')
  const [newEndDateTime, setNewEndDateTime] = useState('')
  const [newTaskGoalId, setNewTaskGoalId] = useState<number | null>(null)

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

  const invalidateTaskAndCalendarQueries = async (taskId?: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['task-schedules', 'task'] }),
      taskId ? queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTask(taskId) }) : Promise.resolve(),
    ])
  }

  const createCalendarTaskMutation = useMutation({
    mutationFn: async () => {
      const defaultStatus = statusesQuery.data?.[0]
      if (!defaultStatus) throw new Error('Chưa có cột trạng thái')
      if (!createDialog) throw new Error('Thiếu thông tin ngày')

      const start = parseInputDateTimeValue(newStartDateTime)
      const end = parseInputDateTimeValue(newEndDateTime)
      if (!(end > start)) {
        throw new Error('Giờ kết thúc phải sau giờ bắt đầu')
      }

      const task = await taskApi.create({
        projectId,
        title: newTaskTitle.trim(),
        statusId: defaultStatus.id,
        priority: newTaskPriority,
        goalId: newTaskGoalId ?? undefined,
        sourceView: 'CALENDAR',
      })

      await taskScheduleApi.create({
        taskId: task.id,
        scheduledStart: toApiLocalDateTime(start),
        scheduledEnd: toApiLocalDateTime(end),
      })

      return task
    },
    onSuccess: (task) => {
      setCreateDialog(null)
      setNewTaskTitle('')
      setNewTaskPriority('MEDIUM')
      setNewStartDateTime('')
      setNewEndDateTime('')
      setNewTaskGoalId(null)

      void invalidateTaskAndCalendarQueries(task.id)
      toast.success('Tạo task thành công')
      setTaskDrawerTaskId(task.id)
    },
    onError: (err: Error) => toast.error('Tạo task thất bại', { description: err.message }),
  })

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ scheduleId, start, end }: { scheduleId: number; start: Date; end: Date }) =>
      taskScheduleApi.update(scheduleId, {
        scheduledStart: toApiLocalDateTime(start),
        scheduledEnd: toApiLocalDateTime(end),
      }),
    onSuccess: async () => {
      await invalidateTaskAndCalendarQueries()
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
  const enrichedSchedules = useMemo<ScheduleWithTask[]>(() => {
    const schedules = schedulesQuery.data?.content ?? []
    const tasks = tasksQuery.data?.content ?? []
    const taskMap = new Map(tasks.map((t) => [t.id, t]))
    return schedules.map((s) => ({ ...s, task: taskMap.get(s.taskId) }))
  }, [schedulesQuery.data, tasksQuery.data])

  const isLoading = schedulesQuery.isLoading || tasksQuery.isLoading

  const calendarEvents = useMemo<EventInput[]>(() => {
    return enrichedSchedules.map((schedule) => {
      const priority = schedule.task?.priority ?? 'MEDIUM'

      return {
        id: String(schedule.id),
        title: schedule.task?.title ?? `Task #${schedule.taskId}`,
        start: schedule.scheduledStart,
        end: schedule.scheduledEnd,
        extendedProps: {
          scheduleId: schedule.id,
          taskId: schedule.taskId,
          priority,
          task: schedule.task,
        },
      }
    })
  }, [enrichedSchedules])

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
    const normalizedRange = normalizeCreateRange(start, end, allDay)

    setCreateDialog({
      open: true,
      start: normalizedRange.start,
      end: normalizedRange.end,
    })
    setNewTaskTitle('')
    setNewTaskGoalId(null)
    setNewTaskPriority('MEDIUM')
    setNewStartDateTime(toInputDateTimeValue(normalizedRange.start))
    setNewEndDateTime(toInputDateTimeValue(normalizedRange.end))
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
      setTaskDrawerTaskId(taskId)
    }
  }

  const handleEventDrop = async (arg: CalendarEventInteractionArg) => {
    const scheduleId = Number(arg.event.id)
    const taskId = Number(arg.event.extendedProps.taskId)
    const range = resolveEventRange(arg.event.start, arg.event.end)
    if (!Number.isFinite(scheduleId) || !range) {
      arg.revert?.()
      return
    }

    try {
      await updateScheduleMutation.mutateAsync({
        scheduleId,
        start: range.start,
        end: range.end,
      })
      if (Number.isFinite(taskId)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTask(taskId) })
      }
      toast.success('Cập nhật lịch thành công')
    } catch (error) {
      arg.revert?.()
      const message = error instanceof Error ? error.message : 'Không thể cập nhật lịch'
      toast.error('Cập nhật lịch thất bại', { description: message })
    }
  }

  const handleEventResize = async (arg: CalendarEventInteractionArg) => {
    const scheduleId = Number(arg.event.id)
    const taskId = Number(arg.event.extendedProps.taskId)
    const range = resolveEventRange(arg.event.start, arg.event.end)
    if (!Number.isFinite(scheduleId) || !range) {
      arg.revert?.()
      return
    }

    try {
      await updateScheduleMutation.mutateAsync({
        scheduleId,
        start: range.start,
        end: range.end,
      })
      if (Number.isFinite(taskId)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTask(taskId) })
      }
      toast.success('Cập nhật thời lượng thành công')
    } catch (error) {
      arg.revert?.()
      const message = error instanceof Error ? error.message : 'Không thể cập nhật thời lượng'
      toast.error('Cập nhật thời lượng thất bại', { description: message })
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
    if (arg.view.type === 'timeGridWeek') {
      setHeaderTitle(formatWeekRange(arg.start))
    } else {
      setHeaderTitle(formatMonthYear(arg.view.currentStart))
    }
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

  if (isLoading) return <LoadingPanel />

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <PageHeader
        title="Lịch"
        description="Lịch biểu task theo tuần hoặc tháng"
        actions={
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => handleViewChange(v as CalendarView)}>
              <TabsList className="h-8">
                <TabsTrigger value="week" className="px-3 text-xs">Tuần</TabsTrigger>
                <TabsTrigger value="month" className="px-3 text-xs">Tháng</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        }
      />

      {/* Calendar toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToday}>
            Hôm nay
          </Button>
          <div className="flex items-center rounded-lg border border-border">
            <Button variant="ghost" size="icon" className="size-8 rounded-r-none" onClick={goPrev}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8 rounded-l-none" onClick={goNext}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <h2 className="text-sm font-semibold capitalize">{headerTitle}</h2>
      </div>

      {/* Calendar view */}
      <div className="flex min-h-0 flex-1 flex-col">
        <motion.div
          initial={false}
          animate={calendarMotionControls}
          custom={navigationDirection}
          className="flex h-full min-h-0 flex-col"
        >
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <FullCalendar
              ref={calendarRef}
              plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
              initialView={view === 'week' ? 'timeGridWeek' : 'dayGridMonth'}
              locale={viLocale}
              firstDay={1}
              initialDate={currentDate}
              headerToolbar={false}
              height="100%"
              nowIndicator={view === 'week'}
              allDaySlot={false}
              slotDuration="00:30:00"
              scrollTime="08:00:00"
              selectable
              selectMirror
              editable
              eventStartEditable
              eventDurationEditable
              eventResizableFromStart
              expandRows
              dayMaxEvents={3}
              events={calendarEvents}
              datesSet={handleDatesSet}
              dateClick={handleDateClick}
              select={handleSelect}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              viewDidMount={() => {
                requestAnimationFrame(() => calendarRef.current?.getApi().updateSize())
              }}
              eventClassNames={(arg) => {
                const priority = String(arg.event.extendedProps.priority ?? 'MEDIUM') as TaskPriorityType
                return PRIORITY_EVENT_CLASSNAMES[priority] ?? PRIORITY_EVENT_CLASSNAMES.MEDIUM
              }}
              eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              eventContent={(arg) => (
                <div className="flex min-w-0 flex-col px-1 py-0.5">
                  <span className="truncate text-[11px] font-medium leading-tight">{arg.event.title}</span>
                  {arg.view.type !== 'dayGridMonth' && arg.timeText ? (
                    <span className="truncate text-[10px] opacity-80">{arg.timeText}</span>
                  ) : null}
                </div>
              )}
            />
          </div>
        </motion.div>
      </div>

      {/* Create task dialog */}
      <Dialog open={!!createDialog?.open} onOpenChange={(o) => !o && setCreateDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tạo task từ lịch</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Tiêu đề task</Label>
              <Input
                autoFocus
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newTaskTitle.trim()) createCalendarTaskMutation.mutate() }}
                placeholder="Tên task..."
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Bắt đầu</Label>
                <Input
                  type="datetime-local"
                  value={newStartDateTime}
                  onChange={(e) => setNewStartDateTime(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kết thúc</Label>
                <Input
                  type="datetime-local"
                  value={newEndDateTime}
                  onChange={(e) => setNewEndDateTime(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Độ ưu tiên</Label>
              <div className="flex gap-1.5">
                {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={newTaskPriority === p ? 'default' : 'outline'}
                    className="h-7 flex-1 text-xs"
                    onClick={() => setNewTaskPriority(p)}
                  >{p}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Goal (tùy chọn)</Label>
              <Select value={newTaskGoalId ? String(newTaskGoalId) : '__none'} onValueChange={(v) => setNewTaskGoalId(v === '__none' ? null : Number(v))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Không chọn goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Không chọn goal</SelectItem>
                  {(goalsQuery.data?.content ?? []).map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createDialog && (
              <p className="text-xs text-muted-foreground">
                {createDialog.start.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' · '}
                {newStartDateTime ? newStartDateTime.slice(11, 16) : '--:--'}
                {' – '}
                {newEndDateTime ? newEndDateTime.slice(11, 16) : '--:--'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateDialog(null)}>Hủy</Button>
            <Button
              size="sm"
              onClick={() => createCalendarTaskMutation.mutate()}
              disabled={createCalendarTaskMutation.isPending || !newTaskTitle.trim() || !newStartDateTime || !newEndDateTime}
            >
              {createCalendarTaskMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Tạo task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
