import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { CheckCircle2, Columns3, Target, CalendarDays, Activity, ArrowRight, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
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
        <p className="text-sm text-muted-foreground">Project không tồn tại.</p>
        <Link to={`/workspaces/${workspaceId}`} className="mt-2 text-sm text-primary hover:underline">Quay lại workspace</Link>
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

  const quickLinks = [
    { to: `${base}/kanban`, icon: Columns3, label: 'Kanban Board', desc: 'Quản lý task theo cột trạng thái' },
    { to: `${base}/goals`, icon: Target, label: 'Goals', desc: 'Mục tiêu ngắn hạn và dài hạn' },
    { to: `${base}/calendar`, icon: CalendarDays, label: 'Lịch', desc: 'Lịch task schedule theo ngày' },
    { to: `${base}/activity`, icon: Activity, label: 'Hoạt động', desc: 'Lịch sử hành động trong project' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={project.description || `Tạo bởi ${project.createdBy.firstName} ${project.createdBy.lastName}`}
        actions={<ProjectNavTabs workspaceId={workspaceId} projectId={projectId} />}
      />

      <div className="flex items-center gap-3">
        <Badge variant={statusBadgeVariant[project.status] ?? 'outline'}>{project.status}</Badge>
        <span className="text-xs text-muted-foreground">
          Tạo bởi {project.createdBy.firstName} {project.createdBy.lastName}
        </span>
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
                <p className="text-xs text-muted-foreground">Tổng tasks</p>
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
                <p className="text-xs text-muted-foreground">Hoàn thành</p>
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
                <p className="text-xs text-muted-foreground">Cột kanban</p>
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
                <p className="text-xs text-muted-foreground">Goals</p>
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
            <p className="text-sm font-medium">Tiến độ dự án</p>
            <p className="text-sm font-semibold text-primary">{completionRate}%</p>
          </div>
          <Progress value={completionRate} className="h-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            {completedTasks} / {tasks.length} tasks hoàn thành
          </p>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Chuyển nhanh</h3>
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

      {/* Kanban columns breakdown */}
      {statuses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Phân bổ theo cột</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {statuses.map((status) => {
                const count = tasks.filter((t) => t.status.id === status.id).length
                const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0
                return (
                  <div key={status.id} className="flex items-center gap-3">
                    <span className="w-28 truncate text-sm">{status.name}</span>
                    <Progress value={pct} className="h-1.5 flex-1" />
                    <span className="w-12 text-right text-xs text-muted-foreground">{count} tasks</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ProjectNavTabs({ workspaceId, projectId }: { workspaceId: number; projectId: number }) {
  const location = useLocation()
  const base = `/workspaces/${workspaceId}/projects/${projectId}`

  const tabs = [
    { value: 'overview', to: base, label: 'Tổng quan' },
    { value: 'kanban', to: `${base}/kanban`, label: 'Kanban' },
    { value: 'goals', to: `${base}/goals`, label: 'Goals' },
    { value: 'calendar', to: `${base}/calendar`, label: 'Lịch' },
    { value: 'activity', to: `${base}/activity`, label: 'Hoạt động' },
  ]

  const current = tabs.find((t) => t.to === location.pathname)?.value ?? 'overview'

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button asChild variant="outline" size="sm">
        <Link to={`/workspaces/${workspaceId}`}>
          <ArrowLeft className="mr-1.5 size-3.5" />
          Quay lại workspace
        </Link>
      </Button>

      <Tabs value={current}>
        <TabsList>
          {tabs.map((tab) => (
            <Link key={tab.value} to={tab.to}>
              <TabsTrigger value={tab.value} className="pointer-events-none">{tab.label}</TabsTrigger>
            </Link>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
