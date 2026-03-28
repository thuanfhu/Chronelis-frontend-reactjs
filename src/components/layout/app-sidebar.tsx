import { FolderKanban, Gauge, Bell, CalendarClock, Goal, PanelsTopLeft, Activity, ChevronRight, Search, LogOut, LayoutDashboard, Menu } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen)
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen)
  const clearSession = useAuthStore((state) => state.clearSession)

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

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-dvh w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary">
              <span className="text-xs font-bold text-primary-foreground">C</span>
            </div>
            <span className="text-sm font-bold tracking-tight">Chronelis</span>
          </Link>
          <Button variant="ghost" size="icon" className="size-7 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <Menu className="size-4" />
          </Button>
        </div>

        {/* Quick search button */}
        <div className="px-3 py-2">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Tìm kiếm...</span>
            <kbd className="rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </button>
        </div>

        <ScrollArea className="flex-1">
          {/* Main navigation */}
          <nav className="space-y-0.5 px-3 pb-2">
            <p className="mb-1 px-2 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Chính</p>
            {mainNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <Separator className="mx-3 bg-sidebar-border" />

          {/* Workspaces section */}
          {workspaces.length > 0 && (
            <div className="px-3 py-2">
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Workspaces</p>
              <div className="space-y-0.5">
                {workspaces.map((ws) => (
                  <NavLink
                    key={ws.id}
                    to={`/workspaces/${ws.id}`}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                      )
                    }
                  >
                    <div className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                      {ws.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{ws.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}

          {/* Projects under selected workspace */}
          {workspaceId && projects.length > 0 && (
            <>
              <Separator className="mx-3 bg-sidebar-border" />
              <div className="px-3 py-2">
                <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Projects</p>
                <div className="space-y-0.5">
                  {projects.map((proj) => (
                    <NavLink
                      key={proj.id}
                      to={`/workspaces/${workspaceId}/projects/${proj.id}`}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                          isActive
                            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                        )
                      }
                    >
                      <FolderKanban className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{proj.name}</span>
                      <ChevronRight className="ml-auto size-3 text-muted-foreground/50" />
                    </NavLink>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Project sub-navigation */}
          {projectBase && (
            <>
              <Separator className="mx-3 bg-sidebar-border" />
              <div className="px-3 py-2">
                <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Project View</p>
                <div className="space-y-0.5">
                  <SidebarSubLink to={projectBase} label="Tổng quan" icon={Gauge} end />
                  <SidebarSubLink to={`${projectBase}/kanban`} label="Kanban Board" icon={FolderKanban} />
                  <SidebarSubLink to={`${projectBase}/goals`} label="Goals" icon={Goal} />
                  <SidebarSubLink to={`${projectBase}/calendar`} label="Lịch" icon={CalendarClock} />
                  <SidebarSubLink to={`${projectBase}/activity`} label="Hoạt động" icon={Activity} />
                </div>
              </div>
            </>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="size-4" />
                Đăng xuất
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Đăng xuất khỏi tài khoản</TooltipContent>
          </Tooltip>
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
          'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )
      }
    >
      <Icon className="size-3.5" />
      {label}
    </NavLink>
  )
}
