import { type MouseEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  FolderKanban, ChevronRight, Search, LogOut, Menu,
  ChevronsLeft, ChevronDown, Target, LayoutGrid, Plus, Loader2, Trash2,
} from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { DeferredDeleteStack } from '@/components/shared/deferred-delete-stack'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUiStore } from '@/app/store/ui-store'
import { useAuthStore } from '@/app/store/auth-store'
import { projectApi } from '@/lib/api/modules/project-api'
import { goalApi } from '@/lib/api/modules/goal-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useDeferredDelete } from '@/lib/delete/use-deferred-delete'
import type { Goal, GoalStatusType, GoalType, Project } from '@/types/domain'

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightMatch(text: string, keyword: string): ReactNode {
  const trimmedKeyword = keyword.trim()
  if (!trimmedKeyword) {
    return text
  }

  const matcher = new RegExp(`(${escapeRegExp(trimmedKeyword)})`, 'ig')
  const parts = text.split(matcher)
  const normalizedKeyword = trimmedKeyword.toLowerCase()

  return parts.map((part, index) => (
    part.toLowerCase() === normalizedKeyword
      ? <mark key={`${text}-${index}`} className="rounded bg-primary/20 px-0.5 text-foreground">{part}</mark>
      : <span key={`${text}-${index}`}>{part}</span>
  ))
}

type SidebarContextTarget =
  | { kind: 'project'; project: Project }
  | { kind: 'goal'; goal: Goal; project: Project }

type SidebarDeletePayload = {
  kind: 'project' | 'goal'
  id: number
  projectId: number
}

const EMPTY_PENDING_GOAL_IDS = new Set<number>()

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
  const clearSession = useAuthStore((s) => s.clearSession)

  const [workspaceSearch, setWorkspaceSearch] = useState('')
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(
    () => new Set(projectId ? [projectId] : []),
  )
  const [sidebarContextMenu, setSidebarContextMenu] = useState<{
    x: number
    y: number
    target: SidebarContextTarget
  } | null>(null)

  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectDialogMode, setProjectDialogMode] = useState<'create' | 'edit'>('create')
  const [projectDialogTargetId, setProjectDialogTargetId] = useState<number | null>(null)
  const [projectFormName, setProjectFormName] = useState('')
  const [projectFormDescription, setProjectFormDescription] = useState('')
  const [projectInitialName, setProjectInitialName] = useState('')
  const [projectInitialDescription, setProjectInitialDescription] = useState('')

  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [goalDialogMode, setGoalDialogMode] = useState<'create' | 'edit'>('create')
  const [goalDialogTargetId, setGoalDialogTargetId] = useState<number | null>(null)
  const [goalDialogProjectId, setGoalDialogProjectId] = useState<number | null>(null)
  const [goalFormTitle, setGoalFormTitle] = useState('')
  const [goalFormType, setGoalFormType] = useState<GoalType>('SHORT_TERM')
  const [goalFormStatus, setGoalFormStatus] = useState<GoalStatusType>('NOT_STARTED')
  const [goalInitialTitle, setGoalInitialTitle] = useState('')
  const [goalInitialType, setGoalInitialType] = useState<GoalType>('SHORT_TERM')
  const [goalInitialStatus, setGoalInitialStatus] = useState<GoalStatusType>('NOT_STARTED')

  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'project' | 'goal'
    id: number
    label: string
    projectId: number
  } | null>(null)

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.byWorkspace(workspaceId ?? 0, 1, 50),
    queryFn: () => projectApi.listByWorkspace(workspaceId!, { page: 1, size: 50 }),
    enabled: !!workspaceId,
  })

  const projects = projectsQuery.data?.content ?? []
  const searchKeyword = workspaceSearch.trim().toLowerCase()

  const projectFormDirty = projectDialogMode === 'create'
    ? Boolean(projectFormName.trim())
    : (
      projectFormName.trim() !== projectInitialName
      || projectFormDescription.trim() !== projectInitialDescription
    )

  const goalFormDirty = goalDialogMode === 'create'
    ? Boolean(goalFormTitle.trim())
    : (
      goalFormTitle.trim() !== goalInitialTitle
      || goalFormType !== goalInitialType
      || goalFormStatus !== goalInitialStatus
    )

  const openProjectCreateDialog = () => {
    setProjectDialogMode('create')
    setProjectDialogTargetId(null)
    setProjectFormName('')
    setProjectFormDescription('')
    setProjectInitialName('')
    setProjectInitialDescription('')
    setProjectDialogOpen(true)
  }

  const openProjectEditDialog = (project: Project) => {
    setProjectDialogMode('edit')
    setProjectDialogTargetId(project.id)
    setProjectFormName(project.name)
    setProjectFormDescription(project.description ?? '')
    setProjectInitialName(project.name.trim())
    setProjectInitialDescription((project.description ?? '').trim())
    setProjectDialogOpen(true)
  }

  const openGoalCreateDialog = (project: Project) => {
    setGoalDialogMode('create')
    setGoalDialogTargetId(null)
    setGoalDialogProjectId(project.id)
    setGoalFormTitle('')
    setGoalFormType('SHORT_TERM')
    setGoalFormStatus('NOT_STARTED')
    setGoalInitialTitle('')
    setGoalInitialType('SHORT_TERM')
    setGoalInitialStatus('NOT_STARTED')
    setGoalDialogOpen(true)
  }

  const openGoalEditDialog = (project: Project, goal: Goal) => {
    setGoalDialogMode('edit')
    setGoalDialogTargetId(goal.id)
    setGoalDialogProjectId(project.id)
    setGoalFormTitle(goal.title)
    setGoalFormType(goal.goalType)
    setGoalFormStatus(goal.status)
    setGoalInitialTitle(goal.title.trim())
    setGoalInitialType(goal.goalType)
    setGoalInitialStatus(goal.status)
    setGoalDialogOpen(true)
  }

  const openContextMenu = (event: MouseEvent<HTMLElement>, target: SidebarContextTarget) => {
    event.preventDefault()
    event.stopPropagation()

    const clampedX = Math.min(event.clientX, window.innerWidth - 228)
    const clampedY = Math.min(event.clientY, window.innerHeight - 228)
    setSidebarContextMenu({ x: clampedX, y: clampedY, target })
  }

  useEffect(() => {
    if (!sidebarContextMenu) {
      return
    }

    const closeMenu = () => {
      setSidebarContextMenu(null)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    window.addEventListener('click', closeMenu)
    window.addEventListener('contextmenu', closeMenu)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('contextmenu', closeMenu)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [sidebarContextMenu])

  const createProjectMutation = useMutation({
    mutationFn: () => {
      if (!workspaceId) {
        throw new Error('Không tìm thấy workspace hiện tại')
      }

      return projectApi.create({
        workspaceId,
        name: projectFormName.trim(),
        description: projectFormDescription.trim() || undefined,
      })
    },
    onSuccess: () => {
      setProjectDialogOpen(false)
      setProjectFormName('')
      setProjectFormDescription('')
      if (workspaceId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      }
      toast.success('Tạo project thành công')
    },
    onError: (error: Error) => {
      toast.error('Tạo project thất bại', { description: error.message })
    },
  })

  const updateProjectMutation = useMutation({
    mutationFn: () => {
      if (!projectDialogTargetId) {
        throw new Error('Không tìm thấy project cần cập nhật')
      }

      return projectApi.update(projectDialogTargetId, {
        name: projectFormName.trim(),
        description: projectFormDescription.trim() || undefined,
      })
    },
    onSuccess: () => {
      setProjectDialogOpen(false)
      setProjectDialogTargetId(null)
      if (workspaceId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      }
      toast.success('Cập nhật project thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật project thất bại', { description: error.message })
    },
  })

  const createGoalMutation = useMutation({
    mutationFn: () => {
      if (!goalDialogProjectId) {
        throw new Error('Không tìm thấy project của goal')
      }

      return goalApi.create({
        projectId: goalDialogProjectId,
        title: goalFormTitle.trim(),
        goalType: goalFormType,
        status: goalFormStatus,
      })
    },
    onSuccess: () => {
      const currentProjectId = goalDialogProjectId
      setGoalDialogOpen(false)
      setGoalDialogTargetId(null)
      if (currentProjectId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(currentProjectId, 1, 50) })
      }
      toast.success('Tạo goal thành công')
    },
    onError: (error: Error) => {
      toast.error('Tạo goal thất bại', { description: error.message })
    },
  })

  const updateGoalMutation = useMutation({
    mutationFn: () => {
      if (!goalDialogTargetId) {
        throw new Error('Không tìm thấy goal cần cập nhật')
      }

      return goalApi.update(goalDialogTargetId, {
        title: goalFormTitle.trim(),
        goalType: goalFormType,
        status: goalFormStatus,
      })
    },
    onSuccess: () => {
      const currentProjectId = goalDialogProjectId
      setGoalDialogOpen(false)
      setGoalDialogTargetId(null)
      if (currentProjectId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(currentProjectId, 1, 50) })
      }
      toast.success('Cập nhật goal thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật goal thất bại', { description: error.message })
    },
  })

  const {
    pendingDeletes: pendingSidebarDeletes,
    clockMs: sidebarDeleteClockMs,
    undoWindowMs: sidebarDeleteUndoWindowMs,
    scheduleDelete: scheduleSidebarDelete,
    undoDelete: undoSidebarDelete,
  } = useDeferredDelete<SidebarDeletePayload>({
    onFinalize: async (payload) => {
      if (payload.kind === 'project') {
        await projectApi.remove(payload.id)
        return
      }

      await goalApi.remove(payload.id)
    },
    onFinalizeSuccess: async (payload) => {
      if (payload.kind === 'project') {
        if (workspaceId) {
          await queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
        }

        if (workspaceId && projectId === payload.id) {
          navigate(`/workspaces/${workspaceId}`)
        }
        return
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(payload.projectId, 1, 50) }),
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', payload.projectId] }),
      ])
    },
    pendingMessage: (entry) => {
      const entityName = entry.payload.kind === 'project' ? 'Project' : 'Goal'
      return `${entityName} "${entry.label}" đã được lên lịch xóa. Bạn có 5 giây để hoàn tác.`
    },
    successMessage: (entry) => {
      const entityName = entry.payload.kind === 'project' ? 'project' : 'goal'
      return `Đã xóa ${entityName} "${entry.label}"`
    },
    alreadyDeletedMessage: (entry) => {
      const entityName = entry.payload.kind === 'project' ? 'Project' : 'Goal'
      return `${entityName} "${entry.label}" đã được xóa trước đó`
    },
    errorTitle: 'Xóa dữ liệu thất bại',
  })

  const pendingProjectIds = new Set<number>()
  const pendingGoalIdsByProject = new Map<number, Set<number>>()

  for (const pendingEntry of pendingSidebarDeletes) {
    if (pendingEntry.payload.kind === 'project') {
      pendingProjectIds.add(pendingEntry.payload.id)
      continue
    }

    const currentGoalSet = pendingGoalIdsByProject.get(pendingEntry.payload.projectId) ?? new Set<number>()
    currentGoalSet.add(pendingEntry.payload.id)
    pendingGoalIdsByProject.set(pendingEntry.payload.projectId, currentGoalSet)
  }

  const visibleProjects = projects.filter((project) => !pendingProjectIds.has(project.id))
  const collapsedProjects = searchKeyword
    ? visibleProjects.filter((project) => project.name.toLowerCase().includes(searchKeyword))
    : visibleProjects

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

  const handleConfirmDelete = () => {
    if (!deleteTarget) {
      return
    }

    const queued = scheduleSidebarDelete({
      key: `${deleteTarget.kind}-${deleteTarget.id}`,
      label: deleteTarget.label,
      payload: {
        kind: deleteTarget.kind,
        id: deleteTarget.id,
        projectId: deleteTarget.projectId,
      },
    })

    if (queued) {
      setDeleteTarget(null)
    }
  }

  // Desktop collapsed = sidebarCollapsed (independent of mobile sidebarOpen)
  const collapsed = sidebarCollapsed

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

        {/* ─── Workspace filter + overview ─── */}
        {!collapsed ? (
          <div className="space-y-2 px-3 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={workspaceSearch}
                onChange={(event) => setWorkspaceSearch(event.target.value)}
                placeholder="Lọc project và goal..."
                className="h-8 border-sidebar-border bg-sidebar-accent/35 pl-8 text-xs"
              />
            </div>

            {workspaceId ? (
              <Link
                to={`/workspaces/${workspaceId}`}
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-sidebar-border bg-sidebar-accent/35 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                title="Workspace Overview"
              >
                <LayoutGrid className="size-3.5" />
                Overview
              </Link>
            ) : null}
          </div>
        ) : workspaceId ? (
          <div className="flex flex-col items-center gap-1.5 py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to={`/workspaces/${workspaceId}`}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <LayoutGrid className="size-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Workspace Overview</TooltipContent>
            </Tooltip>
          </div>
        ) : null}

        {/* ─── Scrollable navigation ─── */}
        <ScrollArea className="flex-1">
          {/* ─── Projects section ─── */}
          {workspaceId && !collapsed && (
            <div className="px-2 py-2">
              <div className="mb-1 flex items-center justify-between gap-1 px-2">
                <button
                  onClick={() => setProjectsExpanded(!projectsExpanded)}
                  className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 transition-colors hover:text-muted-foreground"
                >
                  <ChevronDown className={cn('size-3 transition-transform duration-200', !projectsExpanded && '-rotate-90')} />
                  Projects
                </button>

                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={openProjectCreateDialog}
                    title="Tạo project"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {projectsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5">
                      {visibleProjects.map((proj) => (
                        <ProjectItem
                          key={proj.id}
                          project={proj}
                          workspaceId={workspaceId}
                          isActive={projectId === proj.id}
                          isExpanded={expandedProjects.has(proj.id) || Boolean(searchKeyword)}
                          searchKeyword={searchKeyword}
                          hiddenGoalIds={pendingGoalIdsByProject.get(proj.id) ?? EMPTY_PENDING_GOAL_IDS}
                          onToggleExpand={() => toggleProjectExpand(proj.id)}
                          onCreateGoal={openGoalCreateDialog}
                          onOpenContextMenu={openContextMenu}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Collapsed: project icons only */}
          {workspaceId && collapsed && (
            <div className="flex flex-col items-center gap-0.5 px-2 py-2">
              {collapsedProjects.map((proj) => (
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

      {sidebarContextMenu && !collapsed ? (
        <div
          className="fixed z-80 w-52 rounded-xl border border-white/35 bg-background/80 p-1.5 shadow-2xl backdrop-blur-xl"
          style={{ top: sidebarContextMenu.y, left: sidebarContextMenu.x }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-foreground/90 transition-colors hover:bg-primary/10"
            onClick={() => {
              openProjectCreateDialog()
              setSidebarContextMenu(null)
            }}
          >
            <Plus className="size-3.5" />
            Create Project
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-foreground/90 transition-colors hover:bg-primary/10"
            onClick={() => {
              const contextProject = sidebarContextMenu.target.project
              openGoalCreateDialog(contextProject)
              setSidebarContextMenu(null)
            }}
          >
            <Target className="size-3.5" />
            Create Goal
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-foreground/90 transition-colors hover:bg-primary/10"
            onClick={() => {
              if (sidebarContextMenu.target.kind === 'project') {
                openProjectEditDialog(sidebarContextMenu.target.project)
              } else {
                openGoalEditDialog(sidebarContextMenu.target.project, sidebarContextMenu.target.goal)
              }
              setSidebarContextMenu(null)
            }}
          >
            <LayoutGrid className="size-3.5" />
            Edit
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
            onClick={() => {
              if (sidebarContextMenu.target.kind === 'project') {
                setDeleteTarget({
                  kind: 'project',
                  id: sidebarContextMenu.target.project.id,
                  label: sidebarContextMenu.target.project.name,
                  projectId: sidebarContextMenu.target.project.id,
                })
              } else {
                setDeleteTarget({
                  kind: 'goal',
                  id: sidebarContextMenu.target.goal.id,
                  label: sidebarContextMenu.target.goal.title,
                  projectId: sidebarContextMenu.target.project.id,
                })
              }
              setSidebarContextMenu(null)
            }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>
      ) : null}

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{projectDialogMode === 'create' ? 'Tạo project' : 'Chỉnh sửa project'}</DialogTitle>
            <DialogDescription>
              {projectDialogMode === 'create'
                ? 'Tạo project mới trong workspace hiện tại.'
                : 'Cập nhật thông tin project trong sidebar.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sidebar-project-name">Tên project</Label>
              <Input
                id="sidebar-project-name"
                value={projectFormName}
                onChange={(event) => setProjectFormName(event.target.value)}
                placeholder="Ví dụ: Q2 Launch"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sidebar-project-description">Mô tả (tuỳ chọn)</Label>
              <Textarea
                id="sidebar-project-description"
                value={projectFormDescription}
                onChange={(event) => setProjectFormDescription(event.target.value)}
                rows={3}
                placeholder="Mô tả ngắn về project"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>Hủy</Button>
            <Button
              onClick={() => {
                if (projectDialogMode === 'create') {
                  createProjectMutation.mutate()
                } else {
                  updateProjectMutation.mutate()
                }
              }}
              disabled={
                !projectFormName.trim()
                || !projectFormDirty
                || createProjectMutation.isPending
                || updateProjectMutation.isPending
              }
            >
              {(createProjectMutation.isPending || updateProjectMutation.isPending) && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              {projectDialogMode === 'create' ? 'Tạo' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{goalDialogMode === 'create' ? 'Tạo goal' : 'Chỉnh sửa goal'}</DialogTitle>
            <DialogDescription>
              {goalDialogMode === 'create'
                ? 'Thêm goal mới cho project đã chọn.'
                : 'Cập nhật goal từ menu ngữ cảnh sidebar.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sidebar-goal-title">Tiêu đề goal</Label>
              <Input
                id="sidebar-goal-title"
                value={goalFormTitle}
                onChange={(event) => setGoalFormTitle(event.target.value)}
                placeholder="Ví dụ: Hoàn thành onboarding"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Loại goal</Label>
                <Select value={goalFormType} onValueChange={(value) => setGoalFormType(value as GoalType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHORT_TERM">Ngắn hạn</SelectItem>
                    <SelectItem value="MEDIUM_TERM">Trung hạn</SelectItem>
                    <SelectItem value="LONG_TERM">Dài hạn</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Trạng thái</Label>
                <Select value={goalFormStatus} onValueChange={(value) => setGoalFormStatus(value as GoalStatusType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_STARTED">Chưa bắt đầu</SelectItem>
                    <SelectItem value="IN_PROGRESS">Đang thực hiện</SelectItem>
                    <SelectItem value="ON_HOLD">Tạm dừng</SelectItem>
                    <SelectItem value="COMPLETED">Hoàn thành</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>Hủy</Button>
            <Button
              onClick={() => {
                if (goalDialogMode === 'create') {
                  createGoalMutation.mutate()
                } else {
                  updateGoalMutation.mutate()
                }
              }}
              disabled={
                !goalFormTitle.trim()
                || !goalFormDirty
                || createGoalMutation.isPending
                || updateGoalMutation.isPending
              }
            >
              {(createGoalMutation.isPending || updateGoalMutation.isPending) && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              {goalDialogMode === 'create' ? 'Tạo' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={`Xóa ${deleteTarget?.kind === 'project' ? 'project' : 'goal'}`}
        description={
          deleteTarget
            ? `Bạn có chắc muốn xóa "${deleteTarget.label}" không? Mục sẽ bị xóa sau 5 giây và bạn có thể hoàn tác trong thời gian đó.`
            : ''
        }
        confirmText="Xóa (5s undo)"
        confirmVariant="destructive"
        onConfirm={handleConfirmDelete}
      />

      <DeferredDeleteStack
        pendingDeletes={pendingSidebarDeletes}
        clockMs={sidebarDeleteClockMs}
        undoWindowMs={sidebarDeleteUndoWindowMs}
        onUndo={undoSidebarDelete}
        itemTitle={(entry) => (
          entry.payload.kind === 'project'
            ? 'Đang xóa project'
            : 'Đang xóa goal'
        )}
      />
    </>
  )
}

// ─── Project Item with expandable Goals ───

function ProjectItem({
  project,
  workspaceId,
  isActive,
  isExpanded,
  searchKeyword,
  hiddenGoalIds,
  onToggleExpand,
  onCreateGoal,
  onOpenContextMenu,
}: {
  project: Project
  workspaceId: number
  isActive: boolean
  isExpanded: boolean
  searchKeyword: string
  hiddenGoalIds: Set<number>
  onToggleExpand: () => void
  onCreateGoal: (project: Project) => void
  onOpenContextMenu: (event: MouseEvent<HTMLElement>, target: SidebarContextTarget) => void
}) {
  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.byProject(project.id, 1, 50),
    queryFn: () => goalApi.listByProject(project.id, { page: 1, size: 50 }),
    enabled: project.id > 0,
  })

  const goals = goalsQuery.data?.content ?? []
  const visibleGoals = goals.filter((goal) => !hiddenGoalIds.has(goal.id))
  const filteredGoals = searchKeyword
    ? visibleGoals.filter((goal) => goal.title.toLowerCase().includes(searchKeyword))
    : visibleGoals

  const projectMatches = !searchKeyword || project.name.toLowerCase().includes(searchKeyword)
  const hasGoalMatches = filteredGoals.length > 0

  if (searchKeyword && !projectMatches && goalsQuery.isSuccess && !hasGoalMatches) {
    return null
  }

  const expanded = isExpanded || Boolean(searchKeyword)

  const projectProgress = useMemo(() => {
    if (visibleGoals.length === 0) {
      return 0
    }

    const total = visibleGoals.reduce((sum, goal) => sum + normalizeProgress(goal.progressPercent), 0)
    return normalizeProgress(total / visibleGoals.length)
  }, [visibleGoals])

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
          onContextMenu={(event) => onOpenContextMenu(event, { kind: 'project', project })}
        >
          <FolderKanban className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate" title={project.name}>{highlightMatch(project.name, searchKeyword)}</span>
          <span
            className={cn(
              'shrink-0 text-right text-[10px] font-semibold tabular-nums',
              resolveProgressClass(projectProgress),
            )}
          >
            {projectProgress}%
          </span>
        </NavLink>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
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
              {visibleGoals.length === 0 && !goalsQuery.isLoading && (
                <p className="px-2 py-1 text-[11px] text-muted-foreground/75">Chưa có goal nào</p>
              )}
              {visibleGoals.length > 0 && filteredGoals.length === 0 && searchKeyword && !goalsQuery.isLoading ? (
                <div className="flex items-center justify-between gap-2 px-2 py-1">
                  <p className="text-[11px] text-muted-foreground/75">Không có goal phù hợp</p>
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => onCreateGoal(project)}>
                    <Plus className="size-3" />
                  </Button>
                </div>
              ) : null}
              {filteredGoals.map((goal) => {
                const normalizedProgress = normalizeProgress(goal.progressPercent)

                return (
                  <NavLink
                    key={goal.id}
                    to={`/workspaces/${workspaceId}/projects/${project.id}?view=goals`}
                    className="group grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_2.75rem] items-center gap-2 overflow-hidden rounded-md px-2 py-1 text-[12px] text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/75 hover:text-sidebar-accent-foreground"
                    onContextMenu={(event) => onOpenContextMenu(event, { kind: 'goal', goal, project })}
                  >
                    <Target className="size-3 shrink-0 text-muted-foreground/80" />
                    <span className="min-w-0 flex-1 truncate" title={goal.title}>{highlightMatch(goal.title, searchKeyword)}</span>
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
