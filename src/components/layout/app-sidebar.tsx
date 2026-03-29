import { useState } from 'react'
import {
  FolderKanban, ChevronRight, Search, LogOut, Menu,
  ChevronsLeft, ChevronDown, Target,
} from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/app/store/ui-store'
import { useAuthStore } from '@/app/store/auth-store'
import { projectApi } from '@/lib/api/modules/project-api'
import { goalApi } from '@/lib/api/modules/goal-api'
import { queryKeys } from '@/lib/api/query-keys'

interface AppSidebarProps {
  workspaceId?: number
  projectId?: number
}

export function AppSidebar({ workspaceId, projectId }: AppSidebarProps) {
  const navigate = useNavigate()
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen)
  const clearSession = useAuthStore((s) => s.clearSession)

  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(
    () => new Set(projectId ? [projectId] : []),
  )

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.byWorkspace(workspaceId ?? 0, 1, 50),
    queryFn: () => projectApi.listByWorkspace(workspaceId!, { page: 1, size: 50 }),
    enabled: !!workspaceId,
  })

  const projects = projectsQuery.data?.content ?? []

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

  // Desktop collapsed = sidebarCollapsed && not forced open by mobile toggle
  const collapsed = sidebarCollapsed && !sidebarOpen

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
          collapsed ? 'lg:w-17' : 'w-68',
        )}
      >
        {/* ─── Brand header ─── */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-3">
          <Link to="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-primary to-primary/80 shadow-sm">
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
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="hidden size-7 text-muted-foreground hover:text-foreground lg:flex"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <ChevronsLeft className={cn('size-4 transition-transform duration-300', collapsed && 'rotate-180')} />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 lg:hidden" onClick={() => setSidebarOpen(false)}>
              <Menu className="size-4" />
            </Button>
          </div>
        </div>

        {/* ─── Quick search ─── */}
        {!collapsed ? (
          <div className="px-3 py-2">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-sidebar-accent hover:shadow-sm"
            >
              <Search className="size-3.5" />
              <span className="flex-1 text-left">Tìm kiếm...</span>
              <kbd className="rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>
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
              <button
                onClick={() => setProjectsExpanded(!projectsExpanded)}
                className="mb-1 flex w-full items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 transition-colors hover:text-muted-foreground"
              >
                <ChevronDown className={cn('size-3 transition-transform duration-200', !projectsExpanded && '-rotate-90')} />
                Projects
              </button>
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
                      {projects.map((proj) => (
                        <ProjectItem
                          key={proj.id}
                          project={proj}
                          workspaceId={workspaceId}
                          isActive={projectId === proj.id}
                          isExpanded={expandedProjects.has(proj.id)}
                          onToggleExpand={() => toggleProjectExpand(proj.id)}
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
              {projects.map((proj) => (
                <Tooltip key={proj.id}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={`/workspaces/${workspaceId}/projects/${proj.id}`}
                      className={({ isActive }) =>
                        cn(
                          'flex size-9 items-center justify-center rounded-lg transition-all duration-150',
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
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
                  className="group flex w-full items-center justify-center rounded-lg p-2.5 text-sidebar-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="size-4 icon-hover" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Đăng xuất</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-sidebar-foreground/70 transition-all duration-150 hover:bg-destructive/10 hover:text-destructive"
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
}: {
  project: { id: number; name: string }
  workspaceId: number
  isActive: boolean
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.byProject(project.id, 1, 50),
    queryFn: () => goalApi.listByProject(project.id, { page: 1, size: 50 }),
    enabled: isExpanded,
  })

  const goals = goalsQuery.data?.content ?? []

  return (
    <div>
      <div className="flex items-center">
        <button
          onClick={onToggleExpand}
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:text-muted-foreground"
        >
          <ChevronRight className={cn('size-3 transition-transform duration-200', isExpanded && 'rotate-90')} />
        </button>
        <NavLink
          to={`/workspaces/${workspaceId}/projects/${project.id}`}
          className={cn(
            'flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-all duration-150',
            isActive
              ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
          )}
        >
          <FolderKanban className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{project.name}</span>
        </NavLink>
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
                <p className="px-2 py-1 text-[11px] text-muted-foreground/50">Đang tải...</p>
              )}
              {goals.length === 0 && !goalsQuery.isLoading && (
                <p className="px-2 py-1 text-[11px] text-muted-foreground/50">Chưa có goal nào</p>
              )}
              {goals.map((goal) => (
                <NavLink
                  key={goal.id}
                  to={`/workspaces/${workspaceId}/projects/${project.id}?view=goals`}
                  className="group flex items-center gap-2 rounded-md px-2 py-1 text-[12px] text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                >
                  <Target className="size-3 shrink-0 text-muted-foreground/60" />
                  <span className="flex-1 truncate">{goal.title}</span>
                  {goal.progressPercent != null && goal.progressPercent > 0 && (
                    <span className="text-[10px] text-muted-foreground/50">{goal.progressPercent}%</span>
                  )}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
