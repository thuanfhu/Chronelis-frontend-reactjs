import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase,
  CircleAlert,
  Clock3,
  Target,
  Sparkles,
  CalendarClock,
  ArrowRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useUiStore } from '@/app/store/ui-store'
import { taskApi } from '@/lib/api/modules/task-api'
import { projectApi } from '@/lib/api/modules/project-api'
import { queryKeys } from '@/lib/api/query-keys'
import { formatDateTime } from '@/lib/utils/datetime'
import { TaskBlockerBadge } from '@/features/tasks/task-blocker-badge'
import { TaskPriorityBadge } from '@/features/tasks/task-priority-badge'
import type { MyWorkScheduleItem, Task } from '@/types/domain'

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

export function MyWorkPage() {
  const navigate = useNavigate()
  const openTaskDrawer = useUiStore((state) => state.openTaskDrawer)
  const openAIAssistant = useUiStore((state) => state.openAIAssistant)

  const myWorkQuery = useQuery({
    queryKey: queryKeys.tasks.myWork,
    queryFn: taskApi.myWork,
  })

  const uniqueProjectIds = useMemo(() => {
    const ids = new Set<number>()
    for (const task of myWorkQuery.data?.assignedTasks ?? []) {
      ids.add(task.projectId)
    }
    for (const schedule of myWorkQuery.data?.upcomingSchedules ?? []) {
      ids.add(schedule.task.projectId)
    }
    return [...ids]
  }, [myWorkQuery.data?.assignedTasks, myWorkQuery.data?.upcomingSchedules])

  const projectDirectoryQuery = useQuery({
    queryKey: ['projects', 'directory', uniqueProjectIds.join(',')],
    enabled: uniqueProjectIds.length > 0,
    queryFn: async () => {
      const directory = new Map<number, string>()
      const projects = await Promise.all(uniqueProjectIds.map((projectId) => projectApi.detail(projectId)))
      for (const project of projects) {
        directory.set(project.id, project.name)
      }
      return directory
    },
    staleTime: 60_000,
  })

  const assignedTasks = myWorkQuery.data?.assignedTasks ?? []
  const blockedTasks = useMemo(
    () => assignedTasks
      .filter((task) => task.blocked)
      .sort((left, right) => priorityRank(right) - priorityRank(left)),
    [assignedTasks],
  )
  const readyTasks = useMemo(
    () => assignedTasks
      .filter((task) => !task.blocked)
      .sort(compareActiveTasks),
    [assignedTasks],
  )
  const upcomingSchedules = myWorkQuery.data?.upcomingSchedules ?? []

  const goToFocusMode = (task: Task) => {
    navigate(`/workspaces/${task.workspaceId}/projects/${task.projectId}/focus/${task.id}`)
  }

  const openPlanning = (task: Task) => {
    openAIAssistant({
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      prompt: `Đề xuất bước tiếp theo cho task \"${task.title}\", nêu blocker đang tồn tại và các cập nhật nên áp dụng trong project hiện tại.`,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Work"
        description="Một nơi để xử lý việc đang phụ trách, blocker cần tháo gỡ và các phiên làm việc sắp tới."
        actions={
          <Button variant="outline" className="gap-1.5" onClick={() => myWorkQuery.refetch()}>
            <ArrowRight className="size-4" />
            Làm mới
          </Button>
        }
      />

      {myWorkQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-3xl" />
          ))}
        </div>
      ) : null}

      {myWorkQuery.data ? (
        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.06 }}
          className="space-y-6"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Briefcase} label="Assigned" value={myWorkQuery.data.assignedCount} tone="amber" />
            <MetricCard icon={CircleAlert} label="Blocked" value={myWorkQuery.data.blockedCount} tone="rose" />
            <MetricCard icon={Clock3} label="Due Today" value={myWorkQuery.data.dueTodayCount} tone="sky" />
            <MetricCard icon={CalendarClock} label="Upcoming" value={myWorkQuery.data.upcomingScheduledCount} tone="emerald" />
          </div>

          <motion.div variants={itemVariants} className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.95fr)]">
            <Card className="overflow-hidden border-border/70 bg-[linear-gradient(145deg,rgba(251,191,36,0.15),rgba(255,255,255,0.95)_42%,rgba(191,219,254,0.32))] shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] dark:bg-[linear-gradient(145deg,rgba(245,158,11,0.18),rgba(15,23,42,0.94)_50%,rgba(30,64,175,0.22))]">
              <CardContent className="flex h-full flex-col gap-4 p-6">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700/80 dark:text-amber-200">Execution lane</p>
                  <h2 className="text-2xl font-semibold tracking-tight">Ưu tiên xử lý blocker trước, rồi mới vào phiên focus</h2>
                  <p className="text-sm text-muted-foreground">
                    My Work tập hợp việc thật sự cần hành động: task bị chặn, task đã sẵn sàng để tập trung, và lịch gần nhất cần giữ nhịp.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryStrip title="Blocked" description="Tháo gỡ phụ thuộc và blocker note trước khi vào phiên làm việc sâu." value={blockedTasks.length} />
                  <SummaryStrip title="Ready" description="Task đã đủ điều kiện để bật Focus Mode hoặc Pomodoro ngay." value={readyTasks.length} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Lịch gần nhất</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingSchedules.length > 0 ? upcomingSchedules.slice(0, 4).map((schedule) => (
                  <UpcomingScheduleCard
                    key={`${schedule.scheduleId}-${schedule.taskId}`}
                    schedule={schedule}
                    projectName={projectDirectoryQuery.data?.get(schedule.task.projectId)}
                    onFocus={() => goToFocusMode(schedule.task)}
                    onOpen={() => openTaskDrawer(schedule.task.id, 'view')}
                  />
                )) : (
                  <p className="text-sm text-muted-foreground">Chưa có phiên làm việc nào sắp tới trong 14 ngày tới.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid gap-4 xl:grid-cols-2">
            <TaskColumn
              title="Blocked right now"
              emptyLabel="Không có task nào đang bị chặn."
              tasks={blockedTasks}
              projectNames={projectDirectoryQuery.data}
              onOpen={(task) => openTaskDrawer(task.id, 'view')}
              onFocus={goToFocusMode}
              onPlan={openPlanning}
            />

            <TaskColumn
              title="Ready for focus"
              emptyLabel="Chưa có task nào sẵn sàng."
              tasks={readyTasks}
              projectNames={projectDirectoryQuery.data}
              onOpen={(task) => openTaskDrawer(task.id, 'view')}
              onFocus={goToFocusMode}
              onPlan={openPlanning}
            />
          </div>
        </motion.div>
      ) : null}
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Briefcase
  label: string
  value: number
  tone: 'amber' | 'rose' | 'sky' | 'emerald'
}) {
  const toneClassName = {
    amber: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100',
    rose: 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100',
    sky: 'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100',
    emerald: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100',
  }[tone]

  return (
    <motion.div variants={itemVariants}>
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="flex items-center gap-4 p-5">
          <div className={`flex size-12 items-center justify-center rounded-2xl ${toneClassName}`}>
            <Icon className="size-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function SummaryStrip({ title, description, value }: { title: string; description: string; value: number }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background/85 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function UpcomingScheduleCard({
  schedule,
  projectName,
  onOpen,
  onFocus,
}: {
  schedule: MyWorkScheduleItem
  projectName?: string
  onOpen: () => void
  onFocus: () => void
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{schedule.task.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{projectName ?? `Project #${schedule.task.projectId}`}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatDateTime(schedule.scheduledStart)} - {formatDateTime(schedule.scheduledEnd)}
          </p>
        </div>
        <TaskPriorityBadge priority={schedule.task.priority} />
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpen}>
          Mở task
        </Button>
        <Button size="sm" className="gap-1.5" onClick={onFocus}>
          <Target className="size-4" />
          Focus
        </Button>
      </div>
    </div>
  )
}

function TaskColumn({
  title,
  emptyLabel,
  tasks,
  projectNames,
  onOpen,
  onFocus,
  onPlan,
}: {
  title: string
  emptyLabel: string
  tasks: Task[]
  projectNames?: Map<number, string>
  onOpen: (task: Task) => void
  onFocus: (task: Task) => void
  onPlan: (task: Task) => void
}) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="h-full border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.length > 0 ? tasks.map((task) => (
            <TaskExecutionCard
              key={task.id}
              task={task}
              projectName={projectNames?.get(task.projectId)}
              onOpen={() => onOpen(task)}
              onFocus={() => onFocus(task)}
              onPlan={() => onPlan(task)}
            />
          )) : (
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function TaskExecutionCard({
  task,
  projectName,
  onOpen,
  onFocus,
  onPlan,
}: {
  task: Task
  projectName?: string
  onOpen: () => void
  onFocus: () => void
  onPlan: () => void
}) {
  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-background/80 p-4 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.32)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{task.title}</p>
            <Badge variant="outline" className="text-[10px]">#{task.id}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{projectName ?? `Project #${task.projectId}`}</p>
        </div>
        <TaskPriorityBadge priority={task.priority} />
      </div>

      <TaskBlockerBadge task={task} className="mt-3" />

      {task.dueDate ? (
        <p className="mt-3 text-xs text-muted-foreground">Due: {formatDateTime(task.dueDate)}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpen}>
          Mở task
        </Button>
        <Button size="sm" className="gap-1.5" onClick={onFocus}>
          <Target className="size-4" />
          Focus Mode
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onPlan}>
          <Sparkles className="size-4" />
          AI plan
        </Button>
      </div>
    </div>
  )
}

function priorityRank(task: Task) {
  return {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    URGENT: 4,
  }[task.priority]
}

function compareActiveTasks(left: Task, right: Task) {
  const priorityDelta = priorityRank(right) - priorityRank(left)
  if (priorityDelta !== 0) {
    return priorityDelta
  }

  const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY
  const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY
  return leftDue - rightDue
}