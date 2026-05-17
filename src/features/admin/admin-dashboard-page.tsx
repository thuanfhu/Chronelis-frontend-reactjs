import { useEffect } from 'react'
import {
  RefreshCcw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/app/store/auth-store'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTableSkeleton } from '@/components/ui/data-table-skeleton'
import { isAdminUser } from '@/lib/auth/role-utils'

// --- Modular imports (PreziQ!-style) ---
import { UsersProvider, useUsers } from '@/features/admin/users/context/users-context'
import { UsersTable } from '@/features/admin/users/components/users-table'
import { UsersDialogs } from '@/features/admin/users/components/users-dialogs'
import { UsersPrimaryButtons } from '@/features/admin/users/components/users-primary-buttons'
import RolesProvider, { useRoles } from '@/features/admin/roles/context/roles-context'
import { RolesTable } from '@/features/admin/roles/components/roles-table'
import { RolesDialogs } from '@/features/admin/roles/components/roles-dialogs'
import { RolesPrimaryButtons } from '@/features/admin/roles/components/roles-primary-buttons'
import PermissionsProvider, { usePermissions } from '@/features/admin/permissions/context/permissions-context'
import { Input } from '@/components/ui/input'
import { IconSearch, IconChevronsDown, IconChevronsUp } from '@tabler/icons-react'
import { PermissionsTable } from '@/features/admin/permissions/components/permissions-table'
import { PermissionsPrimaryButtons } from '@/features/admin/permissions/components/permissions-primary-buttons'

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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{sectionMeta.label}</h1>
          <p className="text-sm text-muted-foreground">{sectionMeta.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher showLabel className="rounded-full border border-border/70 bg-background/80 px-3 hover:bg-muted" />
          <Button variant="outline" onClick={() => navigate(0)}>
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

// --- Tab content components ---
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
          {!isLoading && <UsersPrimaryButtons />}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <DataTableSkeleton columns={7} rows={6} />
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
          {!isLoading && <RolesPrimaryButtons />}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <DataTableSkeleton columns={6} rows={5} />
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
  const { searchQuery, setSearchQuery, expandAll, collapseAll, collapsedModules, modules, setCollapsedModules } = usePermissions()
  
  useEffect(() => {
    setCollapsedModules({})
  }, [setCollapsedModules])
  
  const isAllCollapsed = modules.length > 0 && modules.every(m => collapsedModules[m] !== false)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('permissionManagement.title', 'Quản lý phân quyền')}</CardTitle>
            <CardDescription>{t('permissionManagement.description', 'Quản lý quyền truy cập API trong hệ thống')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <IconSearch className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t('searchPlaceholder', 'Tìm kiếm...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50 dark:bg-zinc-800"
              />
            </div>
            
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                if (isAllCollapsed) {
                  expandAll()
                } else {
                  collapseAll()
                }
              }}
              title={isAllCollapsed ? t('permissionManagement.expandAllModules', 'Hiển thị toàn bộ module') : t('permissionManagement.collapseAllModules', 'Đóng toàn bộ module')}
            >
              {isAllCollapsed ? (
                <IconChevronsDown className="h-4 w-4 text-slate-600" />
              ) : (
                <IconChevronsUp className="h-4 w-4 text-slate-600" />
              )}
            </Button>

            <PermissionsPrimaryButtons />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <PermissionsTable />
      </CardContent>
    </Card>
  )
}
