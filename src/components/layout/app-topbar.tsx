import { Bell, Moon, Sun, Menu, Search, User, LogOut, Settings } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { notificationApi } from '@/lib/api/modules/notification-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useUiStore } from '@/app/store/ui-store'
import { useAuthStore } from '@/app/store/auth-store'

export function AppTopbar() {
  const navigate = useNavigate()
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const theme = useUiStore((state) => state.theme)
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen)
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen)
  const currentUser = useAuthStore((state) => state.currentUser)
  const clearSession = useAuthStore((state) => state.clearSession)

  const unreadQuery = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: notificationApi.unreadCount,
    staleTime: 10_000,
  })

  const unreadCount = unreadQuery.data?.unreadCount ?? 0
  const initials = `${currentUser?.firstName?.charAt(0) ?? ''}${currentUser?.lastName?.charAt(0) ?? ''}`

  const handleLogout = () => {
    clearSession()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-lg">
      {/* Mobile menu toggle */}
      <Button variant="ghost" size="icon" className="size-8 lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
        <Menu className="size-4" />
      </Button>

      {/* Breadcrumb area / search */}
      <div className="flex flex-1 items-center gap-3">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden items-center gap-2 rounded-lg border border-input/60 bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted sm:flex"
        >
          <Search className="size-3.5" />
          <span>Tìm kiếm...</span>
          <kbd className="ml-4 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" onClick={toggleTheme}>
              <Sun className="size-4 dark:hidden" />
              <Moon className="hidden size-4 dark:block" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}</TooltipContent>
        </Tooltip>

        {/* Notifications */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link to="/notifications" className="relative">
              <Button variant="ghost" size="icon" className="size-8">
                <Bell className="size-4" />
              </Button>
              {unreadCount > 0 && (
                <Badge className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full p-0 text-[10px]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent>{unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Thông báo'}</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline-block">
                {currentUser?.firstName ?? 'Guest'}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{currentUser?.firstName} {currentUser?.lastName}</p>
                <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/dashboard')}>
              <User className="mr-2 size-4" />
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/notifications')}>
              <Bell className="mr-2 size-4" />
              Thông báo
              {unreadCount > 0 && <Badge className="ml-auto" variant="secondary">{unreadCount}</Badge>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 size-4" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
