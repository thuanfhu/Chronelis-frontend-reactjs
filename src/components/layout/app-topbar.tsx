import { Bell, Moon, Sun } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { notificationApi } from '@/lib/api/modules/notification-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useUiStore } from '@/app/store/ui-store'
import { useAuthStore } from '@/app/store/auth-store'

export function AppTopbar() {
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const currentUser = useAuthStore((state) => state.currentUser)

  const unreadQuery = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: notificationApi.unreadCount,
    staleTime: 10_000,
  })

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur md:px-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Chronelis Work Management</p>
        <p className="text-sm font-semibold">{currentUser?.firstName ?? 'Guest'} {currentUser?.lastName ?? ''}</p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
        </Button>

        <Link to="/notifications" className="relative inline-flex">
          <Button variant="ghost" size="icon">
            <Bell className="size-4" />
          </Button>
          <Badge className="absolute -right-1 -top-1 min-w-5 justify-center px-1" variant="default">
            {unreadQuery.data?.unreadCount ?? 0}
          </Badge>
        </Link>
      </div>
    </header>
  )
}
