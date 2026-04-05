import { useState } from 'react'
import { Bell, Moon, Sun, Menu, Search, User, LogOut, ChevronsUpDown, Check, Plus, Pencil, Loader2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { notificationApi } from '@/lib/api/modules/notification-api'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useUiStore } from '@/app/store/ui-store'
import { useAuthStore } from '@/app/store/auth-store'

export function AppTopbar() {
  const navigate = useNavigate()
  const params = useParams()
  const currentWorkspaceId = params.workspaceId ? Number(params.workspaceId) : undefined
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const theme = useUiStore((state) => state.theme)
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen)
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen)
  const currentUser = useAuthStore((state) => state.currentUser)
  const clearSession = useAuthStore((state) => state.clearSession)
  const queryClient = useQueryClient()

  // Workspace CRUD state
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editWsId, setEditWsId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const unreadQuery = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: notificationApi.unreadCount,
    staleTime: 10_000,
  })

  const workspacesQuery = useQuery({
    queryKey: queryKeys.workspaces.list(1, 50),
    queryFn: () => workspaceApi.list({ page: 1, size: 50 }),
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => workspaceApi.create({ name }),
    onSuccess: (created) => {
      setCreateName('')
      setCreateOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      toast.success('Tạo workspace thành công')
      navigate(`/workspaces/${created.id}`)
    },
    onError: (error: Error) => {
      toast.error('Tạo workspace thất bại', { description: error.message })
    },
  })

  const editMutation = useMutation({
    mutationFn: (name: string) => {
      if (!editWsId) throw new Error('Workspace không tồn tại')
      return workspaceApi.update(editWsId, { name })
    },
    onSuccess: () => {
      setEditOpen(false)
      setEditWsId(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      toast.success('Đổi tên workspace thành công')
    },
    onError: (error: Error) => {
      toast.error('Đổi tên thất bại', { description: error.message })
    },
  })

  const openEdit = (wsId: number, wsName: string) => {
    setEditWsId(wsId)
    setEditName(wsName)
    setEditOpen(true)
  }

  const workspaces = workspacesQuery.data?.content ?? []
  const currentWorkspace = workspaces.find((ws) => ws.id === currentWorkspaceId)

  const unreadCount = unreadQuery.data?.unreadCount ?? 0
  const initials = `${currentUser?.firstName?.charAt(0) ?? ''}${currentUser?.lastName?.charAt(0) ?? ''}`

  const handleLogout = () => {
    clearSession()
    navigate('/login')
  }

  return (
    <>
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-lg dark:border-border/85 dark:bg-background/92">
      {/* Mobile menu toggle */}
      <Button variant="ghost" size="icon" className="size-8 lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
        <Menu className="size-4" />
      </Button>

      {/* Breadcrumb area / search */}
      <div className="flex flex-1 items-center gap-3">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden items-center gap-2 rounded-lg border border-input/60 bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted dark:border-border/90 dark:bg-card/70 dark:hover:bg-muted/75 sm:flex"
        >
          <Search className="size-3.5" />
          <span>Tìm kiếm...</span>
          <kbd className="ml-4 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Workspace selector dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg border border-input/60 bg-muted/40 px-2.5 py-1.5 text-sm transition-colors hover:bg-muted dark:border-border/90 dark:bg-card/70 dark:hover:bg-muted/75">
              <div className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                {currentWorkspace?.name?.charAt(0).toUpperCase() ?? 'W'}
              </div>
              <span className="hidden max-w-28 truncate text-xs font-medium sm:inline">
                {currentWorkspace?.name ?? 'Chọn workspace'}
              </span>
              <ChevronsUpDown className="size-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => navigate(`/workspaces/${ws.id}`)}
                className="group flex items-center gap-2 pr-1"
              >
                <div className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 truncate text-sm">{ws.name}</span>
                {ws.id === currentWorkspaceId && <Check className="size-3.5 shrink-0 text-primary" />}
                <button
                  className="ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    openEdit(ws.id, ws.name)
                  }}
                  title="Đổi tên"
                >
                  <Pencil className="size-3 text-muted-foreground" />
                </button>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); setCreateOpen(true) }}
              className="text-primary focus:text-primary"
            >
              <Plus className="mr-2 size-4" />
              Tạo workspace mới
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Theme toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="group size-8" onClick={toggleTheme}>
              <Sun className="size-4 icon-hover-rotate dark:hidden" />
              <Moon className="hidden size-4 icon-hover-rotate dark:block" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}</TooltipContent>
        </Tooltip>

        {/* Notifications */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link to="/notifications" className="relative">
              <Button variant="ghost" size="icon" className="group size-8">
                <Bell className="size-4 icon-hover-bounce" />
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
            <button className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted dark:hover:bg-muted/75">
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
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="mr-2 size-4" />
              Hồ sơ cá nhân
            </DropdownMenuItem>
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

    {/* Create workspace dialog */}
    <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateName('') }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo workspace mới</DialogTitle>
          <DialogDescription>Workspace là không gian chứa các project và thành viên của bạn.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="create-ws-name">Tên workspace</Label>
          <Input
            id="create-ws-name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Ví dụ: Team Product"
            onKeyDown={(e) => { if (e.key === 'Enter' && createName.trim()) createMutation.mutate(createName.trim()) }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
          <Button
            onClick={() => createMutation.mutate(createName.trim())}
            disabled={createMutation.isPending || !createName.trim()}
          >
            {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Tạo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Edit workspace dialog */}
    <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditWsId(null) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đổi tên workspace</DialogTitle>
          <DialogDescription>Nhập tên mới cho workspace này.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="edit-ws-name">Tên workspace</Label>
          <Input
            id="edit-ws-name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && editName.trim()) editMutation.mutate(editName.trim()) }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditOpen(false)}>Hủy</Button>
          <Button
            onClick={() => editMutation.mutate(editName.trim())}
            disabled={editMutation.isPending || !editName.trim()}
          >
            {editMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
