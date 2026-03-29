import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bell, CheckCheck, CheckCircle2, MessageSquare, UserPlus, UserMinus,
  ListTodo, Target, ArrowRightLeft, CalendarClock, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { notificationApi } from '@/lib/api/modules/notification-api'
import { queryKeys } from '@/lib/api/query-keys'
import { formatDateTime } from '@/lib/utils/datetime'
import type { NotificationType } from '@/types/domain'

const typeIcons: Record<NotificationType, typeof Bell> = {
  TASK_ASSIGNED: ListTodo,
  TASK_COMMENTED: MessageSquare,
  TASK_RESCHEDULED: CalendarClock,
  TASK_STATUS_CHANGED: ArrowRightLeft,
  GOAL_UPDATED: Target,
  WORKSPACE_MEMBER_ADDED: UserPlus,
  WORKSPACE_MEMBER_REMOVED: UserMinus,
  TASK_CREATED: ListTodo,
  TASK_UPDATED: ListTodo,
  WORKSPACE_INVITE_USED: UserPlus,
}

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
    },
    onError: (error: Error) => {
      toast.error('Đánh dấu thất bại', { description: error.message })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(1, 100) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
      toast.success('Đã đánh dấu tất cả đã đọc')
    },
    onError: (error: Error) => {
      toast.error('Đánh dấu thất bại', { description: error.message })
    },
  })

  if (notificationsQuery.isLoading) {
    return <LoadingPanel />
  }

  const notifications = notificationsQuery.data?.content ?? []
  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thông báo"
        description={`${unreadCount} thông báo chưa đọc`}
        actions={
          <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending || unreadCount === 0}>
            {markAllReadMutation.isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <CheckCheck className="mr-1.5 size-3.5" />}
            Đánh dấu tất cả đã đọc
          </Button>
        }
      />

      {notifications.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">Không có thông báo nào</p>
            <p className="mt-1 text-xs text-muted-foreground">Khi có hoạt động mới, thông báo sẽ xuất hiện ở đây</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const TypeIcon = typeIcons[notification.type] ?? Bell
            return (
              <div
                key={notification.id}
                className={`flex gap-3 rounded-lg border p-4 transition-colors ${notification.isRead ? 'bg-background' : 'border-primary/20 bg-primary/[0.03]'}`}
              >
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${notification.isRead ? 'bg-muted' : 'bg-primary/10'}`}>
                  <TypeIcon className={`size-4 ${notification.isRead ? 'text-muted-foreground' : 'text-primary'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-sm ${notification.isRead ? '' : 'font-medium'}`}>{notification.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{notification.message}</p>
                    </div>
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        onClick={() => markReadMutation.mutate(notification.id)}
                        disabled={markReadMutation.isPending}
                      >
                        <CheckCircle2 className="size-3.5 text-primary" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{notification.type.replaceAll('_', ' ')}</Badge>
                    <span className="text-[10px] text-muted-foreground">{formatDateTime(notification.createdAt)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
