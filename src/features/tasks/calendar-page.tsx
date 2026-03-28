import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { taskScheduleApi } from '@/lib/api/modules/task-schedule-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useUiStore } from '@/app/store/ui-store'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
import type { Task, TaskSchedule } from '@/types/domain'

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

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
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

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAY_NAMES_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-destructive/15 border-destructive/30 text-destructive',
  HIGH: 'bg-orange-500/10 border-orange-500/25 text-orange-700 dark:text-orange-400',
  MEDIUM: 'bg-primary/10 border-primary/25 text-primary',
  LOW: 'bg-muted border-muted-foreground/15 text-muted-foreground',
}

// ─── Types ───

interface ScheduleWithTask extends TaskSchedule {
  task?: Task
}

type CalendarView = 'week' | 'month'

// ─── Main Component ───

export function CalendarPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const workspaceId = Number(params.workspaceId)
  const setTaskDrawerTaskId = useUiStore((s) => s.setTaskDrawerTaskId)

  useProjectRealtime(Number.isFinite(workspaceId) ? workspaceId : null, Number.isFinite(projectId) ? projectId : null)

  const [view, setView] = useState<CalendarView>('week')
  const [currentDate, setCurrentDate] = useState(() => new Date())

  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate])

  // Compute date range for API query
  const { fromDate, toDate } = useMemo(() => {
    if (view === 'week') {
      return {
        fromDate: toDateKey(weekStart),
        toDate: toDateKey(addDays(weekStart, 6)),
      }
    }
    // Month view: first day of month to last day of month (with buffer for display)
    const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const last = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    // Extend to cover full weeks
    const displayStart = startOfWeek(first)
    const displayEndDate = addDays(startOfWeek(addDays(last, 6)), 6)
    return {
      fromDate: toDateKey(displayStart),
      toDate: toDateKey(displayEndDate),
    }
  }, [view, weekStart, currentDate])

  // Fetch schedules
  const schedulesQuery = useQuery({
    queryKey: queryKeys.schedules.projectCalendar(projectId, fromDate, toDate, 1, 500),
    queryFn: () => taskScheduleApi.projectCalendar(projectId, fromDate, toDate, { page: 1, size: 500 }),
    enabled: Number.isFinite(projectId),
  })

  // Fetch tasks for the project to join with schedules
  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.byProject(projectId, 1, 500),
    queryFn: () => taskApi.listByProject(projectId, { page: 1, size: 500 }),
    enabled: Number.isFinite(projectId),
  })

  // Join schedules with task data
  const enrichedSchedules = useMemo<ScheduleWithTask[]>(() => {
    const schedules = schedulesQuery.data?.content ?? []
    const tasks = tasksQuery.data?.content ?? []
    const taskMap = new Map(tasks.map((t) => [t.id, t]))
    return schedules.map((s) => ({ ...s, task: taskMap.get(s.taskId) }))
  }, [schedulesQuery.data, tasksQuery.data])

  // Group schedules by date key
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, ScheduleWithTask[]>()
    for (const s of enrichedSchedules) {
      const key = toDateKey(new Date(s.scheduledStart))
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  }, [enrichedSchedules])

  const isLoading = schedulesQuery.isLoading || tasksQuery.isLoading

  // Navigation
  const goToday = () => setCurrentDate(new Date())
  const goPrev = () => {
    if (view === 'week') setCurrentDate(addDays(weekStart, -7))
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }
  const goNext = () => {
    if (view === 'week') setCurrentDate(addDays(weekStart, 7))
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const headerTitle = view === 'week' ? formatWeekRange(weekStart) : formatMonthYear(currentDate)

  if (isLoading) return <LoadingPanel />

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lịch"
        description="Lịch biểu task theo tuần hoặc tháng"
        actions={
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
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

      {/* Calendar views */}
      {view === 'week' ? (
        <WeekView
          weekStart={weekStart}
          schedulesByDate={schedulesByDate}
          onEventClick={(s) => setTaskDrawerTaskId(s.taskId)}
        />
      ) : (
        <MonthView
          currentDate={currentDate}
          schedulesByDate={schedulesByDate}
          onEventClick={(s) => setTaskDrawerTaskId(s.taskId)}
        />
      )}
    </div>
  )
}

// ─── Week View (Google Calendar-like time grid) ───

interface WeekViewProps {
  weekStart: Date
  schedulesByDate: Map<string, ScheduleWithTask[]>
  onEventClick: (schedule: ScheduleWithTask) => void
}

function WeekView({ weekStart, schedulesByDate, onEventClick }: WeekViewProps) {
  const today = new Date()
  const now = new Date()
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Day header row */}
      <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-border bg-muted/30">
        <div className="border-r border-border" />
        {days.map((day, i) => {
          const isToday = isSameDay(day, today)
          return (
            <div
              key={i}
              className={cn(
                'flex flex-col items-center py-2.5 text-center',
                i < 6 && 'border-r border-border',
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {DAY_NAMES_SHORT[i]}
              </span>
              <span
                className={cn(
                  'mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold',
                  isToday && 'bg-primary text-primary-foreground',
                )}
              >
                {day.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="relative max-h-[calc(100dvh-16rem)] overflow-y-auto">
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)]">
          {/* Time labels + grid lines */}
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              {/* Time label */}
              <div className="relative h-12 border-r border-border">
                {hour > 0 && (
                  <span className="absolute -top-2.5 right-2 text-[10px] text-muted-foreground">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                )}
              </div>
              {/* Day cells */}
              {days.map((_, dayIdx) => (
                <div
                  key={dayIdx}
                  className={cn(
                    'h-12 border-b border-border/50',
                    dayIdx < 6 && 'border-r border-border/50',
                    hour === 0 && 'border-t-0',
                  )}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Event overlays */}
        <div className="absolute inset-0 grid grid-cols-[3.5rem_repeat(7,1fr)] pointer-events-none">
          <div />
          {days.map((day, dayIdx) => {
            const dateKey = toDateKey(day)
            const daySchedules = schedulesByDate.get(dateKey) ?? []
            return (
              <div key={dayIdx} className="relative">
                {daySchedules.map((schedule) => {
                  const start = new Date(schedule.scheduledStart)
                  const end = new Date(schedule.scheduledEnd)
                  const startMinutes = start.getHours() * 60 + start.getMinutes()
                  const endMinutes = end.getHours() * 60 + end.getMinutes()
                  const duration = Math.max(endMinutes - startMinutes, 15)
                  const topPx = (startMinutes / 60) * 48 // 48px per hour (h-12)
                  const heightPx = (duration / 60) * 48
                  const priority = schedule.task?.priority ?? 'MEDIUM'
                  const colorClass = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.MEDIUM

                  return (
                    <Tooltip key={schedule.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onEventClick(schedule)}
                          className={cn(
                            'pointer-events-auto absolute inset-x-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-left transition-all hover:shadow-md hover:ring-1 hover:ring-primary/30',
                            colorClass,
                          )}
                          style={{ top: `${topPx}px`, height: `${Math.max(heightPx, 20)}px` }}
                        >
                          <p className="truncate text-[11px] font-medium leading-tight">
                            {schedule.task?.title ?? `Task #${schedule.taskId}`}
                          </p>
                          {heightPx > 28 && (
                            <p className="mt-0.5 truncate text-[10px] opacity-70">
                              {String(start.getHours()).padStart(2, '0')}:{String(start.getMinutes()).padStart(2, '0')}
                              {' – '}
                              {String(end.getHours()).padStart(2, '0')}:{String(end.getMinutes()).padStart(2, '0')}
                            </p>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{schedule.task?.title ?? `Task #${schedule.taskId}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(schedule.scheduledStart).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(schedule.scheduledEnd).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Current time indicator line */}
        {days.some((d) => isSameDay(d, today)) && (() => {
          const todayIdx = days.findIndex((d) => isSameDay(d, today))
          const nowMinutes = now.getHours() * 60 + now.getMinutes()
          const topPx = (nowMinutes / 60) * 48
          return (
            <div
              className="absolute left-0 right-0 z-10 pointer-events-none"
              style={{ top: `${topPx}px` }}
            >
              <div className="grid grid-cols-[3.5rem_repeat(7,1fr)]">
                <div />
                {days.map((_, i) =>
                  i === todayIdx ? (
                    <div key={i} className="relative">
                      <div className="absolute -left-1 -top-1 size-2.5 rounded-full bg-destructive" />
                      <div className="h-px bg-destructive" />
                    </div>
                  ) : (
                    <div key={i} />
                  ),
                )}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ─── Month View ───

interface MonthViewProps {
  currentDate: Date
  schedulesByDate: Map<string, ScheduleWithTask[]>
  onEventClick: (schedule: ScheduleWithTask) => void
}

function MonthView({ currentDate, schedulesByDate, onEventClick }: MonthViewProps) {
  const today = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Build calendar grid
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const gridStart = startOfWeek(firstDay)

  // Calculate number of weeks needed
  const totalDays = Math.ceil((lastDay.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const weeks = Math.ceil(totalDays / 7)

  const allDays = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i))
  const rows = Array.from({ length: weeks }, (_, w) => allDays.slice(w * 7, (w + 1) * 7))

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {DAY_NAMES_SHORT.map((name) => (
          <div key={name} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {name}
          </div>
        ))}
      </div>

      {/* Day cells */}
      {rows.map((week, wi) => (
        <div key={wi} className={cn('grid grid-cols-7', wi < rows.length - 1 && 'border-b border-border')}>
          {week.map((day, di) => {
            const dateKey = toDateKey(day)
            const isCurrentMonth = day.getMonth() === month
            const isToday = isSameDay(day, today)
            const daySchedules = (schedulesByDate.get(dateKey) ?? []).slice(0, 3)
            const overflow = (schedulesByDate.get(dateKey) ?? []).length - 3

            return (
              <div
                key={di}
                className={cn(
                  'min-h-24 p-1.5',
                  di < 6 && 'border-r border-border',
                  !isCurrentMonth && 'bg-muted/20',
                )}
              >
                <span
                  className={cn(
                    'mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium',
                    isToday && 'bg-primary text-primary-foreground',
                    !isToday && isCurrentMonth && 'text-foreground',
                    !isToday && !isCurrentMonth && 'text-muted-foreground/50',
                  )}
                >
                  {day.getDate()}
                </span>
                <div className="space-y-0.5">
                  {daySchedules.map((schedule) => {
                    const priority = schedule.task?.priority ?? 'MEDIUM'
                    const colorClass = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.MEDIUM
                    return (
                      <button
                        key={schedule.id}
                        onClick={() => onEventClick(schedule)}
                        className={cn(
                          'flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium leading-tight transition-all hover:shadow-sm',
                          colorClass,
                        )}
                      >
                        <span className="truncate">
                          {schedule.task?.title ?? `Task #${schedule.taskId}`}
                        </span>
                      </button>
                    )
                  })}
                  {overflow > 0 && (
                    <p className="px-1 text-[10px] text-muted-foreground">+{overflow} khác</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
