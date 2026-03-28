import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { activityLogApi } from '@/lib/api/modules/activity-log-api'
import { queryKeys } from '@/lib/api/query-keys'
import { formatDateTime } from '@/lib/utils/datetime'

export function ActivityLogPage() {
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)

  const logsQuery = useQuery({
    queryKey: queryKeys.activityLogs.byWorkspace(workspaceId, `project:${projectId}`, 1, 100),
    queryFn: () =>
      activityLogApi.listByWorkspace(workspaceId, {
        page: 1,
        size: 100,
      }),
    enabled: Number.isFinite(workspaceId),
  })

  if (logsQuery.isLoading) {
    return <LoadingPanel />
  }

  const logs = logsQuery.data?.content ?? []

  return (
    <div className="space-y-5">
      <PageHeader title="Activity Logs" description="Lich su hanh dong trong project" />

      <Card>
        <CardHeader>
          <CardTitle>Recent activities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chua co activity nao</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{log.actionType}</Badge>
                  <Badge variant="secondary">{log.targetType}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm">{log.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">Actor: {log.actor.firstName} {log.actor.lastName}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
