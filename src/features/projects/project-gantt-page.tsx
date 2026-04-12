import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  addDays,
  addMonths,
  endOfDay,
  format,
  max as maxDate,
  min as minDate,
  startOfDay,
  subDays,
} from 'date-fns'
import { useParams } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarDays,
  ChartNoAxesGantt,
  Clock3,
  FolderKanban,
  Target,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { useUiStore } from '@/app/store/ui-store'
import { projectApi } from '@/lib/api/modules/project-api'
import { goalApi } from '@/lib/api/modules/goal-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { taskScheduleApi } from '@/lib/api/modules/task-schedule-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
import { GanttChart } from '@/features/projects/gantt-chart'
import type { GanttChartRow } from '@/features/projects/gantt-chart'
import type { Goal, Task, TaskSchedule } from '@/types/domain'

type GoalFilterValue = 'all' | '__ungrouped' | `${number}`

type TimelineWindow = {
  start: Date
  end: Date
  source: 'schedule' | 'dueDate'
}

const PRIORITY_TONE: Record<Task['priority'], string> = {
  LOW: 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/35 dark:bg-emerald-500/20 dark:text-emerald-100',
  MEDIUM: 'border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-400/35 dark:bg-sky-500/20 dark:text-sky-100',
  HIGH: 'border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/25 dark:text-amber-100',
  URGENT: 'border-rose-200 bg-rose-100 text-rose-900 dark:border-rose-400/40 dark:bg-rose-500/25 dark:text-rose-100',
}

const PRIORITY_LABEL: Record<Task['priority'], string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
}

function parseDate(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function formatDateLabel(value?: string | null) {
  const d = parseDate(value)
  if (!d) return 'Chưa đặt'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function formatCompactDate(d: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

function buildTaskWindow(task: Task, schedules: TaskSchedule[]): TimelineWindow | null {
  if (schedules.length > 0) {
    const starts = schedules
      .map((s) => parseDate(s.scheduledStart))
      .filter((v): v is Date => Boolean(v))
    const ends = schedules
      .map((s) => parseDate(s.scheduledEnd))
      .filter((v): v is Date => Boolean(v))
    if (starts.length > 0 && ends.length > 0) {
      const start = minDate(starts)
      const latestEnd = maxDate(ends)
      const end = latestEnd > start ? latestEnd : addDays(start, 1)
      return { start, end, source: 'schedule' }
    }
  }
  const dueDate = parseDate(task.dueDate)
  if (!dueDate) return null
  return { start: startOfDay(dueDate), end: endOfDay(dueDate), source: 'dueDate' }
}

function taskRowId(taskId: number) { return `task-${taskId}` }
function summaryRowId(goalId: number | null) { return goalId == null ? 'summary-ungrouped' : `summary-goal-${goalId}` }
function extractTaskId(rowId: string): number | null {
  if (!rowId.startsWith('task-')) return null
  const n = Number(rowId.slice(5))
  return Number.isFinite(n) ? n : null
}

export function ProjectGanttPage() {
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)
  const openTaskDrawer = useUiStore((state) => state.openTaskDrawer)
  const [goalFilter, setGoalFilter] = useState<GoalFilterValue>('all')
  const [selectedRowId, setSelectedRowId] = useState<string | undefined>()

  useProjectRealtime(
    Number.isFinite(workspaceId) ? workspaceId : null,
    Number.isFinite(projectId) ? projectId : null,
  )

  const projectQuery = useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => projectApi.detail(projectId),
    enabled: Number.isFinite(projectId),
  })

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.byProject(projectId, 1, 500),
    queryFn: () => taskApi.listByProject(projectId, { page: 1, size: 500 }),
    enabled: Number.isFinite(projectId),
  })

  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.byProject(projectId, 1, 200),
    queryFn: () => goalApi.listByProject(projectId, { page: 1, size: 200 }),
    enabled: Number.isFinite(projectId),
  })

  const scheduleRange = useMemo(() => {
    const project = projectQuery.data
    if (!project) return null
    const tasks = tasksQuery.data?.content ?? []
    const dueDates = tasks
      .map((t) => parseDate(t.dueDate))
      .filter((v): v is Date => Boolean(v))
    const projectStart = parseDate(project.createdAt) ?? new Date()
    const anchors = [projectStart, ...dueDates]
    const rangeStart = subDays(minDate(anchors), 45)
    const rangeEnd = addMonths(maxDate([...anchors, new Date()]), 18)
    return { fromDate: formatDateKey(rangeStart), toDate: formatDateKey(rangeEnd) }
  }, [projectQuery.data, tasksQuery.data?.content])

  const schedulesQuery = useQuery({
    queryKey: scheduleRange
      ? queryKeys.schedules.projectCalendar(projectId, scheduleRange.fromDate, scheduleRange.toDate, 1, 2000)
      : ['task-schedules', 'calendar', 'project', projectId, 'gantt:none'],
    queryFn: () => taskScheduleApi.projectCalendar(projectId, scheduleRange!.fromDate, scheduleRange!.toDate, { page: 1, size: 2000 }),
    enabled: Number.isFinite(projectId) && Boolean(scheduleRange),
  })

  const loading = projectQuery.isLoading || tasksQuery.isLoading || goalsQuery.isLoading || schedulesQuery.isLoading

  const tasks = tasksQuery.data?.content ?? []
  const goals = goalsQuery.data?.content ?? []
  const schedules = schedulesQuery.data?.content ?? []

  const schedulesByTaskId = useMemo(() => {
    const map = new Map<number, TaskSchedule[]>()
    for (const s of schedules) {
      const bucket = map.get(s.taskId)
      if (bucket) bucket.push(s)
      else map.set(s.taskId, [s])
    }
    for (const bucket of map.values()) bucket.sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
    return map
  }, [schedules])

  const goalById = useMemo(() => {
    const map = new Map<number, Goal>()
    for (const g of goals) map.set(g.id, g)
    return map
  }, [goals])

  const filteredTasks = useMemo(() => {
    if (goalFilter === 'all') return tasks
    if (goalFilter === '__ungrouped') return tasks.filter((t) => !t.goalId)
    const id = Number(goalFilter)
    return tasks.filter((t) => t.goalId === id)
  }, [goalFilter, tasks])

  const timeline = useMemo(() => {
    const groups = new Map<number | null, { goal: Goal | null; tasks: Array<{ task: Task; window: TimelineWindow }> }>()
    const unscheduled: Task[] = []

    for (const task of filteredTasks) {
      const taskSchedules = schedulesByTaskId.get(task.id) ?? []
      const window = buildTaskWindow(task, taskSchedules)
      if (!window) { unscheduled.push(task); continue }
      const key = task.goalId ?? null
      const existing = groups.get(key)
      if (existing) existing.tasks.push({ task, window })
      else groups.set(key, { goal: key != null ? goalById.get(key) ?? null : null, tasks: [{ task, window }] })
    }

    const rows: GanttChartRow[] = []
    const sorted = [...groups.entries()].sort(([lId, lG], [rId, rG]) => {
      if (lId == null) return 1
      if (rId == null) return -1
      return (lG.goal?.title ?? '').localeCompare(rG.goal?.title ?? '', 'vi')
    })

    for (const [goalId, group] of sorted) {
      const entries = [...group.tasks].sort((a, b) => a.window.start.getTime() - b.window.start.getTime())
      const start = minDate(entries.map((e) => e.window.start))
      const end = maxDate(entries.map((e) => e.window.end))
      const completedCount = entries.filter((e) => e.task.isCompleted).length
      const summaryProgress = entries.length > 0 ? Math.round((completedCount / entries.length) * 100) : 0
      const summaryId = summaryRowId(goalId)

      rows.push({
        id: summaryId,
        label: group.goal?.title ?? 'Không có goal',
        start,
        end,
        type: 'goal',
        progress: group.goal ? Math.round(group.goal.progressPercent) : summaryProgress,
        isCompleted: summaryProgress === 100,
        details: goalId == null
          ? `${entries.length} task không gán goal đang có lịch`
          : `${entries.length} task trong goal này đang có mốc thời gian`,
      })

      for (const { task, window } of entries) {
        rows.push({
          id: taskRowId(task.id),
          parent: summaryId,
          label: task.title,
          start: window.start,
          end: window.end,
          type: window.source === 'dueDate' ? 'milestone' : 'task',
          progress: task.isCompleted ? 100 : 0,
          priority: task.priority,
          isCompleted: task.isCompleted,
          chronelisTaskId: task.id,
          details: `${task.status.name} · ${window.source === 'schedule' ? 'Lịch task' : 'Fallback due date'}`,
        })
      }
    }

    return { rows, unscheduled }
  }, [filteredTasks, goalById, schedulesByTaskId])

  const scheduledTaskCount = timeline.rows.filter((r) => r.type === 'task' || r.type === 'milestone').length
  const completedCount = filteredTasks.filter((t) => t.isCompleted).length
  const completionRate = filteredTasks.length > 0 ? Math.round((completedCount / filteredTasks.length) * 100) : 0

  const selectedTask = useMemo(() => {
    if (!selectedRowId) return null
    const taskId = extractTaskId(selectedRowId)
    if (!taskId) return null
    return tasks.find((t) => t.id === taskId) ?? null
  }, [selectedRowId, tasks])

  if (loading) return <LoadingPanel />

  if (!projectQuery.data) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-sm text-muted-foreground">
        Không tìm thấy project để hiển thị Gantt.
      </div>
    )
  }

  const scheduleOverflow = (schedulesQuery.data?.meta.totalElements ?? 0) > schedules.length
  const taskOverflow = (tasksQuery.data?.meta.totalElements ?? 0) > tasks.length

  return (
    <div className="space-y-5 pb-2">
      <PageHeader
        title="Gantt dự án"
        description={`Timeline được tổng hợp từ task schedule và due date của ${projectQuery.data.name}.`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Select value={goalFilter} onValueChange={(v) => setGoalFilter(v as GoalFilterValue)}>
              <SelectTrigger className="h-9 min-w-52 bg-background">
                <SelectValue placeholder="Lọc theo goal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả goals</SelectItem>
                <SelectItem value="__ungrouped">Không có goal</SelectItem>
                {goals.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTask ? (
              <Button size="sm" onClick={() => openTaskDrawer(selectedTask.id, 'view')}>
                Mở task đã chọn
              </Button>
            ) : null}
          </div>
        )}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-card/90">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ChartNoAxesGantt className="size-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Thanh timeline</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{scheduledTaskCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Lịch được đọc</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{schedules.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                <FolderKanban className="size-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Backlog chưa lên lịch</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{timeline.unscheduled.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                <Target className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tiến độ bộ lọc</p>
                  <span className="text-sm font-semibold text-foreground">{completionRate}%</span>
                </div>
                <Progress value={completionRate} className="mt-2 h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(scheduleOverflow || taskOverflow) && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            {taskOverflow && <p>Project hiện có nhiều hơn 500 task. Gantt đang hiển thị giới hạn để giữ hiệu năng.</p>}
            {scheduleOverflow && <p>Khoảng timeline đang tải tối đa 2000 lịch. Nếu dự án rất lớn, một phần lịch xa hơn có thể chưa hiện.</p>}
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Timeline triển khai</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Goal dùng làm summary row, task có lịch sẽ dùng mốc schedule, task không có lịch sẽ fallback sang due date.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1.5">
                  <span className="inline-block size-2 rounded-full bg-violet-500" />
                  Goal
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <span className="inline-block h-2 w-2 rotate-45 bg-amber-500" />
                  Milestone
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <span className="inline-block size-2 rounded-full bg-sky-500" />
                  Task
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {timeline.rows.length > 0 ? (
              <div className="h-130">
                <GanttChart
                  rows={timeline.rows}
                  selectedId={selectedRowId}
                  onRowClick={(rowId, taskId) => {
                    setSelectedRowId((prev) => (prev === rowId ? undefined : rowId))
                    if (taskId == null) return
                  }}
                />
              </div>
            ) : (
              <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Clock3 className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-medium text-foreground">Chưa có task nào lên được timeline</p>
                  <p className="text-sm text-muted-foreground">
                    Thêm task schedule trong Calendar hoặc đặt due date để đưa task vào Gantt.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Task đang chọn</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedTask ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">#{selectedTask.id}</Badge>
                      <Badge className={PRIORITY_TONE[selectedTask.priority]}>{PRIORITY_LABEL[selectedTask.priority]}</Badge>
                    </div>
                    <h3 className="text-base font-semibold text-foreground">{selectedTask.title}</h3>
                    <p className="text-sm text-muted-foreground">{selectedTask.description || 'Task này chưa có mô tả.'}</p>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/25 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Goal</span>
                      <span className="max-w-44 truncate font-medium text-foreground">
                        {selectedTask.goalId ? goalById.get(selectedTask.goalId)?.title ?? `Goal #${selectedTask.goalId}` : 'Không có goal'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Trạng thái</span>
                      <span className="font-medium text-foreground">{selectedTask.status.name}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Due date</span>
                      <span className="font-medium text-foreground">{formatDateLabel(selectedTask.dueDate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Người nhận</span>
                      <span className="font-medium text-foreground">
                        {selectedTask.assignee ? `${selectedTask.assignee.firstName} ${selectedTask.assignee.lastName}` : 'Chưa phân công'}
                      </span>
                    </div>
                  </div>

                  <Button className="w-full" onClick={() => openTaskDrawer(selectedTask.id, 'view')}>
                    Mở task drawer
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Chọn một thanh timeline hoặc milestone để xem nhanh chi tiết task.</p>
                  <p>Summary row của goal chỉ dùng để định hướng, không mở drawer.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Backlog chưa lên lịch</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {timeline.unscheduled.length > 0 ? (
                <ScrollArea className="h-96 px-4 pb-4">
                  <div className="space-y-3 pt-1">
                    {timeline.unscheduled.map((task) => (
                      <div key={task.id} className="rounded-2xl border border-border/70 bg-background/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.goalId ? goalById.get(task.goalId)?.title ?? `Goal #${task.goalId}` : 'Không có goal'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Due: {task.dueDate ? formatCompactDate(parseDate(task.dueDate) ?? new Date(task.dueDate)) : 'Chưa đặt'}
                            </p>
                          </div>
                          <Badge className={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
                        </div>
                        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => openTaskDrawer(task.id, 'view')}>
                          Mở task
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  Tất cả task trong bộ lọc hiện tại đã có lịch hoặc due date để đưa lên timeline.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}