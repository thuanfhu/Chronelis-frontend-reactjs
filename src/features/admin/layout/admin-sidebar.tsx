import { ChevronRight, LayoutDashboard, LogOut, Package, ShieldAlert, User2, Users, X } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/auth-store'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface AdminSidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
}

interface AdminNavItem {
  label: string
  description: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    label: 'Roles',
    description: 'Vai trò hệ thống',
    to: '/admin/roles',
    icon: Package,
  },
  {
    label: 'Permissions',
    description: 'Quyền truy cập API',
    to: '/admin/permissions',
    icon: ShieldAlert,
  },
  {
    label: 'Users',
    description: 'Quản lý tài khoản',
    to: '/admin/users',
    icon: Users,
  },
]

function getInitials(fullName: string): string {
  if (!fullName.trim()) {
    return 'AD'
  }

  const words = fullName.trim().split(/\s+/)
  const initials = words.slice(0, 2).map((word) => word[0] ?? '').join('')
  return initials.toUpperCase() || 'AD'
}

export function AdminSidebar({ mobileOpen, onCloseMobile }: AdminSidebarProps) {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const clearSession = useAuthStore((state) => state.clearSession)

  const fullName = `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim()

  const handleLogout = () => {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 md:static md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-2.5"
          onClick={onCloseMobile}
        >
          <span className="inline-flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            C
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">Chronelis</span>
            <span className="block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Admin</span>
          </span>
        </Link>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 md:hidden"
          onClick={onCloseMobile}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/90">
          Administration
        </p>

        <Button
          type="button"
          variant="outline"
          className="mt-3 h-9 w-full justify-start border-sidebar-border bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/15"
          onClick={() => {
            onCloseMobile()
            navigate('/dashboard')
          }}
        >
          <LayoutDashboard className="size-4" />
          Quay lại Workspace
        </Button>

        <nav className="mt-2 space-y-1">
          {ADMIN_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  isActive
                    ? 'border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'border-transparent text-sidebar-foreground/85 hover:border-sidebar-border/70 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground',
                )
              }
            >
              <item.icon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
              </span>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-lg border border-sidebar-border/80 bg-sidebar-accent/35 p-2.5">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-9">
              <AvatarFallback className="bg-sidebar-primary/15 text-xs font-semibold text-sidebar-primary">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{fullName || 'Administrator'}</p>
              <p className="truncate text-xs text-muted-foreground">{currentUser?.email || 'admin@chronelis.local'}</p>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                onCloseMobile()
                navigate('/profile')
              }}
            >
              <User2 className="size-3.5" />
              Profile
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="mt-2 h-8 w-full justify-start px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="size-3.5" />
            Đăng xuất
          </Button>
        </div>
      </div>
    </aside>
  )
}
