import { useCallback } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/api/query-keys'
import { useRealtimeConnection, useRealtimeSubscription } from '@/lib/websocket/use-realtime'

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  useRealtimeConnection()

  const handleNotification = useCallback(
    (rawBody: string) => {
      const parsed = tryParse(rawBody)
      if (parsed?.eventType === 'notification.created') {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        toast.info(t('notification.newTitle'), {
          description: typeof parsed.data === 'object' ? t('notification.newDescription') : undefined,
        })
      }
    },
    [queryClient, t],
  )

  const handleUnreadCount = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
  }, [queryClient])

  const handleWsErrors = useCallback(
    (rawBody: string) => {
      const parsed = tryParse(rawBody)
      const firstError = parsed?.errors?.[0]
      if (firstError?.message) {
        toast.error(t('notification.realtimeErrorTitle'), { description: firstError.message })
      }
    },
    [t],
  )

  useRealtimeSubscription('/client/private/notifications', handleNotification)
  useRealtimeSubscription('/client/private/notifications/unread-count', handleUnreadCount)
  useRealtimeSubscription('/client/private/errors', handleWsErrors)

  return <>{children}</>
}

function tryParse(rawBody: string): any {
  try {
    return JSON.parse(rawBody)
  } catch {
    return null
  }
}
