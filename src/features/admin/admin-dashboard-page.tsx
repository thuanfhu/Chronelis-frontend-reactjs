import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  RefreshCcw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/app/store/auth-store'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { queryKeys } from '@/lib/api/query-keys'
import { adminPermissionApi } from '@/lib/api/modules/admin-permission-api'
import { adminRoleApi } from '@/lib/api/modules/admin-role-api'
import { adminUserApi } from '@/lib/api/modules/admin-user-api'
import { isAdminUser } from '@/lib/auth/role-utils'

// --- New modular imports (PreziQ!-style) ---
import { UsersProvider, useUsers } from '@/features/admin/users/context/users-context'
import { UsersTable } from '@/features/admin/users/components/users-table'
import { UsersDialogs } from '@/features/admin/users/components/users-dialogs'
import { UsersPrimaryButtons } from '@/features/admin/users/components/users-primary-buttons'
import RolesProvider, { useRoles } from '@/features/admin/roles/context/roles-context'
import { RolesTable } from '@/features/admin/roles/components/roles-table'
import { RolesDialogs } from '@/features/admin/roles/components/roles-dialogs'
import { RolesPrimaryButtons } from '@/features/admin/roles/components/roles-primary-buttons'
import PermissionsProvider from '@/features/admin/permissions/context/permissions-context'
import { PermissionsTable } from '@/features/admin/permissions/components/permissions-table'
import { PermissionsPrimaryButtons } from '@/features/admin/permissions/components/permissions-primary-buttons'

const PAGE_SIZE = 200

type AdminSection = 'users' | 'roles' | 'permissions'

const ADMIN_SECTION_ORDER: AdminSection[] = ['users', 'roles', 'permissions']

function resolveAdminSection(value: string | undefined): AdminSection | null {
  if (!value) {
    return null
  }

  if ((ADMIN_SECTION_ORDER as string[]).includes(value)) {
    return value as AdminSection
  }

  return null
}


export function AdminDashboardPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ section?: string }>()
  const currentUser = useAuthStore((state) => state.currentUser)
  const parsedSection = resolveAdminSection(params.section)
  const activeSection: AdminSection = parsedSection ?? 'users'

  useEffect(() => {
    if (!parsedSection) {
      navigate('/admin/users', { replace: true })
    }
  }, [navigate, parsedSection])

  const shouldLoadUsers = activeSection === 'users'
  const shouldLoadRoles = activeSection === 'users' || activeSection === 'roles'
  const shouldLoadPermissions = activeSection === 'roles' || activeSection === 'permissions'
  const shouldLoadModules = activeSection === 'permissions'

  const rolesQuery = useQuery({
    queryKey: queryKeys.admin.roles(1, PAGE_SIZE),
    queryFn: () => adminRoleApi.list({ page: 1, size: PAGE_SIZE }),
    enabled: shouldLoadRoles,
  })

  const permissionsQuery = useQuery({
    queryKey: queryKeys.admin.permissions(1, PAGE_SIZE),
    queryFn: () => adminPermissionApi.list({ page: 1, size: PAGE_SIZE }),
    enabled: shouldLoadPermissions,
  })

  const usersQuery = useQuery({
    queryKey: queryKeys.admin.users(1, PAGE_SIZE),
    queryFn: () => adminUserApi.list({ page: 1, size: PAGE_SIZE }),
    enabled: shouldLoadUsers,
  })

  const modulesQuery = useQuery({
    queryKey: queryKeys.admin.modules,
    queryFn: adminPermissionApi.listModules,
    enabled: shouldLoadModules,
  })

  const isLoading = (shouldLoadRoles && rolesQuery.isLoading)
    || (shouldLoadPermissions && permissionsQuery.isLoading)
    || (shouldLoadUsers && usersQuery.isLoading)
    || (shouldLoadModules && modulesQuery.isLoading)

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me }),
    ])
  }

  if (isLoading) {
    return <LoadingPanel />
  }

  if (!isAdminUser(currentUser)) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-sm text-muted-foreground">
          {t('admin.accessDenied')}
        </CardContent>
      </Card>
    )
  }

  const sectionMeta = {
    label: t(`admin.sections.${activeSection}.label`),
    description: t(`admin.sections.${activeSection}.description`),
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('admin.consoleTitle')}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{sectionMeta.label}</h1>
          <p className="text-sm text-muted-foreground">{sectionMeta.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher showLabel className="rounded-full border border-border/70 bg-background/80 px-3 hover:bg-muted" />
          <Button variant="outline" onClick={() => void refreshAll()}>
            <RefreshCcw className="size-4" />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {activeSection === 'users' && (
        <UsersProvider>
          <NewUsersTabContent />
        </UsersProvider>
      )}

      {activeSection === 'roles' && (
        <RolesProvider>
          <NewRolesTabContent />
        </RolesProvider>
      )}

      {activeSection === 'permissions' && (
        <PermissionsProvider>
          <NewPermissionsTabContent />
        </PermissionsProvider>
      )}
    </div>
  )
}

// --- New modular tab content components ---
function NewUsersTabContent() {
  const { users, isLoading } = useUsers()
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('userManagement.title', 'Quản lý người dùng')}</CardTitle>
            <CardDescription>{t('userManagement.description', 'Quản lý tài khoản người dùng trong hệ thống')}</CardDescription>
          </div>
          <UsersPrimaryButtons />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <UsersTable data={users} />
        )}
      </CardContent>
      <UsersDialogs />
    </Card>
  )
}

function NewRolesTabContent() {
  const { roles, isLoading } = useRoles()
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('roleManagement.title', 'Quản lý vai trò')}</CardTitle>
            <CardDescription>{t('roleManagement.description', 'Quản lý vai trò và quyền hạn trong hệ thống')}</CardDescription>
          </div>
          <RolesPrimaryButtons />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <RolesTable data={roles} />
        )}
      </CardContent>
      <RolesDialogs />
    </Card>
  )
}

function NewPermissionsTabContent() {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('permissionManagement.title', 'Quản lý phân quyền')}</CardTitle>
            <CardDescription>{t('permissionManagement.description', 'Quản lý quyền truy cập API trong hệ thống')}</CardDescription>
          </div>
          <PermissionsPrimaryButtons />
        </div>
      </CardHeader>
      <CardContent>
        <PermissionsTable />
      </CardContent>
    </Card>
  )
}
