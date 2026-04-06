import { useMemo, useState, type ReactNode } from 'react'
import {
  FolderKanban, ChevronRight, Search, LogOut, Menu,
  ChevronsLeft, ChevronDown, Target, MoreHorizontal, Plus, ListTodo,
} from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUiStore } from '@/app/store/ui-store'
import { useAuthStore } from '@/app/store/auth-store'
import { projectApi } from '@/lib/api/modules/project-api'
import { goalApi } from '@/lib/api/modules/goal-api'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { queryKeys } from '@/lib/api/query-keys'
import type { WorkspaceMemberRoleType } from '@/types/domain'

function normalizeProgress(progressPercent: number | null | undefined): number {
  if (progressPercent == null || Number.isNaN(progressPercent)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(progressPercent)))
}

function resolveProgressClass(progressPercent: number): string {
  if (progressPercent >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (progressPercent >= 45) return 'text-sky-600 dark:text-sky-400'
  if (progressPercent >= 20) return 'text-amber-600 dark:text-amber-400'
  return 'text-muted-foreground/85'
}

function highlightMatch(text: string, rawQuery: string): ReactNode {
  const query = rawQuery.trim().toLowerCase()
  if (!query) {
    return text
  }

  const lowerText = text.toLowerCase()
  const start = lowerText.indexOf(query)
  if (start === -1) {
    return text
  }

  const end = start + query.length
  const before = text.slice(0, start)
  const match = text.slice(start, end)
  const after = text.slice(end)

  return (
    <>
      {before}
      <span className="rounded-sm bg-primary/20 px-0.5 text-foreground">{match}</span>
      {after}
    </>
  )
}

interface AppSidebarProps {
  workspaceId?: number
  projectId?: number
}

export function AppSidebar({ workspaceId, projectId }: AppSidebarProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen)
  const currentUserId = useAuthStore((s) => s.currentUser?.userId ?? null)
  const clearSession = useAuthStore((s) => s.clearSession)

  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(
    () => new Set(projectId ? [projectId] : []),
  )
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.byWorkspace(workspaceId ?? 0, 1, 50),
    queryFn: () => projectApi.listByWorkspace(workspaceId!, { page: 1, size: 50 }),
    enabled: !!workspaceId,
  })

  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId ?? 0),
    queryFn: () => workspaceApi.detail(workspaceId!),
    enabled: !!workspaceId,
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId ?? 0),
    queryFn: () => workspaceApi.members(workspaceId!),
    enabled: !!workspaceId,
  })

  const createProjectMutation = useMutation({
    mutationFn: () => {
      if (!workspaceId) {
        throw new Error('Workspace không hợp lệ')
      }

      return projectApi.create({
        workspaceId,
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
      })
    },
    onSuccess: () => {
      setCreateProjectDialogOpen(false)
      setNewProjectName('')
      setNewProjectDescription('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId ?? 0, 1, 50) })
      toast.success('Đã tạo project mới')
    },
    onError: (error: Error) => {
      toast.error('Không thể tạo project', { description: error.message })
    },
  })

  const projects = useMemo(() => projectsQuery.data?.content ?? [], [projectsQuery.data])
  const members = membersQuery.data ?? []
  const ownerId = workspaceQuery.data?.owner.userId
  const currentRole: WorkspaceMemberRoleType = ownerId === currentUserId
    ? 'OWNER'
    : (members.find((member) => member.user.userId === currentUserId)?.role ?? 'MEMBER')
  const canCreateProject = currentRole === 'OWNER' || currentRole === 'ADMIN'
  const normalizedSidebarSearch = sidebarSearch.trim().toLowerCase()
  const filteredProjects = useMemo(() => {
    if (!normalizedSidebarSearch) {
      return projects
    }

    return projects.filter((project) => project.name.toLowerCase().includes(normalizedSidebarSearch))
  }, [projects, normalizedSidebarSearch])

  const handleLogout = () => {
    clearSession()
    navigate('/login')
  }

  const toggleProjectExpand = (id: number) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Desktop collapsed = sidebarCollapsed (independent of mobile sidebarOpen)
  const collapsed = sidebarCollapsed
  const projectsOpen = projectsExpanded || Boolean(normalizedSidebarSearch)

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-out',
          'lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'lg:w-16' : 'w-68',
        )}
      >
        {/* ─── Brand header ─── */}
        <div
          className={cn(
            'relative flex h-14 shrink-0 items-center border-b transition-colors',
            collapsed
              ? 'justify-center border-border/60 bg-background/80 px-1 backdrop-blur-lg'
              : 'justify-between border-sidebar-border bg-sidebar px-3',
          )}
        >
          <Link to="/dashboard" className={cn('flex items-center overflow-hidden', !collapsed && 'gap-2.5')}>
            <div
              className={cn(
                'flex shrink-0 items-center justify-center transition-all',
                collapsed
                  ? 'size-9 rounded-xl border border-sidebar-border/80 bg-sidebar-accent/70 shadow-none'
                  : 'size-8 rounded-lg bg-linear-to-br from-primary to-primary/80 shadow-sm',
              )}
            >
              <span className="text-xs font-bold text-primary-foreground">C</span>
            </div>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="text-sm font-bold tracking-tight"
              >
                Chronelis
              </motion.span>
            )}
          </Link>

          {!collapsed && (
            <div className="hidden items-center gap-0.5 lg:flex">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                <ChevronsLeft className="size-4" />
              </Button>
            </div>
          )}

          {collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute -right-3 top-1/2 hidden size-6 -translate-y-1/2 rounded-full border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground lg:flex"
                  onClick={() => setSidebarCollapsed(false)}
                >
                  <ChevronsLeft className="size-3.5 rotate-180" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Mở rộng sidebar</TooltipContent>
            </Tooltip>
          )}

          <div className="absolute right-1 flex items-center lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setSidebarOpen(false)}
            >
              <Menu className="size-4" />
            </Button>
          </div>
        </div>

        {/* ─── Quick search ─── */}
        {!collapsed ? (
          <div className="space-y-2 px-3 py-2">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-sidebar-accent hover:shadow-sm"
            >
              <Search className="size-3.5" />
              <span className="flex-1 text-left">Tìm kiếm toàn cục...</span>
              <kbd className="rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>

            {workspaceId ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/75" />
                <Input
                  value={sidebarSearch}
                  onChange={(event) => setSidebarSearch(event.target.value)}
                  placeholder="Lọc project và goal trong sidebar"
                  className="h-8 border-sidebar-border bg-sidebar-accent/30 pl-8 text-xs"
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex justify-center py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setCommandPaletteOpen(true)}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <Search className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Tìm kiếm (⌘K)</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* ─── Scrollable navigation ─── */}
        <ScrollArea className="flex-1">
          {/* ─── Projects section ─── */}
          {workspaceId && !collapsed && (
            <div className="px-2 py-2">
              <div className="mb-1 flex items-center justify-between gap-1 px-1">
                <button
                  onClick={() => setProjectsExpanded(!projectsExpanded)}
                  className="flex min-w-0 flex-1 items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 transition-colors hover:text-muted-foreground"
                >
                  <ChevronDown className={cn('size-3 transition-transform duration-200', !projectsOpen && '-rotate-90')} />
                  Projects
                </button>

                {canCreateProject ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setCreateProjectDialogOpen(true)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                ) : null}
              </div>
              <AnimatePresence initial={false}>
                {projectsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5">
                      {filteredProjects.map((proj) => (
                        <ProjectItem
                          key={proj.id}
                          project={proj}
                          workspaceId={workspaceId}
                          isActive={projectId === proj.id}
                          isExpanded={expandedProjects.has(proj.id)}
                          onToggleExpand={() => toggleProjectExpand(proj.id)}
                          searchQuery={sidebarSearch}
                        />
                      ))}

                      {filteredProjects.length === 0 ? (
                        <p className="px-2 py-1 text-[11px] text-muted-foreground/75">Không có project khớp bộ lọc.</p>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Collapsed: project icons only */}
          {workspaceId && collapsed && (
            <div className="flex flex-col items-center gap-0.5 px-2 py-2">
              {filteredProjects.map((proj) => (
                <Tooltip key={proj.id}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={`/workspaces/${workspaceId}/projects/${proj.id}`}
                      className={({ isActive }) =>
                        cn(
                          'flex size-9 items-center justify-center rounded-lg transition-all duration-150',
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                            : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/75 hover:text-sidebar-accent-foreground',
                        )
                      }
                    >
                      <FolderKanban className="size-4" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">{proj.name}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </ScrollArea>

        <Dialog open={createProjectDialogOpen} onOpenChange={setCreateProjectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo project nhanh</DialogTitle>
              <DialogDescription>Tạo project mới ngay từ sidebar của workspace hiện tại.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sidebar-project-name">Tên project</Label>
                <Input
                  id="sidebar-project-name"
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder="Ví dụ: Sprint 3"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sidebar-project-description">Mô tả (tùy chọn)</Label>
                <Textarea
                  id="sidebar-project-description"
                  value={newProjectDescription}
                  onChange={(event) => setNewProjectDescription(event.target.value)}
                  rows={3}
                  placeholder="Mô tả ngắn về project..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateProjectDialogOpen(false)}>Hủy</Button>
              <Button
                onClick={() => createProjectMutation.mutate()}
                disabled={createProjectMutation.isPending || !newProjectName.trim()}
              >
                {createProjectMutation.isPending ? 'Đang tạo...' : 'Tạo project'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Footer ─── */}
        <div className="shrink-0 border-t border-sidebar-border p-2">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="group flex w-full items-center justify-center rounded-lg p-2.5 text-sidebar-foreground/90 transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="size-4 icon-hover" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Đăng xuất</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-sidebar-foreground/90 transition-all duration-150 hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-4 icon-hover" />
              Đăng xuất
            </button>
          )}
        </div>
      </aside>
    </>
  )
}

// ─── Project Item with expandable Goals ───

function ProjectItem({
  project,
  workspaceId,
  isActive,
  isExpanded,
  onToggleExpand,
  searchQuery,
}: {
  project: { id: number; name: string }
  workspaceId: number
  isActive: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  searchQuery: string
}) {
  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.byProject(project.id, 1, 50),
    queryFn: () => goalApi.listByProject(project.id, { page: 1, size: 50 }),
    enabled: project.id > 0,
  })

  const goals = useMemo(() => goalsQuery.data?.content ?? [], [goalsQuery.data])
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const filteredGoals = useMemo(() => {
    if (!normalizedSearchQuery) {
      return goals
    }

    return goals.filter((goal) => goal.title.toLowerCase().includes(normalizedSearchQuery))
  }, [goals, normalizedSearchQuery])
  const projectProgress = useMemo(() => {
    if (goals.length === 0) {
      return 0
    }

    const total = goals.reduce((sum, goal) => sum + normalizeProgress(goal.progressPercent), 0)
    return normalizeProgress(total / goals.length)
  }, [goals])

  return (
    <div>
      <div className="flex w-full min-w-0 items-center overflow-hidden">
        <button
          onClick={onToggleExpand}
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground/75 transition-colors hover:text-muted-foreground"
        >
          <ChevronRight className={cn('size-3 transition-transform duration-200', isExpanded && 'rotate-90')} />
        </button>
        <NavLink
          to={`/workspaces/${workspaceId}/projects/${project.id}`}
          className={cn(
            'grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_2.75rem] items-center gap-2 overflow-hidden rounded-lg px-2 py-1.5 text-[13px] transition-all duration-150',
            isActive
              ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/88 hover:bg-sidebar-accent/75 hover:text-sidebar-accent-foreground',
          )}
        >
          <FolderKanban className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate" title={project.name}>{highlightMatch(project.name, searchQuery)}</span>
          <span
            className={cn(
              'shrink-0 text-right text-[10px] font-semibold tabular-nums',
              resolveProgressClass(projectProgress),
            )}
          >
            {projectProgress}%
          </span>
        </NavLink>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6 shrink-0 text-muted-foreground/75 hover:text-foreground">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuItem asChild>
              <Link to={`/workspaces/${workspaceId}/projects/${project.id}`}>Mở project</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/workspaces/${workspaceId}/projects/${project.id}/todo`}>
                <ListTodo className="mr-2 size-3.5" />
                To Do
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/workspaces/${workspaceId}/projects/${project.id}/goals`}>
                <Target className="mr-2 size-3.5" />
                Goals
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/workspaces/${workspaceId}`}>Chỉnh sửa / xóa project...</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-6 space-y-0.5 border-l border-sidebar-border py-1 pl-2">
              {goalsQuery.isLoading && (
                <p className="px-2 py-1 text-[11px] text-muted-foreground/75">Đang tải...</p>
              )}
              {goals.length === 0 && !goalsQuery.isLoading && (
                <p className="px-2 py-1 text-[11px] text-muted-foreground/75">Chưa có goal nào</p>
              )}
              {goals.length > 0 && filteredGoals.length === 0 && !goalsQuery.isLoading ? (
                <p className="px-2 py-1 text-[11px] text-muted-foreground/75">Không có goal khớp bộ lọc.</p>
              ) : null}
              {filteredGoals.map((goal) => {
                const normalizedProgress = normalizeProgress(goal.progressPercent)

                return (
                  <NavLink
                    key={goal.id}
                    to={`/workspaces/${workspaceId}/projects/${project.id}?view=goals`}
                    className="group grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_2.75rem] items-center gap-2 overflow-hidden rounded-md px-2 py-1 text-[12px] text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/75 hover:text-sidebar-accent-foreground"
                  >
                    <Target className="size-3 shrink-0 text-muted-foreground/80" />
                    <span className="min-w-0 flex-1 truncate" title={goal.title}>{highlightMatch(goal.title, searchQuery)}</span>
                    <span
                      className={cn(
                        'shrink-0 text-right text-[10px] font-semibold tabular-nums',
                        resolveProgressClass(normalizedProgress),
                      )}
                    >
                      {normalizedProgress}%
                    </span>
                  </NavLink>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
