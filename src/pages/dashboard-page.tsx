import { useQuery } from '@tanstack/react-query'
import { Bell, PanelsTopLeft, FolderKanban } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { notificationApi } from '@/lib/api/modules/notification-api'
import { queryKeys } from '@/lib/api/query-keys'

export function DashboardPage() {
  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspaces.list(1, 6),
    queryFn: () => workspaceApi.list({ page: 1, size: 6 }),
  })

  const notificationCountQuery = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: notificationApi.unreadCount,
  })

  if (workspaceQuery.isLoading) {
    return <LoadingPanel />
  }

  const workspaceCount = workspaceQuery.data?.meta.totalElements ?? 0
  const projectCount = workspaceQuery.data?.content.length ?? 0
  const unreadCount = notificationCountQuery.data?.unreadCount ?? 0

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" description="Tong quan workspace va hoat dong moi nhat" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={PanelsTopLeft} label="Workspace" value={workspaceCount} helper="Tong workspace dang truy cap" />
        <StatCard icon={FolderKanban} label="Dang hien thi" value={projectCount} helper="So workspace dang hien tren trang" />
        <StatCard icon={Bell} label="Thong bao chua doc" value={unreadCount} helper="Dong bo realtime tu backend" />
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof PanelsTopLeft
  label: string
  value: number
  helper: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <Icon className="size-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}
