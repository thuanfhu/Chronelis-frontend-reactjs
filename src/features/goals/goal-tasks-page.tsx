import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Search,
  Target,
  Timer,
  Clock,
  Milestone,
  CircleDashed,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  User,
  ArrowUpDown,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { goalApi } from '@/lib/api/modules/goal-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useUiStore } from '@/app/store/ui-store'
import type { GoalStatusType, GoalType, Task, TaskPriorityType } from '@/types/domain'

const goalTypeConfig: Record<GoalType, { label: string; icon: typeof Timer; color: string }> = {
  SHORT_TERM: { label: 'Ngắn hạn', icon: Timer, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  MEDIUM_TERM: { label: 'Trung hạn', icon: Clock, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  LONG_TERM: { label: 'Dài hạn', icon: Milestone, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
}

const goalStatusConfig: Record<GoalStatusType, { label: string; icon: typeof CircleDashed; className: string }> = {
  NOT_STARTED: {
    label: 'Chưa bắt đầu',
    icon: CircleDashed,
    className: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-100',
  },
  IN_PROGRESS: {
    label: 'Đang thực hiện',
    icon: PlayCircle,
    className: 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-100',
  },
  ON_HOLD: {
    label: 'Tạm dừng',
    icon: PauseCircle,
    className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-100',
  },
  COMPLETED: {
    label: 'Hoàn thành',
    icon: CheckCircle2,
    className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-100',
  },
}

const priorityConfig: Record<TaskPriorityType, { label: string; className: string; icon: string }> = {
  LOW: { label: 'Thấp', className: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300', icon: '·' },
  MEDIUM: { label: 'Vừa', className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300', icon: '↑' },
  HIGH: { label: 'Cao', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300', icon: '↑↑' },
  URGENT: { label: 'Khẩn cấp', className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300', icon: '!!!' },
}

type SortKey = 'status' | 'priority' | 'created' | 'title' | 'dueDate'

const PRIORITY_ORDER: Record<TaskPriorityType, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const PAGE_SIZE = 25

function compareTasks(a: Task, b: Task, sortBy: SortKey): number {
  switch (sortBy) {
    case 'status':
      if (a.status.position !== b.status.position) return a.status.position - b.status.position
      return a.boardPosition - b.boardPosition
    case 'priority':
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    case 'created':
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    case 'title':
      return a.title.localeCompare(b.title, 'vi')
    case 'dueDate': {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    }
    default:
      return 0
  }
}

export function GoalTasksPage() {
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)
  const goalId = Number(params.goalId)

  const openTaskDrawer = useUiStore((s) => s.openTaskDrawer)

  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityType | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL')
  const [sortBy, setSortBy] = useState<SortKey>('status')
  const [page, setPage] = useState(1)

  const goalQuery = useQuery({
    queryKey: queryKeys.goals.detail(goalId),
    queryFn: () => goalApi.detail(goalId),
    enabled: Number.isFinite(goalId),
  })

  // Load all tasks for this goal — API supports pagination but we page client-side for filter+sort
  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.byGoal(goalId, 1, 500),
    queryFn: () => taskApi.listByGoal(goalId, { page: 1, size: 500 }),
    enabled: Number.isFinite(goalId),
  })

  if (goalQuery.isLoading || tasksQuery.isLoading) {
    return <LoadingPanel />
  }

  const goal = goalQuery.data
  const allTasks = tasksQuery.data?.content ?? []

  // Filter
  const filteredTasks = allTasks.filter((task) => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      if (!task.title.toLowerCase().includes(q) && !(task.description?.toLowerCase().includes(q))) {
        return false
      }
    }

    if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) {
      return false
    }

    if (statusFilter === 'OPEN' && task.status.isClosed) return false
    if (statusFilter === 'CLOSED' && !task.status.isClosed) return false

    return true
  })

  // Sort
  const sortedTasks = [...filteredTasks].sort((a, b) => compareTasks(a, b, sortBy))

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedTasks = sortedTasks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const typeConfig = goal ? goalTypeConfig[goal.goalType] : null
  const TypeIcon = typeConfig?.icon ?? Target
  const statusCfg = goal ? goalStatusConfig[goal.status] : null
  const StatusIcon = statusCfg?.icon ?? CircleDashed

  return (
    <div className="space-y-5">
      {/* ─── Back nav + Goal header ─── */}
      <div>
        <Link
          to={`/workspaces/${workspaceId}/projects/${projectId}?view=goals`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Quay lại Goals
        </Link>

        {goal ? (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${typeConfig?.color ?? ''}`}>
                <TypeIcon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base font-semibold">{goal.title}</h1>
                  <span
                    className={`inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[10px] font-semibold ${statusCfg?.className ?? ''}`}
                  >
                    <StatusIcon className="size-3" />
                    {statusCfg?.label}
                  </span>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {typeConfig?.label}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center gap-2 min-w-32">
                    <Progress value={goal.progressPercent} className="h-1.5 flex-1" />
                    <span className="shrink-0 text-xs font-semibold tabular-nums">{goal.progressPercent}%</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ListTodo className="size-3.5" />
                    <span>{allTasks.length} tasks</span>
                  </div>
                  {goal.managerUser && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="size-3" />
                      <span>{goal.managerUser.firstName} {goal.managerUser.lastName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-20 animate-pulse rounded-xl border bg-muted" />
        )}
      </div>

      {/* ─── Filter & Sort toolbar ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            placeholder="Tìm task theo tên, mô tả..."
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v as TaskPriorityType | 'ALL'); setPage(1) }}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Độ ưu tiên" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả độ ưu tiên</SelectItem>
            {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
              <SelectItem key={p} value={p}>{priorityConfig[p].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as 'ALL' | 'OPEN' | 'CLOSED'); setPage(1) }}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
            <SelectItem value="OPEN">Đang mở</SelectItem>
            <SelectItem value="CLOSED">Đã đóng</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <ArrowUpDown className="mr-1.5 size-3" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">Theo trạng thái</SelectItem>
            <SelectItem value="priority">Theo độ ưu tiên</SelectItem>
            <SelectItem value="title">Theo tên A→Z</SelectItem>
            <SelectItem value="dueDate">Theo ngày hết hạn</SelectItem>
            <SelectItem value="created">Theo ngày tạo</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">
          {filteredTasks.length}/{allTasks.length} tasks
        </span>
      </div>

      {/* ─── Task list ─── */}
      {paginatedTasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListTodo className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">
              {allTasks.length === 0 ? 'Goal này chưa có task nào' : 'Không tìm thấy task phù hợp'}
            </p>
            {allTasks.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Gắn task vào goal từ trang Kanban hoặc To-Do</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-[2rem_1fr_8rem_5.5rem_auto_6rem]">
            <span className="text-center">#</span>
            <span>Tên task</span>
            <span className="hidden sm:block">Trạng thái</span>
            <span className="hidden sm:block">Ưu tiên</span>
            <span className="hidden sm:block">Người nhận</span>
            <span className="hidden text-right sm:block">Hết hạn</span>
          </div>

          <div className="divide-y divide-border/40">
            {paginatedTasks.map((task, index) => {
              const pCfg = priorityConfig[task.priority]
              const globalIndex = (currentPage - 1) * PAGE_SIZE + index + 1
              const dueDateStr = task.dueDate
                ? new Date(task.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
                : null
              const isPastDue = task.dueDate && !task.status.isClosed && new Date(task.dueDate) < new Date()

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => openTaskDrawer(task.id)}
                  className="grid w-full grid-cols-[2rem_1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 sm:grid-cols-[2rem_1fr_8rem_5.5rem_auto_6rem]"
                >
                  <span className="text-center text-xs tabular-nums text-muted-foreground/70">{globalIndex}</span>

                  <div className="min-w-0">
                    <p className={`truncate text-sm font-medium leading-snug ${task.status.isClosed ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{task.description}</p>
                    )}
                    {/* mobile-only badges inline */}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:hidden">
                      <span className="rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {task.status.name}
                      </span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${pCfg.className}`}>
                        {pCfg.label}
                      </span>
                      {dueDateStr && (
                        <span className={`text-[10px] ${isPastDue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                          {dueDateStr}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <span className="hidden truncate rounded-md border border-border/70 bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground sm:block">
                    {task.status.name}
                  </span>

                  {/* Priority */}
                  <span className={`hidden rounded-md px-2 py-1 text-[11px] font-semibold sm:block ${pCfg.className}`}>
                    {pCfg.label}
                  </span>

                  {/* Assignee */}
                  <span className="hidden items-center gap-1.5 sm:flex">
                    {task.assignee ? (
                      <Avatar className="size-6 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-[9px] font-bold text-primary">
                          {task.assignee.firstName.charAt(0)}{task.assignee.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span className="inline-flex size-6 items-center justify-center rounded-full border border-dashed border-border/60 text-muted-foreground/40">
                        <User className="size-3" />
                      </span>
                    )}
                  </span>

                  {/* Due date */}
                  <span className={`hidden text-right text-xs tabular-nums sm:block ${isPastDue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                    {dueDateStr ?? <span className="text-muted-foreground/40">—</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Pagination ─── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Trang {currentPage}/{totalPages} · {filteredTasks.length} tasks
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={currentPage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce<(number | '...')[]>((acc, p, i, arr) => {
                if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) {
                  acc.push('...')
                }
                acc.push(p)
                return acc
              }, [])
              .map((item, i) =>
                item === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                ) : (
                  <Button
                    key={item}
                    variant={currentPage === item ? 'default' : 'outline'}
                    size="icon"
                    className="size-8 text-xs"
                    onClick={() => setPage(item as number)}
                  >
                    {item}
                  </Button>
                ),
              )}
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={currentPage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
