import { FolderKanban, Gauge, Bell, CalendarClock, Goal, PanelsTopLeft, Activity } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils/cn'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: Gauge },
  { to: '/workspaces', label: 'Workspaces', icon: PanelsTopLeft },
  { to: '/notifications', label: 'Notifications', icon: Bell },
]

interface AppSidebarProps {
  workspaceId?: number
  projectId?: number
}

export function AppSidebar({ workspaceId, projectId }: AppSidebarProps) {
  const projectBase = workspaceId && projectId ? `/workspaces/${workspaceId}/projects/${projectId}` : undefined

  return (
    <aside className="hidden h-dvh w-72 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Link to="/dashboard" className="flex items-center gap-2 text-sm font-bold">
          <div className="size-2 rounded-full bg-accent" />
          Chronelis
        </Link>
      </div>

      <nav className="space-y-1 p-3">
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent',
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {projectBase ? (
        <div className="border-t border-sidebar-border p-3">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project</p>
          <div className="space-y-1">
            <SidebarSubLink to={`${projectBase}/kanban`} label="Kanban" icon={FolderKanban} />
            <SidebarSubLink to={`${projectBase}/goals`} label="Goals" icon={Goal} />
            <SidebarSubLink to={`${projectBase}/calendar`} label="Calendar" icon={CalendarClock} />
            <SidebarSubLink to={`${projectBase}/activity`} label="Activity" icon={Activity} />
          </div>
        </div>
      ) : null}
    </aside>
  )
}

function SidebarSubLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof FolderKanban }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
          isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent',
        )
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  )
}
