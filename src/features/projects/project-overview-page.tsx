import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { projectApi } from '@/lib/api/modules/project-api'
import { taskStatusApi } from '@/lib/api/modules/task-status-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'

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

  if (projectQuery.isLoading) {
    return <LoadingPanel />
  }

  if (!projectQuery.data) {
    return <div className="text-sm text-muted-foreground">Project khong ton tai.</div>
  }

  const tasks = tasksQuery.data?.content ?? []
  const statuses = statusesQuery.data ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        title={projectQuery.data.name}
        description={`Trang thai: ${projectQuery.data.status}`}
        actions={<ProjectTabs workspaceId={workspaceId} projectId={projectId} />}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <OverviewCard title="Tong tasks" value={tasks.length} />
        <OverviewCard title="Cot kanban" value={statuses.length} />
        <OverviewCard title="Tasks hoan thanh" value={tasks.filter((item) => item.isCompleted).length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chuyen nhanh</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline"><Link to={`/workspaces/${workspaceId}/projects/${projectId}/kanban`}>Kanban board</Link></Button>
          <Button variant="outline"><Link to={`/workspaces/${workspaceId}/projects/${projectId}/goals`}>Goals</Link></Button>
          <Button variant="outline"><Link to={`/workspaces/${workspaceId}/projects/${projectId}/calendar`}>Calendar</Link></Button>
          <Button variant="outline"><Link to={`/workspaces/${workspaceId}/projects/${projectId}/activity`}>Activity log</Link></Button>
        </CardContent>
      </Card>
    </div>
  )
}

function ProjectTabs({ workspaceId, projectId }: { workspaceId: number; projectId: number }) {
  const base = `/workspaces/${workspaceId}/projects/${projectId}`
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm"><Link to={base}>Overview</Link></Button>
      <Button variant="ghost" size="sm"><Link to={`${base}/kanban`}>Kanban</Link></Button>
      <Button variant="ghost" size="sm"><Link to={`${base}/goals`}>Goals</Link></Button>
      <Button variant="ghost" size="sm"><Link to={`${base}/calendar`}>Calendar</Link></Button>
      <Button variant="ghost" size="sm"><Link to={`${base}/activity`}>Activity</Link></Button>
    </div>
  )
}

function OverviewCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}
