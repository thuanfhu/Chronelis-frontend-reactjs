import { useCallback } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/api/query-keys'
import { useRealtimeConnection, useRealtimeSubscription } from '@/lib/websocket/use-realtime'

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  useRealtimeConnection()

  const handleNotification = useCallback(
    (rawBody: string) => {
      const parsed = tryParse(rawBody)
      if (parsed?.eventType === 'notification.created') {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        toast.info('Thong bao moi', {
          description: typeof parsed.data === 'object' ? 'Ban co cap nhat moi' : undefined,
        })
      }
    },
    [queryClient],
  )

  const handleUnreadCount = useCallback(
    () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
    },
    [queryClient],
  )

  const handleWsErrors = useCallback((rawBody: string) => {
    const parsed = tryParse(rawBody)
    const firstError = parsed?.errors?.[0]
    if (firstError?.message) {
      toast.error('Realtime error', { description: firstError.message })
    }
  }, [])

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
