import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { notificationApi } from '@/lib/api/modules/notification-api'
import { queryKeys } from '@/lib/api/query-keys'
import { formatDateTime } from '@/lib/utils/datetime'

export function NotificationsPage() {
  const queryClient = useQueryClient()

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications.list(1, 100),
    queryFn: () => notificationApi.list({ page: 1, size: 100 }),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationApi.markOneAsRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(1, 100) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
      toast.success('Da danh dau da doc')
    },
    onError: (error: Error) => {
      toast.error('Danh dau that bai', { description: error.message })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(1, 100) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
      toast.success('Da danh dau tat ca da doc')
    },
    onError: (error: Error) => {
      toast.error('Danh dau tat ca that bai', { description: error.message })
    },
  })

  if (notificationsQuery.isLoading) {
    return <LoadingPanel />
  }

  const notifications = notificationsQuery.data?.content ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Thong bao realtime va thong bao he thong"
        actions={
          <Button onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
            Mark all read
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>My notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Khong co thong bao nao</p>
          ) : (
            notifications.map((notification) => (
              <div key={notification.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{notification.type}</Badge>
                  <Badge variant={notification.isRead ? 'outline' : 'default'}>
                    {notification.isRead ? 'READ' : 'UNREAD'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(notification.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm font-medium">{notification.title}</p>
                <p className="text-sm text-muted-foreground">{notification.message}</p>
                {!notification.isRead ? (
                  <div className="mt-3">
                    <Button size="sm" variant="outline" onClick={() => markReadMutation.mutate(notification.id)}>
                      Mark read
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
