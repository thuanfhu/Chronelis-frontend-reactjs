import { useState } from 'react'
import { ChevronRight, LayoutDashboard, LogOut, Package, ShieldAlert, Users, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/auth-store'
import { useUiStore } from '@/app/store/ui-store'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

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

function getInitials(fullName: string): string {
  if (!fullName.trim()) {
    return 'AD'
  }

  const words = fullName.trim().split(/\s+/)
  const initials = words
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
  return initials.toUpperCase() || 'AD'
}

export function AdminSidebar({ mobileOpen, onCloseMobile }: AdminSidebarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const clearSession = useAuthStore((state) => state.clearSession)
  const selectedWorkspaceId = useUiStore((state) => state.selectedWorkspaceId)
  const selectedProjectId = useUiStore((state) => state.selectedProjectId)
  const theme = useUiStore((state) => state.theme)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const fullName = `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim()
  const adminNavItems: AdminNavItem[] = [
    {
      label: t('admin.sections.roles.label'),
      description: t('admin.sections.roles.description'),
      to: '/admin/roles',
      icon: Package,
    },
    {
      label: t('admin.sections.permissions.label'),
      description: t('admin.sections.permissions.description'),
      to: '/admin/permissions',
      icon: ShieldAlert,
    },
    {
      label: t('admin.sections.users.label'),
      description: t('admin.sections.users.description'),
      to: '/admin/users',
      icon: Users,
    },
  ]

  const resolveWorkspaceReturnPath = () => {
    if (!selectedWorkspaceId) {
      return '/dashboard'
    }

    if (selectedProjectId) {
      return `/workspaces/${selectedWorkspaceId}/projects/${selectedProjectId}`
    }

    return `/workspaces/${selectedWorkspaceId}`
  }

  const handleLogout = () => {
    clearSession()
    toast.success(t('common.toast.logoutSuccess'))
    setLogoutConfirmOpen(false)
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
        <Link to="/admin/users" className="inline-flex items-center gap-2.5 relative" onClick={onCloseMobile}>
          <div className="relative h-7 w-32 flex items-center">
            <img
              src={theme === 'dark' ? '/favicon/chronelis-logo-darkmode.png' : '/favicon/chronelis-logo-lightmode.png'}
              alt="Chronelis"
              className={`h-28 w-auto absolute top-1/2 left-0 -translate-y-1/2 pointer-events-none max-w-none origin-left transition-all duration-300 ${theme === 'dark' ? 'scale-[0.78]' : ''}`}
            />
          </div>
        </Link>

        <Button type="button" variant="ghost" size="icon" className="size-8 md:hidden" onClick={onCloseMobile}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/90">
          {t('admin.sidebar.sectionLabel')}
        </p>

        <Button
          type="button"
          variant="outline"
          className="mt-3 h-9 w-full justify-start border-sidebar-border bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/15"
          onClick={() => {
            onCloseMobile()
            navigate(resolveWorkspaceReturnPath())
          }}
        >
          <LayoutDashboard className="size-4" />
          {t('admin.sidebar.backToWorkspace')}
        </Button>

        <nav className="mt-2 space-y-1">
          {adminNavItems.map((item) => (
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
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors hover:bg-sidebar-primary/10"
            onClick={() => {
              onCloseMobile()
              navigate('/profile')
            }}
          >
            <Avatar className="size-9">
              <AvatarFallback className="bg-sidebar-primary/15 text-xs font-semibold text-sidebar-primary">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium">{fullName || t('admin.sidebar.defaultName')}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {currentUser?.email || 'admin@chronelis.local'}
              </span>
            </span>
          </button>

          <Button
            type="button"
            variant="ghost"
            className="mt-2 h-8 w-full justify-start px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setLogoutConfirmOpen(true)}
          >
            <LogOut className="size-3.5" />
            {t('common.logout')}
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        title={t('admin.sidebar.logoutTitle')}
        description={t('admin.sidebar.logoutDescription')}
        confirmText={t('common.logout')}
        confirmVariant="destructive"
        onConfirm={handleLogout}
      />
    </aside>
  )
}
