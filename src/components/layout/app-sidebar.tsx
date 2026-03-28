import { useState } from 'react'
import {
  FolderKanban, Gauge, Bell, CalendarClock, Goal, PanelsTopLeft, Activity,
  ChevronRight, Search, LogOut, LayoutDashboard, Menu,
  ChevronsLeft, ChevronDown,
} from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/app/store/ui-store'
import { useAuthStore } from '@/app/store/auth-store'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { projectApi } from '@/lib/api/modules/project-api'
import { queryKeys } from '@/lib/api/query-keys'

const mainNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/workspaces', label: 'Workspaces', icon: PanelsTopLeft },
  { to: '/notifications', label: 'Thông báo', icon: Bell },
]

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

  const [workspacesExpanded, setWorkspacesExpanded] = useState(true)
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [projectViewExpanded, setProjectViewExpanded] = useState(true)

  const projectBase = workspaceId && projectId ? `/workspaces/${workspaceId}/projects/${projectId}` : undefined

  const workspacesQuery = useQuery({
    queryKey: queryKeys.workspaces.list(1, 20),
    queryFn: () => workspaceApi.list({ page: 1, size: 20 }),
  })

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.byWorkspace(workspaceId ?? 0, 1, 20),
    queryFn: () => projectApi.listByWorkspace(workspaceId!, { page: 1, size: 20 }),
    enabled: !!workspaceId,
  })

  const workspaces = workspacesQuery.data?.content ?? []
  const projects = projectsQuery.data?.content ?? []

  const handleLogout = () => {
    clearSession()
    navigate('/login')
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
          {/* Main navigation */}
          <nav className="space-y-0.5 px-2 pb-2">
            {!collapsed && (
              <p className="mb-1 px-2 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Chính
              </p>
            )}
            {mainNav.map((item) =>
              collapsed ? (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center justify-center rounded-lg p-2.5 transition-all duration-150',
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        )
                      }
                    >
                      <item.icon className="size-4 icon-hover" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-150',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                        : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )
                  }
                >
                  <item.icon className="size-4 icon-hover-bounce" />
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>

          {!collapsed && <Separator className="mx-3 bg-sidebar-border" />}

          {/* ─── Workspaces section ─── */}
          {workspaces.length > 0 && !collapsed && (
            <div className="px-2 py-2">
              <button
                onClick={() => setWorkspacesExpanded(!workspacesExpanded)}
                className="mb-1 flex w-full items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 transition-colors hover:text-muted-foreground"
              >
                <ChevronDown className={cn('size-3 transition-transform duration-200', !workspacesExpanded && '-rotate-90')} />
                Workspaces
              </button>
              <AnimatePresence initial={false}>
                {workspacesExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5">
                      {workspaces.map((ws) => (
                        <NavLink
                          key={ws.id}
                          to={`/workspaces/${ws.id}`}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-all duration-150',
                              isActive
                                ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                                : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                            )
                          }
                        >
                          <div className="flex size-5 shrink-0 items-center justify-center rounded bg-linear-to-br from-primary/15 to-accent/10 text-[10px] font-bold text-primary">
                            {ws.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{ws.name}</span>
                        </NavLink>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Collapsed: workspace icons only */}
          {workspaces.length > 0 && collapsed && (
            <div className="flex flex-col items-center gap-0.5 px-2 py-2">
              {workspaces.slice(0, 5).map((ws) => (
                <Tooltip key={ws.id}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={`/workspaces/${ws.id}`}
                      className={({ isActive }) =>
                        cn(
                          'flex size-9 items-center justify-center rounded-lg transition-all duration-150',
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                        )
                      }
                    >
                      <div className="flex size-6 items-center justify-center rounded bg-linear-to-br from-primary/15 to-accent/10 text-[10px] font-bold text-primary">
                        {ws.name.charAt(0).toUpperCase()}
                      </div>
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">{ws.name}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}

          {/* ─── Projects section ─── */}
          {workspaceId && projects.length > 0 && !collapsed && (
            <>
              <Separator className="mx-3 bg-sidebar-border" />
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
                          <NavLink
                            key={proj.id}
                            to={`/workspaces/${workspaceId}/projects/${proj.id}`}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-all duration-150',
                                isActive
                                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                                  : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                              )
                            }
                          >
                            <FolderKanban className="size-3.5 shrink-0 text-muted-foreground icon-hover" />
                            <span className="truncate">{proj.name}</span>
                            <ChevronRight className="ml-auto size-3 text-muted-foreground/40" />
                          </NavLink>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* ─── Project sub-navigation ─── */}
          {projectBase && !collapsed && (
            <>
              <Separator className="mx-3 bg-sidebar-border" />
              <div className="px-2 py-2">
                <button
                  onClick={() => setProjectViewExpanded(!projectViewExpanded)}
                  className="mb-1 flex w-full items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                >
                  <ChevronDown className={cn('size-3 transition-transform duration-200', !projectViewExpanded && '-rotate-90')} />
                  Project View
                </button>
                <AnimatePresence initial={false}>
                  {projectViewExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5">
                        <SidebarSubLink to={projectBase} label="Tổng quan" icon={Gauge} end />
                        <SidebarSubLink to={`${projectBase}/kanban`} label="Kanban Board" icon={FolderKanban} />
                        <SidebarSubLink to={`${projectBase}/goals`} label="Goals" icon={Goal} />
                        <SidebarSubLink to={`${projectBase}/calendar`} label="Lịch" icon={CalendarClock} />
                        <SidebarSubLink to={`${projectBase}/activity`} label="Hoạt động" icon={Activity} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* Collapsed: project view icons only */}
          {projectBase && collapsed && (
            <div className="flex flex-col items-center gap-0.5 px-2 py-2">
              {[
                { to: projectBase, label: 'Tổng quan', icon: Gauge, end: true },
                { to: `${projectBase}/kanban`, label: 'Kanban', icon: FolderKanban },
                { to: `${projectBase}/goals`, label: 'Goals', icon: Goal },
                { to: `${projectBase}/calendar`, label: 'Lịch', icon: CalendarClock },
                { to: `${projectBase}/activity`, label: 'Hoạt động', icon: Activity },
              ].map((item) => (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          'flex size-9 items-center justify-center rounded-lg transition-all duration-150',
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        )
                      }
                    >
                      <item.icon className="size-4" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
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

function SidebarSubLink({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof FolderKanban; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )
      }
    >
      <Icon className="size-3.5 icon-hover" />
      {label}
    </NavLink>
  )
}
