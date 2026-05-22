import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { highlightMatch } from '@/lib/utils/highlight-match'
import { motion, AnimatePresence } from 'framer-motion'
import type { TFunction } from 'i18next'

import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Filter,
  Flame,
  LayoutDashboard,
  RefreshCw,
  Rocket,
  Search,
  TrendingUp,
  Workflow,
} from 'lucide-react'
import { TaskHealthDonut } from '@/components/charts/task-health-donut'
import { PriorityBarChart } from '@/components/charts/priority-bar-chart'
import { DailyAreaChart } from '@/components/charts/daily-area-chart'
import { CompletionLineChart } from '@/components/charts/completion-line-chart'
import { PriorityComposedChart } from '@/components/charts/priority-composed-chart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useUiStore } from '@/app/store/ui-store'
import { taskApi } from '@/lib/api/modules/task-api'
import { projectApi } from '@/lib/api/modules/project-api'
import { queryKeys } from '@/lib/api/query-keys'
import { TaskBlockerBadge } from '@/features/tasks/task-blocker-badge'
import { TaskPriorityBadge } from '@/features/tasks/task-priority-badge'
import { cn } from '@/lib/utils/cn'
import type { Task, TaskPriorityType } from '@/types/domain'

/* ─── Animation ────────────────────────────────────────────────────────────── */

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const fadeSlide = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' as const } },
}

const TASKS_PER_PAGE = 5

type SortMode = 'smart' | 'due' | 'recent' | 'title'
type PriorityFilter = 'ALL' | TaskPriorityType

/* ═══════════════════════════════════════════════════════════════════════════ */

export function MyWorkPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const openTaskDrawer = useUiStore((s) => s.openTaskDrawer)

  const [searchValue, setSearchValue] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL')
  const [sortMode, setSortMode] = useState<SortMode>('smart')
  const [blockedPage, setBlockedPage] = useState(1)
  const [readyPage, setReadyPage] = useState(1)

  /* ── Queries ── */

  const analyticsQuery = useQuery({
    queryKey: queryKeys.tasks.analytics,
    queryFn: taskApi.analytics,
    staleTime: 2 * 60_000,
  })

  const myWorkQuery = useQuery({
    queryKey: queryKeys.tasks.myWork,
    queryFn: taskApi.myWork,
  })

  const uniqueProjectIds = useMemo(() => {
    const ids = new Set<number>()
    for (const task of myWorkQuery.data?.assignedTasks ?? []) ids.add(task.projectId)
    return [...ids]
  }, [myWorkQuery.data?.assignedTasks])

  const projectDirQuery = useQuery({
    queryKey: ['projects', 'directory', uniqueProjectIds.join(',')],
    enabled: uniqueProjectIds.length > 0,
    queryFn: async () => {
      const map = new Map<number, string>()
      const list = await Promise.all(uniqueProjectIds.map((id) => projectApi.detail(id)))
      for (const p of list) map.set(p.id, p.name)
      return map
    },
    staleTime: 60_000,
  })

  /* ── Derived ── */

  const assigned = myWorkQuery.data?.assignedTasks ?? []
  const blocked = useMemo(() => assigned.filter((t) => t.blocked), [assigned])
  const ready = useMemo(() => assigned.filter((t) => !t.blocked), [assigned])
  const search = searchValue.trim().toLowerCase()

  const filtBlocked = useMemo(
    () =>
      blocked
        .filter((t) => matchTask(t, search, priorityFilter, projectDirQuery.data))
        .sort((a, b) => cmpTasks(a, b, sortMode)),
    [blocked, search, priorityFilter, projectDirQuery.data, sortMode],
  )
  const filtReady = useMemo(
    () =>
      ready
        .filter((t) => matchTask(t, search, priorityFilter, projectDirQuery.data))
        .sort((a, b) => cmpTasks(a, b, sortMode)),
    [ready, search, priorityFilter, projectDirQuery.data, sortMode],
  )

  const blockedPg = paginate(filtBlocked, blockedPage, TASKS_PER_PAGE)
  const readyPg = paginate(filtReady, readyPage, TASKS_PER_PAGE)
  const topBlockers = useMemo(
    () =>
      blocked
        .slice()
        .sort((a, b) => cmpTasks(a, b, 'smart'))
        .slice(0, 4),
    [blocked],
  )

  /* ── Handlers ── */

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.myWork })
  }

  const hasBlocked = filtBlocked.length > 0
  const hasReady = filtReady.length > 0

  /* ═══ Render ═══ */
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
        className="flex flex-col gap-3 border-b border-border/60 pb-5 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm">
            <LayoutDashboard className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl text-foreground">{t('myWork.title')}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <TrendingUp className="size-3.5 text-emerald-500" />
              {t('myWork.subtitle')
                .split('·')
                .map((part, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded-full bg-muted/80 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                  >
                    {part.trim()}
                  </span>
                ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh}>
            <RefreshCw className={cn('size-3.5', myWorkQuery.isFetching && 'animate-spin')} />
            {myWorkQuery.isFetching ? t('common.refreshing') : t('common.refresh')}
          </Button>
        </div>
      </motion.div>

      {/* ── Loading ── */}
      {myWorkQuery.isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      )}

      {/* ── Body ── */}
      {myWorkQuery.data && (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
          {/* Metric cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Briefcase}
              label={t('myWork.metricAssigned')}
              value={myWorkQuery.data.assignedCount}
              desc={t('myWork.metricAssignedDesc')}
              tone="amber"
            />
            <MetricCard
              icon={CircleAlert}
              label={t('myWork.metricBlocked')}
              value={myWorkQuery.data.blockedCount}
              desc={t('myWork.metricBlockedDesc')}
              tone="rose"
            />
            <MetricCard
              icon={Clock3}
              label={t('myWork.metricAttention')}
              value={myWorkQuery.data.overdueCount + myWorkQuery.data.dueTodayCount}
              desc={t('myWork.metricAttentionDesc')}
              tone="sky"
            />
            <MetricCard
              icon={Workflow}
              label={t('myWork.metricHighPriority')}
              value={myWorkQuery.data.highPriorityCount}
              desc={t('myWork.metricHighPriorityDesc')}
              tone="emerald"
            />
          </div>

          {/* ─── Charts row 1: Area + Composed ─── */}
          <motion.div variants={fadeSlide} className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            {/* AREA CHART: daily task creation trend */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="size-4 text-indigo-500" />
                    {t('myWork.charts.activityTitle')}
                  </CardTitle>
                  {analyticsQuery.isLoading && <Skeleton className="h-4 w-20" />}
                </div>
                <p className="text-xs text-muted-foreground">{t('myWork.charts.activityDesc')}</p>
              </CardHeader>
              <CardContent className="pb-4 pt-0">
                <DailyAreaChart data={analyticsQuery.data?.trend ?? []} />
              </CardContent>
            </Card>

            {/* COMPOSED CHART: estimated hours + task count by priority */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-5">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Flame className="size-4 text-orange-500" />
                  {t('myWork.charts.workloadTitle')}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t('myWork.charts.workloadDesc')}</p>
              </CardHeader>
              <CardContent className="pb-4 pt-0">
                <PriorityComposedChart data={analyticsQuery.data?.estimatedByPriority ?? []} />
              </CardContent>
            </Card>
          </motion.div>

          {/* ─── Charts row 2: Pie + Bar + Line + Blockers ─── */}
          <motion.div variants={fadeSlide} className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_18rem]">
            {/* PIE CHART: task health donut */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  {t('myWork.charts.healthTitle')}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t('myWork.charts.healthDesc')}</p>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <TaskHealthDonut
                  assignedCount={myWorkQuery.data?.assignedCount ?? 0}
                  blockedCount={myWorkQuery.data?.blockedCount ?? 0}
                  overdueCount={myWorkQuery.data?.overdueCount ?? 0}
                  dueTodayCount={myWorkQuery.data?.dueTodayCount ?? 0}
                />
              </CardContent>
            </Card>

            {/* BAR CHART: priority breakdown */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Workflow className="size-4 text-amber-500" />
                  {t('myWork.charts.priorityTitle')}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t('myWork.charts.priorityDesc')}</p>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <PriorityBarChart tasks={assigned} />
              </CardContent>
            </Card>

            {/* LINE CHART: cumulative completions */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Rocket className="size-4 text-purple-500" />
                  {t('myWork.charts.completionTitle')}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t('myWork.charts.completionDesc')}</p>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <CompletionLineChart data={analyticsQuery.data?.trend ?? []} mode="cumulative" />
              </CardContent>
            </Card>

            {/* Blockers digest sidebar */}
            <BlockerDigestCard
              tasks={topBlockers}
              names={projectDirQuery.data}
              onOpen={(t) => openTaskDrawer(t.id, 'view')}
            />
          </motion.div>

          {/* Filter bar */}
          <motion.div variants={fadeSlide}>
            <Card className="border-border/60 shadow-sm">
              <CardContent className="space-y-3.5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Filter className="size-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">{t('myWork.filterTitle')}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {t('myWork.matchingTasks', { count: filtBlocked.length + filtReady.length })}
                  </Badge>
                </div>
                <div className="grid gap-3 xl:grid-cols-[1fr_12rem_12rem]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder={t('myWork.searchPlaceholder')}
                      className="pl-9"
                    />
                  </div>
                  <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('myWork.priorityPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('myWork.allPriorities')}</SelectItem>
                      <SelectItem value="URGENT">{t('task.priorityUrgent')}</SelectItem>
                      <SelectItem value="HIGH">{t('task.priorityHigh')}</SelectItem>
                      <SelectItem value="MEDIUM">{t('task.priorityMedium')}</SelectItem>
                      <SelectItem value="LOW">{t('task.priorityLow')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('myWork.sortPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smart">{t('myWork.smartSort')}</SelectItem>
                      <SelectItem value="due">{t('myWork.dueSort')}</SelectItem>
                      <SelectItem value="recent">{t('myWork.recentSort')}</SelectItem>
                      <SelectItem value="title">{t('myWork.titleSort')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Task queues - adaptive */}
          <div className={cn('grid gap-4', hasBlocked && hasReady && 'xl:grid-cols-2 xl:items-start')}>
            {hasBlocked && (
              <QueueSection
                title={t('myWork.blockedQueue')}
                tone="rose"
                icon={AlertTriangle}
                desc={t('myWork.blockedQueueDesc')}
                empty={t('myWork.emptyBlocked')}
                tasks={blockedPg.items}
                total={filtBlocked.length}
                page={blockedPg.page}
                pages={blockedPg.pages}
                onPage={setBlockedPage}
                names={projectDirQuery.data}
                search={search}
                onOpen={(t) => openTaskDrawer(t.id, 'view')}
              />
            )}
            {hasReady && (
              <QueueSection
                title={t('myWork.readyQueue')}
                tone="emerald"
                icon={Rocket}
                desc={t('myWork.readyQueueDesc')}
                empty={t('myWork.emptyReady')}
                tasks={readyPg.items}
                total={filtReady.length}
                page={readyPg.page}
                pages={readyPg.pages}
                onPage={setReadyPage}
                names={projectDirQuery.data}
                search={search}
                onOpen={(t) => openTaskDrawer(t.id, 'view')}
              />
            )}
            {!hasBlocked && !hasReady && (
              <motion.div variants={fadeSlide}>
                <Card className="border-border/60 shadow-sm">
                  <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/20">
                      <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold">{t('myWork.emptyAllTitle')}</p>
                    <p className="max-w-md text-sm text-muted-foreground">{t('myWork.emptyAllDescription')}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Sub-components                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

function MetricCard({
  icon: Icon,
  label,
  value,
  desc,
  tone,
}: {
  icon: typeof Briefcase
  label: string
  value: number
  desc: string
  tone: 'amber' | 'rose' | 'sky' | 'emerald'
}) {
  const styles = {
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  }[tone]
  return (
    <motion.div variants={fadeSlide}>
      <Card className="border-border/60 shadow-sm">
        <CardContent className="flex gap-4 p-5">
          <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', styles)}>
            <Icon className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-[13px] text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-xs leading-5 text-muted-foreground">{desc}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ── Blocker Digest ── */

function BlockerDigestCard({
  tasks,
  names,
  onOpen,
}: {
  tasks: Task[]
  names?: Map<number, string>
  onOpen: (t: Task) => void
}) {
  const { t } = useTranslation()
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="flex size-6 items-center justify-center rounded-md bg-rose-100 dark:bg-rose-500/20">
            <CircleAlert className="size-3.5 text-rose-600 dark:text-rose-400" />
          </span>
          <span className="text-rose-700 dark:text-rose-300">{t('myWork.blockerDigest')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className="flex w-full items-start justify-between gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2.5 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
              onClick={() => onOpen(task)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{task.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {names?.get(task.projectId) ?? t('myWork.projectFallback', { id: task.projectId })}
                </p>
              </div>
              <TaskPriorityBadge priority={task.priority} />
            </button>
          ))
        ) : (
          <p className="py-2 text-sm text-muted-foreground">{t('myWork.noBlockerDigest')}</p>
        )}
      </CardContent>
    </Card>
  )
}

/* ── Task Queue Section ── */

function QueueSection({
  title,
  tone,
  icon: Icon,
  desc,
  empty,
  tasks,
  total,
  page,
  pages,
  onPage,
  names,
  search,
  onOpen,
}: {
  title: string
  tone: 'rose' | 'emerald'
  icon: typeof AlertTriangle
  desc: string
  empty: string
  tasks: Task[]
  total: number
  page: number
  pages: number
  onPage: (p: number) => void
  names?: Map<number, string>
  search?: string
  onOpen: (t: Task) => void
}) {
  const s = {
    rose: {
      ico: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
      txt: 'text-rose-700 dark:text-rose-300',
      badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
    },
    emerald: {
      ico: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
      txt: 'text-emerald-700 dark:text-emerald-300',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    },
  }[tone]
  return (
    <motion.div variants={fadeSlide}>
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className={cn('flex size-6 items-center justify-center rounded-md', s.ico)}>
                <Icon className="size-3.5" />
              </span>
              <span className={s.txt}>{title}</span>
              <Badge className={cn('text-[10px]', s.badge)}>{total}</Badge>
            </CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">{desc}</p>
          <Pager page={page} pages={pages} onChange={onPage} />
        </CardHeader>
        <CardContent className="space-y-3">
          <AnimatePresence mode="popLayout">
            {tasks.length > 0 ? (
              tasks.map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <TaskCard task={t} projectName={names?.get(t.projectId)} search={search} onOpen={() => onOpen(t)} />
                </motion.div>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function TaskCard({
  task,
  projectName,
  search,
  onOpen,
}: {
  task: Task
  projectName?: string
  search?: string
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const kw = search ?? ''
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm',
        priorityBorder(task.priority),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{highlightMatch(task.title, kw)}</p>
            <Badge variant="outline" className="text-[10px]">
              #{task.id}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {projectName ?? t('myWork.projectFallback', { id: task.projectId })}
          </p>
        </div>
        <TaskPriorityBadge priority={task.priority} />
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs">
        <span
          className={cn('inline-flex items-center rounded-full border px-2 py-0.5 font-medium', dueTone(task.dueDate))}
        >
          <Clock3 className="mr-1 size-3" />
          {fmtDue(task.dueDate, t)}
        </span>
        <Badge variant="outline" className="text-[10px]">
          {task.status.name}
        </Badge>
        {task.sourceView && (
          <Badge variant="secondary" className="text-[10px]">
            {viewLabel(task.sourceView, t)}
          </Badge>
        )}
        {task.estimatedMinutes > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {task.estimatedMinutes} min
          </Badge>
        )}
      </div>

      {task.description?.trim() && (
        <p className="mt-2.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {highlightMatch(task.description, kw)}
        </p>
      )}

      <TaskBlockerBadge task={task} className="mt-2.5" />

      {task.blocked && task.blockedReason?.trim() && (
        <div className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50/90 px-3 py-2.5 text-xs leading-5 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
          {task.blockedReason}
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onOpen}>
          <ArrowUpRight className="size-3.5" />
          {t('myWork.openTask')}
        </Button>
      </div>
    </div>
  )
}

function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  const { t } = useTranslation()
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">{t('myWork.pageOf', { current: page, total: pages })}</p>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="size-3.5" />
          {t('common.previous')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          {t('common.next')}
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Utilities                                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

function matchTask(task: Task, search: string, pf: PriorityFilter, names?: Map<number, string>) {
  if (pf !== 'ALL' && task.priority !== pf) return false
  if (!search) return true
  return [task.title, task.description, task.blockedReason, task.status.name, names?.get(task.projectId)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(search)
}

function cmpTasks(a: Task, b: Task, m: SortMode) {
  if (m === 'title') return a.title.localeCompare(b.title)
  if (m === 'recent') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  if (m === 'due') {
    const d = dueTs(a) - dueTs(b)
    return d !== 0 ? d : pRank(b.priority) - pRank(a.priority)
  }
  const bl = (b.blockedByOpenCount ?? 0) - (a.blockedByOpenCount ?? 0)
  if (bl !== 0 && (a.blocked || b.blocked)) return bl
  const pr = pRank(b.priority) - pRank(a.priority)
  if (pr !== 0) return pr
  const d = dueTs(a) - dueTs(b)
  return d !== 0 ? d : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}

function paginate<T>(items: T[], req: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size))
  const page = Math.min(req, pages)
  const start = (page - 1) * size
  return { items: items.slice(start, start + size), page, pages }
}

function pRank(p: TaskPriorityType) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 }[p]
}
function dueTs(t: Task) {
  return t.dueDate ? new Date(t.dueDate).getTime() : Infinity
}

function fmtDue(d: string | undefined, t: TFunction) {
  if (!d) return t('myWork.noDeadlineSet')
  const due = new Date(d)
  if (Number.isNaN(due.getTime())) return d
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const delta = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000)
  if (delta < 0) return t('myWork.overdue', { count: Math.abs(delta) })
  if (delta === 0) return t('myWork.dueToday')
  if (delta === 1) return t('myWork.dueTomorrow')
  if (delta <= 7) return t('myWork.dueInDays', { count: delta })
  return due.toLocaleDateString(undefined)
}

function dueTone(d?: string) {
  if (!d) return 'border-border/60 bg-background text-muted-foreground'
  const due = new Date(d)
  if (Number.isNaN(due.getTime())) return 'border-border/60 bg-background text-muted-foreground'
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const delta = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000)
  if (delta < 0)
    return 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100'
  if (delta <= 1)
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
  return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100'
}

function priorityBorder(p: TaskPriorityType) {
  return {
    LOW: 'border-l-4 border-l-emerald-400',
    MEDIUM: 'border-l-4 border-l-sky-400',
    HIGH: 'border-l-4 border-l-amber-400',
    URGENT: 'border-l-4 border-l-rose-400',
  }[p]
}

function viewLabel(v: string, t: TFunction) {
  return v === 'KANBAN'
    ? t('task.viewKanban')
    : v === 'CALENDAR'
      ? t('task.viewCalendar')
      : v === 'TODO'
        ? t('task.viewTodo')
        : t('task.viewTask')
}
