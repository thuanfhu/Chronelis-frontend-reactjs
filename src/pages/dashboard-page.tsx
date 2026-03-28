import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bell, PanelsTopLeft, FolderKanban, ArrowRight, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { notificationApi } from '@/lib/api/modules/notification-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useAuthStore } from '@/app/store/auth-store'

export function DashboardPage() {
  const currentUser = useAuthStore((state) => state.currentUser)

  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspaces.list(1, 6),
    queryFn: () => workspaceApi.list({ page: 1, size: 6 }),
  })

  const notificationCountQuery = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: notificationApi.unreadCount,
  })

  const workspaces = workspaceQuery.data?.content ?? []
  const workspaceCount = workspaceQuery.data?.meta.totalElements ?? 0
  const unreadCount = notificationCountQuery.data?.unreadCount ?? 0

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Xin chào, ${currentUser?.firstName ?? 'bạn'} 👋`}
        description="Tổng quan hoạt động và workspace của bạn"
      />

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={PanelsTopLeft}
          label="Tổng Workspace"
          value={workspaceQuery.isLoading ? null : workspaceCount}
          accent="bg-primary/10 text-primary"
        />
        <StatCard
          icon={FolderKanban}
          label="Workspace hiển thị"
          value={workspaceQuery.isLoading ? null : workspaces.length}
          accent="bg-accent/20 text-accent-foreground"
        />
        <StatCard
          icon={Bell}
          label="Thông báo chưa đọc"
          value={notificationCountQuery.isLoading ? null : unreadCount}
          accent="bg-destructive/10 text-destructive"
        />
      </div>

      {/* Recent workspaces */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Workspaces gần đây</h2>
          <Link to="/workspaces">
            <Button variant="ghost" size="sm">
              Xem tất cả <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </Link>
        </div>

        {workspaceQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <PanelsTopLeft className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">Chưa có workspace nào</p>
              <p className="mt-1 text-xs text-muted-foreground/70">Tạo workspace đầu tiên để bắt đầu</p>
              <Link to="/workspaces" className="mt-4">
                <Button size="sm">
                  <Plus className="mr-1.5 size-3.5" />
                  Tạo workspace
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {workspaces.map((ws) => (
              <Link key={ws.id} to={`/workspaces/${ws.id}`}>
                <Card className="group transition-all hover:border-primary/30 hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        {ws.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{ws.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Owner: {ws.owner.firstName} {ws.owner.lastName}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Tạo lúc: {new Date(ws.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof PanelsTopLeft
  label: string
  value: number | null
  accent: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {value === null ? (
            <Skeleton className="mt-1 h-7 w-12" />
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
