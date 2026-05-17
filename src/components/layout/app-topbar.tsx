import { useState } from 'react'
import { Bell, Moon, Sun, Menu, Search, User, LogOut, ChevronsUpDown, Check, Plus, Pencil, Loader2, ShieldCheck } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { notificationApi } from '@/lib/api/modules/notification-api'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useUiStore } from '@/app/store/ui-store'
import { useAuthStore } from '@/app/store/auth-store'
import { isAdminUser } from '@/lib/auth/role-utils'
import { cn } from '@/lib/utils/cn'
import { LanguageSwitcher } from '@/components/shared/language-switcher'

export function AppTopbar() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const params = useParams()
  const parsedWorkspaceId = params.workspaceId ? Number(params.workspaceId) : undefined
  const workspaceIdFromRoute = Number.isFinite(parsedWorkspaceId) ? parsedWorkspaceId : undefined
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const theme = useUiStore((state) => state.theme)
  const selectedWorkspaceId = useUiStore((state) => state.selectedWorkspaceId)
  const setSelectedWorkspaceId = useUiStore((state) => state.setSelectedWorkspaceId)
  const setSelectedProjectId = useUiStore((state) => state.setSelectedProjectId)
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
  const [editInitialName, setEditInitialName] = useState('')
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

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
      toast.success(t('common.success'))
      setSelectedWorkspaceId(created.id)
      setSelectedProjectId(null)
      navigate(`/workspaces/${created.id}`)
    },
    onError: (error: Error) => {
      toast.error(t('common.error'), { description: error.message })
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
      toast.success(t('common.success'))
    },
    onError: (error: Error) => {
      toast.error(t('common.error'), { description: error.message })
    },
  })

  const openEdit = (wsId: number, wsName: string) => {
    setEditWsId(wsId)
    setEditName(wsName)
    setEditInitialName(wsName.trim())
    setEditOpen(true)
  }

  const handleWorkspaceSelect = (workspaceId: number) => {
    setSelectedWorkspaceId(workspaceId)
    setSelectedProjectId(null)
    navigate(`/workspaces/${workspaceId}`)
  }

  const workspaces = workspacesQuery.data?.content ?? []
  const activeWorkspaceId = workspaceIdFromRoute ?? selectedWorkspaceId ?? undefined
  const currentWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId)

  const unreadCount = unreadQuery.data?.unreadCount ?? 0
  const initials = `${currentUser?.firstName?.charAt(0) ?? ''}${currentUser?.lastName?.charAt(0) ?? ''}`
  const canAccessAdmin = isAdminUser(currentUser)

  const handleLogout = () => {
    clearSession()
    setLogoutConfirmOpen(false)
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
          <span>{t('common.searchPlaceholder')}</span>
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
                {currentWorkspace?.name ?? (activeWorkspaceId ? `Workspace #${activeWorkspaceId}` : t('workspace.title'))}
              </span>
              <ChevronsUpDown className="size-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-[300px] overflow-y-auto">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => handleWorkspaceSelect(ws.id)}
                className="group flex items-center gap-2 pr-1"
              >
                <div className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 truncate text-sm">{ws.name}</span>
                {ws.id === activeWorkspaceId && <Check className="size-3.5 shrink-0 text-primary" />}
                <button
                  className="ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    openEdit(ws.id, ws.name)
                  }}
                  title={t('common.edit')}
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
              {t('workspace.create')}
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
          <TooltipContent>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</TooltipContent>
        </Tooltip>

        {/* Language toggle */}
        <LanguageSwitcher />

        {/* Notifications */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link to="/notifications" className="relative">
              <Button variant="ghost" size="icon" className="group size-8">
                <Bell
                  className={cn(
                    'size-4',
                    unreadCount > 0
                      ? 'motion-safe:animate-[icon-subtle-bounce_1.6s_ease-in-out_infinite]'
                      : 'icon-hover-bounce',
                  )}
                />
              </Button>
              {unreadCount > 0 && (
                <Badge className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full p-0 text-[10px]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent>{unreadCount > 0 ? `${unreadCount} ${t('notification.title').toLowerCase()}` : t('notification.title')}</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted dark:hover:bg-muted/75">
              <Avatar className="size-7">
                {currentUser?.avatarUrl && <AvatarImage src={currentUser.avatarUrl} alt={currentUser.firstName} />}
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
              {t('profile.title')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/dashboard')}>
              <User className="mr-2 size-4" />
              Dashboard
            </DropdownMenuItem>
            {canAccessAdmin && (
              <DropdownMenuItem
                onClick={() => navigate('/admin/users')}
                className="bg-amber-50 font-semibold text-amber-900 hover:bg-amber-100 focus:bg-amber-100 focus:text-amber-900 dark:bg-amber-100 dark:text-amber-950"
              >
                <ShieldCheck className="mr-2 size-4" />
                Admin dashboard
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLogoutConfirmOpen(true)} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 size-4" />
              {t('common.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    {/* Create workspace dialog */}
    <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateName('') }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('workspace.create')}</DialogTitle>
          <DialogDescription>{t('workspace.title')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="create-ws-name">{t('workspace.title')}</Label>
          <Input
            id="create-ws-name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="e.g. Team Product"
            onKeyDown={(e) => { if (e.key === 'Enter' && createName.trim()) createMutation.mutate(createName.trim()) }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={() => createMutation.mutate(createName.trim())}
            disabled={createMutation.isPending || !createName.trim()}
          >
            {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Edit workspace dialog */}
    <Dialog open={editOpen} onOpenChange={(open) => {
      setEditOpen(open)
      if (!open) {
        setEditWsId(null)
        setEditInitialName('')
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('common.edit')} workspace</DialogTitle>
          <DialogDescription>{t('workspace.title')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="edit-ws-name">{t('workspace.title')}</Label>
          <Input
            id="edit-ws-name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && editName.trim() && editName.trim() !== editInitialName) {
                editMutation.mutate(editName.trim())
              }
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={() => editMutation.mutate(editName.trim())}
            disabled={editMutation.isPending || !editName.trim() || editName.trim() === editInitialName}
          >
            {editMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ConfirmModal
      open={logoutConfirmOpen}
      onOpenChange={setLogoutConfirmOpen}
      title={t('admin.sidebar.logoutTitle')}
      description={t('admin.sidebar.logoutDescription')}
      confirmText={t('common.logout')}
      confirmVariant="destructive"
      onConfirm={handleLogout}
    />
    </>
  )
}
