import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  Columns3,
  Target,
  CalendarDays,
  Activity,
  ArrowRight,
  TrendingUp,
  BarChart2,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskStatusBarChart } from '@/components/charts/task-status-bar-chart'
import { PriorityPieChart } from '@/components/charts/priority-pie-chart'
import { DailyAreaChart } from '@/components/charts/daily-area-chart'
import { CompletionLineChart } from '@/components/charts/completion-line-chart'
import { ProjectCombinedChart } from '@/components/charts/project-combined-chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { projectApi } from '@/lib/api/modules/project-api'
import { taskStatusApi } from '@/lib/api/modules/task-status-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { goalApi } from '@/lib/api/modules/goal-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  ACTIVE: 'default',
  COMPLETED: 'secondary',
  ARCHIVED: 'outline',
}

export function ProjectOverviewPage() {
  const { t } = useTranslation()
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)

  useProjectRealtime(Number.isFinite(workspaceId) ? workspaceId : null, Number.isFinite(projectId) ? projectId : null)

  const projectQuery = useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => projectApi.detail(projectId),
    enabled: Number.isFinite(projectId),
  })

  const statusesQuery = useQuery({
    queryKey: queryKeys.statuses.byProject(projectId),
    queryFn: () => taskStatusApi.listByProject(projectId),
    enabled: Number.isFinite(projectId),
  })

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.byProject(projectId, 1, 200),
    queryFn: () => taskApi.listByProject(projectId, { page: 1, size: 200 }),
    enabled: Number.isFinite(projectId),
  })

  const analyticsQuery = useQuery({
    queryKey: queryKeys.projects.analytics(projectId),
    queryFn: () => projectApi.analytics(projectId),
    enabled: Number.isFinite(projectId),
    staleTime: 2 * 60_000,
  })

  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.byProject(projectId, 1, 50),
    queryFn: () => goalApi.listByProject(projectId, { page: 1, size: 50 }),
    enabled: Number.isFinite(projectId),
  })

  if (projectQuery.isLoading) {
    return <LoadingPanel />
  }

  if (!projectQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">{t('project.notFound')}</p>
        <Link to={`/workspaces/${workspaceId}`} className="mt-2 text-sm text-primary hover:underline">
          {t('project.backToWorkspace')}
        </Link>
      </div>
    )
  }

  const project = projectQuery.data
  const tasks = tasksQuery.data?.content ?? []
  const statuses = statusesQuery.data ?? []
  const goals = goalsQuery.data?.content ?? []
  const completedTasks = tasks.filter((t) => t.isCompleted).length
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0
  const base = `/workspaces/${workspaceId}/projects/${projectId}`
  const creatorName = `${project.createdBy.firstName} ${project.createdBy.lastName}`
  const quickLinks = [
    { to: `${base}/kanban`, icon: Columns3, label: t('nav.kanban'), desc: t('project.quickLinkKanbanDescription') },
    { to: `${base}/goals`, icon: Target, label: t('nav.goals'), desc: t('project.quickLinkGoalsDescription') },
    {
      to: `${base}/calendar`,
      icon: CalendarDays,
      label: t('nav.calendar'),
      desc: t('project.quickLinkCalendarDescription'),
    },
    {
      to: `${base}/activity`,
      icon: Activity,
      label: t('nav.activity'),
      desc: t('project.quickLinkActivityDescription'),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={project.description || t('project.createdBy', { name: creatorName })}
        actions={<ProjectNavTabs workspaceId={workspaceId} projectId={projectId} />}
      />

      <div className="flex items-center gap-3">
        <Badge variant={statusBadgeVariant[project.status] ?? 'outline'}>
          {t(`project.status.${project.status}`, { defaultValue: project.status })}
        </Badge>
        <span className="text-xs text-muted-foreground">{t('project.createdBy', { name: creatorName })}</span>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Columns3 className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('project.totalTasks')}</p>
                <p className="text-xl font-bold">{tasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/10">
                <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('project.completedTasks')}</p>
                <p className="text-xl font-bold">{completedTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent/20">
                <Columns3 className="size-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('project.kanbanColumns')}</p>
                <p className="text-xl font-bold">{statuses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Target className="size-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('goals.title')}</p>
                <p className="text-xl font-bold">{goals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">{t('project.progressLabel')}</p>
            <p className="text-sm font-semibold text-primary">{completionRate}%</p>
          </div>
          <Progress value={completionRate} className="h-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            {t('project.progressSummary', { completed: completedTasks, total: tasks.length })}
          </p>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div>
        <h3 className="mb-3 text-sm font-medium">{t('project.quickLinksTitle')}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Link key={link.to} to={link.to}>
              <Card className="group h-full transition-all hover:border-primary/30 hover:shadow-sm">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10">
                    <link.icon className="size-4 text-muted-foreground icon-hover-bounce transition-colors group-hover:text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{link.label}</p>
                    <p className="text-xs text-muted-foreground">{link.desc}</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── Charts: 5 diverse types ─── */}
      <div className="space-y-5">
        {/* Row 1: Area + Composed (wide) */}
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          {/* AREA CHART: 30-day task activity */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="size-4 text-indigo-500" />
                  {t('project.charts.activityTitle')}
                </CardTitle>
                {analyticsQuery.isLoading && <Skeleton className="h-4 w-20" />}
              </div>
              <p className="text-xs text-muted-foreground">{t('project.charts.activityDesc')}</p>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <DailyAreaChart data={analyticsQuery.data?.trend ?? []} height={230} />
            </CardContent>
          </Card>

          {/* COMPOSED CHART: created (bars) + completed (line) + cumulative (area) */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="size-4 text-emerald-500" />
                {t('project.charts.volumeTitle')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t('project.charts.volumeDesc')}</p>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <ProjectCombinedChart data={analyticsQuery.data?.trend ?? []} />
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Bar + Pie + Line */}
        <div className="grid gap-5 md:grid-cols-3">
          {/* BAR CHART: tasks per kanban status */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart2 className="size-4 text-indigo-500" />
                {t('project.columnDistribution')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t('project.charts.columnDesc')}</p>
            </CardHeader>
            <CardContent className="pb-3 pt-0">
              {statuses.length > 0 ? (
                <TaskStatusBarChart statuses={statuses} tasks={tasks} />
              ) : (
                <div className="flex h-[200px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">{t('project.charts.noStatuses')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PIE CHART: priority distribution */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <PieChartIcon className="size-4 text-amber-500" />
                {t('project.charts.priorityTitle')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t('project.charts.priorityDesc')}</p>
            </CardHeader>
            <CardContent className="pb-3 pt-0">
              <PriorityPieChart tasks={tasks} />
            </CardContent>
          </Card>

          {/* LINE CHART: completion rate over time */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <LineChartIcon className="size-4 text-purple-500" />
                {t('project.charts.completionTitle')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t('project.charts.completionDesc')}</p>
            </CardHeader>
            <CardContent className="pb-3 pt-0">
              <CompletionLineChart data={analyticsQuery.data?.trend ?? []} mode="cumulative" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ProjectNavTabs({ workspaceId, projectId }: { workspaceId: number; projectId: number }) {
  const { t } = useTranslation()
  const location = useLocation()
  const base = `/workspaces/${workspaceId}/projects/${projectId}`

  const tabs = [
    { value: 'overview', to: base, label: t('nav.overview') },
    { value: 'kanban', to: `${base}/kanban`, label: t('nav.kanban') },
    { value: 'goals', to: `${base}/goals`, label: t('nav.goals') },
    { value: 'calendar', to: `${base}/calendar`, label: t('nav.calendar') },
    { value: 'activity', to: `${base}/activity`, label: t('nav.activity') },
  ]

  const current = tabs.find((t) => t.to === location.pathname)?.value ?? 'overview'

  return (
    <Tabs value={current}>
      <TabsList>
        {tabs.map((tab) => (
          <Link key={tab.value} to={tab.to}>
            <TabsTrigger value={tab.value} className="pointer-events-none">
              {tab.label}
            </TabsTrigger>
          </Link>
        ))}
      </TabsList>
    </Tabs>
  )
}
