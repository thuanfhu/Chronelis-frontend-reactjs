import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { activityLogApi } from '@/lib/api/modules/activity-log-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
import { formatDateTime } from '@/lib/utils/datetime'

const actionBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  CREATED: 'default',
  UPDATED: 'secondary',
  DELETED: 'destructive',
  ADDED: 'default',
  REMOVED: 'destructive',
}

function getActionVariant(action: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  for (const [key, variant] of Object.entries(actionBadgeVariant)) {
    if (action.includes(key)) return variant
  }
  return 'outline'
}

export function ActivityLogPage() {
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)

  useProjectRealtime(Number.isFinite(workspaceId) ? workspaceId : null, Number.isFinite(projectId) ? projectId : null)

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
    <div className="space-y-6">
      <PageHeader title="Hoạt động" description="Lịch sử hành động trong project" />

      {logs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">Chưa có hoạt động nào</p>
            <p className="mt-1 text-xs text-muted-foreground">Khi có hành động mới, chúng sẽ hiển thị ở đây</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative ml-4 border-l-2 border-muted">
          {logs.map((log) => (
            <div key={log.id} className="relative pb-6 pl-6 last:pb-0">
              {/* Timeline dot */}
              <div className="absolute -left-[9px] top-0.5 size-4 rounded-full border-2 border-background bg-primary/60" />

              <div className="flex gap-3">
                <Avatar className="mt-0.5 size-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                    {log.actor.firstName.charAt(0)}{log.actor.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{log.actor.firstName} {log.actor.lastName}</span>
                    <Badge variant={getActionVariant(log.actionType)} className="text-[10px]">
                      {log.actionType.replaceAll('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {log.targetType}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{log.description}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
