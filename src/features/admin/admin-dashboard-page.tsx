import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Power,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/app/store/auth-store'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { RoleBadge } from '@/features/admin/components/role-badge'
import { queryKeys } from '@/lib/api/query-keys'
import { adminPermissionApi, type CreatePermissionPayload, type UpdatePermissionPayload } from '@/lib/api/modules/admin-permission-api'
import { adminRoleApi, type CreateRolePayload, type UpdateRolePayload } from '@/lib/api/modules/admin-role-api'
import { adminUserApi, type UpdateUserForAdminPayload } from '@/lib/api/modules/admin-user-api'
import type { AdminPermission, AdminRole, AdminUser, HttpMethodName } from '@/lib/api/modules/admin-types'
import { isAdminUser } from '@/lib/auth/role-utils'
import { cn } from '@/lib/utils/cn'

const PAGE_SIZE = 200
const TABLE_PAGE_SIZE = 7
const NO_MODULE = '__NO_MODULE__'
const HTTP_METHODS: HttpMethodName[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const ICON_ACTION_BUTTON_BASE = 'size-8 rounded-full p-0 transition-all duration-200 hover:scale-110 focus-visible:scale-110'

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

function resolveMethodBadgeClass(method: string): string {
  const normalized = method.trim().toUpperCase()

  switch (normalized) {
    case 'GET':
      return 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/45 dark:bg-emerald-500/15 dark:text-emerald-200'
    case 'POST':
      return 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-500/45 dark:bg-blue-500/15 dark:text-blue-200'
    case 'PUT':
      return 'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-500/45 dark:bg-violet-500/15 dark:text-violet-200'
    case 'PATCH':
      return 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/45 dark:bg-amber-500/15 dark:text-amber-200'
    case 'DELETE':
      return 'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-500/45 dark:bg-rose-500/15 dark:text-rose-200'
    default:
      return 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-500/45 dark:bg-slate-500/15 dark:text-slate-200'
  }
}

const MODULE_BADGE_STYLES = [
  'border-cyan-300 bg-cyan-100 text-cyan-800 dark:border-cyan-500/45 dark:bg-cyan-500/15 dark:text-cyan-200',
  'border-fuchsia-300 bg-fuchsia-100 text-fuchsia-800 dark:border-fuchsia-500/45 dark:bg-fuchsia-500/15 dark:text-fuchsia-200',
  'border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-500/45 dark:bg-orange-500/15 dark:text-orange-200',
  'border-lime-300 bg-lime-100 text-lime-800 dark:border-lime-500/45 dark:bg-lime-500/15 dark:text-lime-200',
  'border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-500/45 dark:bg-sky-500/15 dark:text-sky-200',
  'border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-500/45 dark:bg-purple-500/15 dark:text-purple-200',
] as const

function resolveModuleBadgeClass(moduleName: string): string {
  let hash = 0
  for (let index = 0; index < moduleName.length; index += 1) {
    hash = ((hash << 5) - hash) + moduleName.charCodeAt(index)
    hash |= 0
  }

  return MODULE_BADGE_STYLES[Math.abs(hash) % MODULE_BADGE_STYLES.length]
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

  const roles = rolesQuery.data?.content ?? []
  const permissions = permissionsQuery.data?.content ?? []
  const users = usersQuery.data?.content ?? []
  const modules = modulesQuery.data ?? []

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
        <UsersAdminTab
          users={users}
          roles={roles}
          currentUserId={currentUser?.userId}
          onDataChanged={() => void refreshAll()}
        />
      )}

      {activeSection === 'roles' && (
        <RolesAdminTab
          roles={roles}
          permissions={permissions}
          onDataChanged={() => void refreshAll()}
        />
      )}

      {activeSection === 'permissions' && (
        <PermissionsAdminTab
          permissions={permissions}
          modules={modules}
          onDataChanged={() => void refreshAll()}
        />
      )}
    </div>
  )
}

interface AdminTablePaginationProps {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (nextPage: number) => void
}

function AdminTablePagination({ page, pageSize, totalItems, onPageChange }: AdminTablePaginationProps) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(page, totalPages)
  const startItem = totalItems === 0 ? 0 : ((safePage - 1) * pageSize) + 1
  const endItem = Math.min(safePage * pageSize, totalItems)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">
        {t('admin.paginationSummary', { start: startItem, end: endItem, total: totalItems })}
      </p>
      <div className="inline-flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
        >
          <ChevronLeft className="size-3.5" />
          {t('common.previous')}
        </Button>
        <span className="min-w-14 text-center text-xs font-medium">
          {safePage}/{totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
        >
          {t('common.next')}
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

interface UsersAdminTabProps {
  users: AdminUser[]
  roles: AdminRole[]
  currentUserId?: string
  onDataChanged: () => void
}

interface UserEditFormState {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  nickname: string
  biography: string
  city: string
  nationality: string
  isVerified: boolean
}

const EMPTY_USER_FORM: UserEditFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  nickname: '',
  biography: '',
  city: '',
  nationality: '',
  isVerified: false,
}

function UsersAdminTab({ users, roles, currentUserId, onDataChanged }: UsersAdminTabProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUser | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [form, setForm] = useState<UserEditFormState>(EMPTY_USER_FORM)
  const [addRoleId, setAddRoleId] = useState('')
  const [removeRoleId, setRemoveRoleId] = useState('')

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return users
    }

    return users.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase()
      const roleNames = (user.roles ?? []).map((role) => role.name).join(' ').toLowerCase()

      return (
        user.email.toLowerCase().includes(q)
        || fullName.includes(q)
        || (user.phoneNumber ?? '').toLowerCase().includes(q)
        || roleNames.includes(q)
      )
    })
  }, [search, users])

  const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / TABLE_PAGE_SIZE))
  const safeUsersPage = Math.min(page, usersTotalPages)
  const paginatedUsers = useMemo(() => {
    const start = (safeUsersPage - 1) * TABLE_PAGE_SIZE
    return filteredUsers.slice(start, start + TABLE_PAGE_SIZE)
  }, [filteredUsers, safeUsersPage])

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    if (page !== safeUsersPage) {
      setPage(safeUsersPage)
    }
  }, [page, safeUsersPage])

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateUserForAdminPayload }) => adminUserApi.update(userId, payload),
    onSuccess: () => {
      toast.success(t('admin.users.updateSuccess'))
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error(t('admin.users.updateFailed'), { description: error.message })
    },
  })

  const addRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => adminUserApi.update(userId, { roleIds: [roleId] }),
    onSuccess: () => {
      toast.success(t('admin.users.addRoleSuccess'))
      setAddRoleId('')
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error(t('admin.users.addRoleFailed'), { description: error.message })
    },
  })

  const removeRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => adminUserApi.deleteRoles(userId, { roleIds: [roleId] }),
    onSuccess: () => {
      toast.success(t('admin.users.removeRoleSuccess'))
      setRemoveRoleId('')
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error(t('admin.users.removeRoleFailed'), { description: error.message })
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => adminUserApi.remove(userId),
    onSuccess: () => {
      toast.success(t('admin.users.deleteSuccess'))
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error(t('admin.users.deleteFailed'), { description: error.message })
    },
  })

  const openEditDialog = (user: AdminUser) => {
    setEditingUser(user)
    setForm({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email ?? '',
      phoneNumber: user.phoneNumber ?? '',
      nickname: user.nickname ?? '',
      biography: user.biography ?? '',
      city: user.city ?? '',
      nationality: user.nationality ?? '',
      isVerified: Boolean(user.isVerified),
    })
    setAddRoleId('')
    setRemoveRoleId('')
    setEditOpen(true)
  }

  const closeEditDialog = () => {
    if (updateUserMutation.isPending || addRoleMutation.isPending || removeRoleMutation.isPending) {
      return
    }

    setEditOpen(false)
    setEditingUser(null)
    setForm(EMPTY_USER_FORM)
    setAddRoleId('')
    setRemoveRoleId('')
  }

  const submitUserUpdate = () => {
    if (!editingUser) {
      return
    }

    const payload: UpdateUserForAdminPayload = {}
    const firstName = form.firstName.trim()
    const lastName = form.lastName.trim()
    const email = form.email.trim()
    const phoneNumber = form.phoneNumber.trim()
    const nickname = form.nickname.trim()
    const biography = form.biography.trim()
    const city = form.city.trim()
    const nationality = form.nationality.trim()

    if (firstName && firstName !== editingUser.firstName) {
      payload.firstName = firstName
    }

    if (lastName && lastName !== editingUser.lastName) {
      payload.lastName = lastName
    }

    if (email && email.toLowerCase() !== editingUser.email.toLowerCase()) {
      payload.email = email
    }

    if (phoneNumber && phoneNumber !== (editingUser.phoneNumber ?? '')) {
      payload.phoneNumber = phoneNumber
    }

    if (nickname && nickname !== (editingUser.nickname ?? '')) {
      payload.nickname = nickname
    }

    if (biography && biography !== (editingUser.biography ?? '')) {
      payload.biography = biography
    }

    if (city && city !== (editingUser.city ?? '')) {
      payload.city = city
    }

    if (nationality && nationality !== (editingUser.nationality ?? '')) {
      payload.nationality = nationality
    }

    if (form.isVerified !== Boolean(editingUser.isVerified)) {
      payload.isVerified = form.isVerified
    }

    if (Object.keys(payload).length === 0) {
      toast.info(t('admin.noChanges'))
      return
    }

    updateUserMutation.mutate({ userId: editingUser.userId, payload })
  }

  const availableRolesToAdd = useMemo(() => {
    if (!editingUser) {
      return []
    }

    const assignedRoleIds = new Set((editingUser.roles ?? []).map((role) => role.roleId))
    return roles.filter((role) => !assignedRoleIds.has(role.roleId))
  }, [editingUser, roles])

  const assignedRoles = editingUser?.roles ?? []

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{t('admin.users.title')}</CardTitle>
            <CardDescription>
              {t('admin.users.description')}
            </CardDescription>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('admin.users.searchPlaceholder')}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="w-full overflow-x-auto rounded-md border">
          <Table className="min-w-195">
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.users.tableUser')}</TableHead>
                <TableHead>{t('admin.users.tableContact')}</TableHead>
                <TableHead className="w-44 px-2">
                  <div className="flex items-center justify-center text-center">{t('admin.users.tableRole')}</div>
                </TableHead>
                <TableHead>{t('admin.users.tableStatus')}</TableHead>
                <TableHead className="w-32 px-2">
                  <div className="flex items-center justify-center text-center">{t('admin.users.tableActions')}</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell>
                    <p className="font-medium">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-muted-foreground">ID: {user.userId}</p>
                  </TableCell>
                  <TableCell>
                    <p>{user.email}</p>
                    <p className="text-xs text-muted-foreground">{user.phoneNumber || t('admin.users.phoneEmpty')}</p>
                  </TableCell>
                  <TableCell className="px-2">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {(user.roles ?? []).length === 0 ? (
                        <Badge variant="outline" className="text-muted-foreground">{t('admin.users.noRole')}</Badge>
                      ) : (
                        (user.roles ?? []).map((role) => (
                          <RoleBadge key={role.roleId} roleName={role.name} />
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'inline-flex items-center gap-1.5',
                        user.isVerified
                          ? 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/45 dark:bg-emerald-500/15 dark:text-emerald-200'
                          : 'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-500/45 dark:bg-rose-500/15 dark:text-rose-200',
                      )}
                    >
                      {user.isVerified ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                      {user.isVerified ? t('admin.users.verified') : t('admin.users.unverified')}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(ICON_ACTION_BUTTON_BASE, 'text-amber-500 hover:bg-amber-500/15 hover:text-amber-600')}
                        title={t('admin.users.editUser')}
                        onClick={() => openEditDialog(user)}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only">{t('admin.users.editUser')}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(ICON_ACTION_BUTTON_BASE, 'text-destructive hover:bg-destructive/15 hover:text-destructive')}
                        disabled={deleteUserMutation.isPending || user.userId === currentUserId}
                        title={t('admin.users.deleteUser')}
                        onClick={() => setDeleteUserTarget(user)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">{t('admin.users.deleteUser')}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {t('admin.users.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <AdminTablePagination
          page={safeUsersPage}
          pageSize={TABLE_PAGE_SIZE}
          totalItems={filteredUsers.length}
          onPageChange={setPage}
        />
      </CardContent>

      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) closeEditDialog() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('admin.users.dialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.users.dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="admin-user-first-name">{t('auth.firstName')}</Label>
                <Input
                  id="admin-user-first-name"
                  value={form.firstName}
                  onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-user-last-name">{t('auth.lastName')}</Label>
                <Input
                  id="admin-user-last-name"
                  value={form.lastName}
                  onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-user-email">{t('auth.email')}</Label>
                <Input
                  id="admin-user-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-user-phone">{t('auth.phone')}</Label>
                <Input
                  id="admin-user-phone"
                  value={form.phoneNumber}
                  onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-user-nickname">{t('admin.users.nickname')}</Label>
                <Input
                  id="admin-user-nickname"
                  value={form.nickname}
                  onChange={(event) => setForm((prev) => ({ ...prev, nickname: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-user-city">{t('admin.users.city')}</Label>
                <Input
                  id="admin-user-city"
                  value={form.city}
                  onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="admin-user-nationality">{t('admin.users.nationality')}</Label>
                <Input
                  id="admin-user-nationality"
                  value={form.nationality}
                  onChange={(event) => setForm((prev) => ({ ...prev, nationality: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="admin-user-biography">{t('admin.users.biography')}</Label>
                <Textarea
                  id="admin-user-biography"
                  rows={3}
                  value={form.biography}
                  onChange={(event) => setForm((prev) => ({ ...prev, biography: event.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{t('admin.users.verifiedTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('admin.users.verifiedDescription')}</p>
              </div>
              <Switch
                checked={form.isVerified}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isVerified: checked }))}
              />
            </div>

            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('admin.users.addRole')}</Label>
                <div className="flex gap-2">
                  <Select value={addRoleId} onValueChange={setAddRoleId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('admin.users.addRolePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRolesToAdd.map((role) => (
                        <SelectItem key={role.roleId} value={role.roleId}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!editingUser || !addRoleId || addRoleMutation.isPending}
                    onClick={() => {
                      if (!editingUser || !addRoleId) {
                        return
                      }
                      addRoleMutation.mutate({ userId: editingUser.userId, roleId: addRoleId })
                    }}
                  >
                    {addRoleMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('admin.users.removeRole')}</Label>
                <div className="flex gap-2">
                  <Select value={removeRoleId} onValueChange={setRemoveRoleId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('admin.users.removeRolePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {assignedRoles.map((role) => (
                        <SelectItem key={role.roleId} value={role.roleId}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!editingUser || !removeRoleId || removeRoleMutation.isPending}
                    onClick={() => {
                      if (!editingUser || !removeRoleId) {
                        return
                      }
                      removeRoleMutation.mutate({ userId: editingUser.userId, roleId: removeRoleId })
                    }}
                  >
                    {removeRoleMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submitUserUpdate} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('task.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={Boolean(deleteUserTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteUserTarget(null)
          }
        }}
        title={t('admin.users.deleteConfirmTitle')}
        description={deleteUserTarget
          ? t('admin.users.deleteConfirmDescription', { target: deleteUserTarget.email })
          : t('admin.users.deleteConfirmDescriptionGeneric')}
        confirmText={t('common.delete')}
        confirmVariant="destructive"
        loading={deleteUserMutation.isPending}
        onConfirm={() => {
          if (!deleteUserTarget) {
            return
          }

          deleteUserMutation.mutate(deleteUserTarget.userId, {
            onSettled: () => {
              setDeleteUserTarget(null)
            },
          })
        }}
      />
    </Card>
  )
}

interface RolesAdminTabProps {
  roles: AdminRole[]
  permissions: AdminPermission[]
  onDataChanged: () => void
}

interface RoleFormState {
  name: string
  description: string
  active: boolean
}

const EMPTY_ROLE_FORM: RoleFormState = {
  name: '',
  description: '',
  active: true,
}

function RolesAdminTab({ roles, permissions, onDataChanged }: RolesAdminTabProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<AdminRole | null>(null)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleDialogMode, setRoleDialogMode] = useState<'create' | 'edit'>('create')
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null)
  const [roleForm, setRoleForm] = useState<RoleFormState>(EMPTY_ROLE_FORM)

  const [permissionDialogRoleId, setPermissionDialogRoleId] = useState<string | null>(null)
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false)
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([])

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return roles
    }

    return roles.filter((role) => {
      const rolePermissionNames = (role.permissions ?? []).map((permission) => permission.name).join(' ').toLowerCase()
      return (
        role.name.toLowerCase().includes(q)
        || (role.description ?? '').toLowerCase().includes(q)
        || rolePermissionNames.includes(q)
      )
    })
  }, [search, roles])

  const rolesTotalPages = Math.max(1, Math.ceil(filteredRoles.length / TABLE_PAGE_SIZE))
  const safeRolesPage = Math.min(page, rolesTotalPages)
  const paginatedRoles = useMemo(() => {
    const start = (safeRolesPage - 1) * TABLE_PAGE_SIZE
    return filteredRoles.slice(start, start + TABLE_PAGE_SIZE)
  }, [filteredRoles, safeRolesPage])

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    if (page !== safeRolesPage) {
      setPage(safeRolesPage)
    }
  }, [page, safeRolesPage])

  const createRoleMutation = useMutation({
    mutationFn: (payload: CreateRolePayload) => adminRoleApi.create(payload),
    onSuccess: () => {
      toast.success(t('admin.roles.createSuccess'))
      onDataChanged()
      closeRoleDialog()
    },
    onError: (error: Error) => {
      toast.error(t('admin.roles.createFailed'), { description: error.message })
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ roleId, payload }: { roleId: string; payload: UpdateRolePayload }) => adminRoleApi.update(roleId, payload),
    onSuccess: () => {
      toast.success(t('admin.roles.updateSuccess'))
      onDataChanged()
      closeRoleDialog()
    },
    onError: (error: Error) => {
      toast.error(t('admin.roles.updateFailed'), { description: error.message })
    },
  })

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => adminRoleApi.remove(roleId),
    onSuccess: () => {
      toast.success(t('admin.roles.deleteSuccess'))
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error(t('admin.roles.deleteFailed'), { description: error.message })
    },
  })

  const toggleRoleActiveMutation = useMutation({
    mutationFn: ({ roleId, active }: { roleId: string; active: boolean }) =>
      adminRoleApi.update(roleId, { active }),
    onSuccess: () => {
      toast.success(t('admin.roles.statusUpdated'))
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error(t('admin.roles.statusUpdateFailed'), { description: error.message })
    },
  })

  const addPermissionsMutation = useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) => adminRoleApi.update(roleId, { permissionIds }),
    onSuccess: () => {
      toast.success(t('admin.roles.addPermissionsSuccess'))
      setSelectedPermissionIds([])
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error(t('admin.roles.addPermissionsFailed'), { description: error.message })
    },
  })

  const removePermissionMutation = useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      adminRoleApi.deletePermissions(roleId, { permissionIds: [permissionId] }),
    onSuccess: () => {
      toast.success(t('admin.roles.removePermissionSuccess'))
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error(t('admin.roles.removePermissionFailed'), { description: error.message })
    },
  })

  const openCreateDialog = () => {
    setRoleDialogMode('create')
    setEditingRole(null)
    setRoleForm(EMPTY_ROLE_FORM)
    setRoleDialogOpen(true)
  }

  const openEditDialog = (role: AdminRole) => {
    setRoleDialogMode('edit')
    setEditingRole(role)
    setRoleForm({
      name: role.name,
      description: role.description ?? '',
      active: Boolean(role.active),
    })
    setRoleDialogOpen(true)
  }

  const closeRoleDialog = () => {
    if (createRoleMutation.isPending || updateRoleMutation.isPending) {
      return
    }

    setRoleDialogOpen(false)
    setEditingRole(null)
    setRoleForm(EMPTY_ROLE_FORM)
  }

  const submitRole = () => {
    const normalizedName = roleForm.name.trim().toUpperCase()
    const description = roleForm.description.trim()

    if (!normalizedName) {
      toast.error(t('admin.roles.nameRequired'))
      return
    }

    if (roleDialogMode === 'create') {
      createRoleMutation.mutate({
        name: normalizedName,
        description: description || undefined,
        active: roleForm.active,
      })
      return
    }

    if (!editingRole) {
      return
    }

    const payload: UpdateRolePayload = {}

    if (normalizedName !== editingRole.name) {
      payload.name = normalizedName
    }

    if (description !== (editingRole.description ?? '')) {
      payload.description = description || undefined
    }

    if (roleForm.active !== Boolean(editingRole.active)) {
      payload.active = roleForm.active
    }

    if (Object.keys(payload).length === 0) {
      toast.info(t('admin.noChanges'))
      return
    }

    updateRoleMutation.mutate({
      roleId: editingRole.roleId,
      payload,
    })
  }

  const activeRoleForPermissions = useMemo(
    () => roles.find((role) => role.roleId === permissionDialogRoleId) ?? null,
    [permissionDialogRoleId, roles],
  )

  const addablePermissions = useMemo(() => {
    if (!activeRoleForPermissions) {
      return []
    }

    const existingIds = new Set((activeRoleForPermissions.permissions ?? []).map((permission) => permission.permissionId))
    return permissions.filter((permission) => !existingIds.has(permission.permissionId))
  }, [activeRoleForPermissions, permissions])

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{t('admin.roles.title')}</CardTitle>
            <CardDescription>
              {t('admin.roles.description')}
            </CardDescription>
          </div>
          <div className="flex w-full max-w-md gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('admin.roles.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="size-4" />
              {t('admin.roles.newRole')}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="w-full overflow-x-auto rounded-md border">
          <Table className="table-fixed min-w-232">
            <colgroup>
              <col className="w-42" />
              <col />
              <col className="w-46" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="px-1 text-center">{t('admin.roles.tableRole')}</TableHead>
                <TableHead>{t('admin.roles.tableDescription')}</TableHead>
                <TableHead className="px-1 text-center">{t('admin.roles.tableActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRoles.map((role) => (
                <TableRow key={role.roleId}>
                  <TableCell className="px-1 py-2 text-center align-middle">
                    <div className="flex items-center justify-center">
                      <RoleBadge roleName={role.name} />
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm leading-relaxed text-muted-foreground align-top">
                    {role.description || t('admin.roles.noDescription')}
                  </TableCell>
                  <TableCell className="px-1 py-2 text-center align-top">
                    <div className="inline-flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          ICON_ACTION_BUTTON_BASE,
                          role.active
                            ? 'text-emerald-600 hover:bg-emerald-500/15 hover:text-emerald-700'
                            : 'text-slate-500 hover:bg-slate-500/15 hover:text-slate-700',
                        )}
                        disabled={toggleRoleActiveMutation.isPending}
                        title={role.active ? t('admin.roles.deactivate') : t('admin.roles.activate')}
                        onClick={() => {
                          toggleRoleActiveMutation.mutate({
                            roleId: role.roleId,
                            active: !Boolean(role.active),
                          })
                        }}
                      >
                        <Power className="size-4" />
                        <span className="sr-only">{role.active ? t('admin.roles.deactivate') : t('admin.roles.activate')}</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(ICON_ACTION_BUTTON_BASE, 'text-amber-500 hover:bg-amber-500/15 hover:text-amber-600')}
                        title={t('admin.roles.editRole')}
                        onClick={() => openEditDialog(role)}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only">{t('admin.roles.editRole')}</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(ICON_ACTION_BUTTON_BASE, 'text-sky-600 hover:bg-sky-500/15 hover:text-sky-700')}
                        title={t('admin.roles.managePermissions')}
                        onClick={() => {
                          setPermissionDialogRoleId(role.roleId)
                          setSelectedPermissionIds([])
                          setPermissionDialogOpen(true)
                        }}
                      >
                        <ShieldCheck className="size-4" />
                        <span className="sr-only">{t('admin.roles.managePermissions')}</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(ICON_ACTION_BUTTON_BASE, 'text-destructive hover:bg-destructive/15 hover:text-destructive')}
                        disabled={deleteRoleMutation.isPending}
                        title={t('admin.roles.deleteRole')}
                        onClick={() => setDeleteRoleTarget(role)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">{t('admin.roles.deleteRole')}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRoles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    {t('admin.roles.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <AdminTablePagination
          page={safeRolesPage}
          pageSize={TABLE_PAGE_SIZE}
          totalItems={filteredRoles.length}
          onPageChange={setPage}
        />
      </CardContent>

      <Dialog open={roleDialogOpen} onOpenChange={(open) => { if (!open) closeRoleDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{roleDialogMode === 'create' ? t('admin.roles.createTitle') : t('admin.roles.editTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.roles.dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin-role-name">{t('admin.roles.nameLabel')}</Label>
              <Input
                id="admin-role-name"
                value={roleForm.name}
                onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t('admin.roles.namePlaceholder')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-role-description">{t('admin.roles.tableDescription')}</Label>
              <Textarea
                id="admin-role-description"
                rows={3}
                value={roleForm.description}
                onChange={(event) => setRoleForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{t('admin.roles.activeTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('admin.roles.activeDescription')}</p>
              </div>
              <Switch
                checked={roleForm.active}
                onCheckedChange={(checked) => setRoleForm((prev) => ({ ...prev, active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeRoleDialog}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submitRole} disabled={createRoleMutation.isPending || updateRoleMutation.isPending}>
              {(createRoleMutation.isPending || updateRoleMutation.isPending) && <Loader2 className="size-4 animate-spin" />}
              {roleDialogMode === 'create' ? t('admin.roles.createAction') : t('task.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('admin.roles.permissionsDialogTitle', { role: activeRoleForPermissions?.name ?? '' })}</DialogTitle>
            <DialogDescription>
              {t('admin.roles.permissionsDialogDescription')}
            </DialogDescription>
          </DialogHeader>

          {activeRoleForPermissions ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('admin.roles.currentPermissions')}</p>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('admin.roles.permissionTableName')}</TableHead>
                        <TableHead>{t('admin.roles.permissionTableApi')}</TableHead>
                        <TableHead>{t('admin.roles.permissionTableMethod')}</TableHead>
                        <TableHead className="text-right">{t('admin.roles.permissionTableAction')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(activeRoleForPermissions.permissions ?? []).map((permission) => (
                        <TableRow key={permission.permissionId}>
                          <TableCell>{permission.name}</TableCell>
                          <TableCell className="font-mono text-xs">{permission.apiPath}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{permission.httpMethod}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={removePermissionMutation.isPending}
                              onClick={() => {
                                removePermissionMutation.mutate({
                                  roleId: activeRoleForPermissions.roleId,
                                  permissionId: permission.permissionId,
                                })
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(activeRoleForPermissions.permissions ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                            {t('admin.roles.noPermissions')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">{t('admin.roles.addPermissions')}</p>
                <div className="rounded-md border p-3">
                  {addablePermissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('admin.roles.noAddablePermissions')}</p>
                  ) : (
                    <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {addablePermissions.map((permission) => {
                        const checked = selectedPermissionIds.includes(permission.permissionId)
                        return (
                          <label key={permission.permissionId} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                const nextChecked = event.target.checked
                                setSelectedPermissionIds((prev) => {
                                  if (nextChecked) {
                                    return [...prev, permission.permissionId]
                                  }
                                  return prev.filter((id) => id !== permission.permissionId)
                                })
                              }}
                              className="mt-0.5"
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{permission.name}</span>
                              <span className="block truncate font-mono text-xs text-muted-foreground">{permission.apiPath} [{permission.httpMethod}]</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <Button
                      disabled={!activeRoleForPermissions || selectedPermissionIds.length === 0 || addPermissionsMutation.isPending}
                      onClick={() => {
                        if (!activeRoleForPermissions || selectedPermissionIds.length === 0) {
                          return
                        }
                        addPermissionsMutation.mutate({
                          roleId: activeRoleForPermissions.roleId,
                          permissionIds: selectedPermissionIds,
                        })
                      }}
                    >
                      {addPermissionsMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                      {t('admin.roles.addSelectedPermissions')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('admin.roles.roleNotFound')}</p>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={Boolean(deleteRoleTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteRoleTarget(null)
          }
        }}
        title={t('admin.roles.deleteConfirmTitle')}
        description={deleteRoleTarget
          ? t('admin.roles.deleteConfirmDescription', { target: deleteRoleTarget.name })
          : t('admin.roles.deleteConfirmDescriptionGeneric')}
        confirmText={t('common.delete')}
        confirmVariant="destructive"
        loading={deleteRoleMutation.isPending}
        onConfirm={() => {
          if (!deleteRoleTarget) {
            return
          }

          deleteRoleMutation.mutate(deleteRoleTarget.roleId, {
            onSettled: () => {
              setDeleteRoleTarget(null)
            },
          })
        }}
      />
    </Card>
  )
}

interface PermissionsAdminTabProps {
  permissions: AdminPermission[]
  modules: string[]
  onDataChanged: () => void
}

interface PermissionFormState {
  name: string
  apiPath: string
  httpMethod: HttpMethodName
  module: string
}

const EMPTY_PERMISSION_FORM: PermissionFormState = {
  name: '',
  apiPath: '',
  httpMethod: 'GET',
  module: NO_MODULE,
}

function PermissionsAdminTab({ permissions, modules, onDataChanged }: PermissionsAdminTabProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [deletePermissionTarget, setDeletePermissionTarget] = useState<AdminPermission | null>(null)
  const [deleteModuleTarget, setDeleteModuleTarget] = useState<string | null>(null)
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false)
  const [permissionDialogMode, setPermissionDialogMode] = useState<'create' | 'edit'>('create')
  const [editingPermission, setEditingPermission] = useState<AdminPermission | null>(null)
  const [permissionForm, setPermissionForm] = useState<PermissionFormState>(EMPTY_PERMISSION_FORM)

  const [moduleDialogOpen, setModuleDialogOpen] = useState(false)
  const [moduleName, setModuleName] = useState('')
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([])

  const filteredPermissions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return permissions
    }

    return permissions.filter((permission) => (
      permission.name.toLowerCase().includes(q)
      || permission.apiPath.toLowerCase().includes(q)
      || permission.httpMethod.toLowerCase().includes(q)
      || (permission.module ?? '').toLowerCase().includes(q)
    ))
  }, [permissions, search])

  const permissionsTotalPages = Math.max(1, Math.ceil(filteredPermissions.length / TABLE_PAGE_SIZE))
  const safePermissionsPage = Math.min(page, permissionsTotalPages)
  const paginatedPermissions = useMemo(() => {
    const start = (safePermissionsPage - 1) * TABLE_PAGE_SIZE
    return filteredPermissions.slice(start, start + TABLE_PAGE_SIZE)
  }, [filteredPermissions, safePermissionsPage])

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    if (page !== safePermissionsPage) {
      setPage(safePermissionsPage)
    }
  }, [page, safePermissionsPage])

  const createPermissionMutation = useMutation({
    mutationFn: (payload: CreatePermissionPayload) => adminPermissionApi.create(payload),
    onSuccess: () => {
      toast.success(t('admin.permissions.createSuccess'))
      onDataChanged()
      closePermissionDialog()
    },
    onError: (error: Error) => {
      toast.error(t('admin.permissions.createFailed'), { description: error.message })
    },
  })

  const updatePermissionMutation = useMutation({
    mutationFn: ({ permissionId, payload }: { permissionId: string; payload: UpdatePermissionPayload }) =>
      adminPermissionApi.update(permissionId, payload),
    onSuccess: () => {
      toast.success(t('admin.permissions.updateSuccess'))
      onDataChanged()
      closePermissionDialog()
    },
    onError: (error: Error) => {
      toast.error(t('admin.permissions.updateFailed'), { description: error.message })
    },
  })

  const deletePermissionMutation = useMutation({
    mutationFn: (permissionId: string) => adminPermissionApi.remove(permissionId),
    onSuccess: () => {
      toast.success(t('admin.permissions.deleteSuccess'))
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error(t('admin.permissions.deleteFailed'), { description: error.message })
    },
  })

  const createModuleMutation = useMutation({
    mutationFn: ({ newModuleName, permissionIds }: { newModuleName: string; permissionIds: string[] }) =>
      adminPermissionApi.createModule({ moduleName: newModuleName, permissionIds }),
    onSuccess: () => {
      toast.success(t('admin.permissions.createModuleSuccess'))
      onDataChanged()
      closeModuleDialog()
    },
    onError: (error: Error) => {
      toast.error(t('admin.permissions.createModuleFailed'), { description: error.message })
    },
  })

  const deleteModuleMutation = useMutation({
    mutationFn: (targetModule: string) => adminPermissionApi.deleteModule(targetModule),
    onSuccess: () => {
      toast.success(t('admin.permissions.deleteModuleSuccess'))
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error(t('admin.permissions.deleteModuleFailed'), { description: error.message })
    },
  })

  const openCreatePermissionDialog = () => {
    setPermissionDialogMode('create')
    setEditingPermission(null)
    setPermissionForm(EMPTY_PERMISSION_FORM)
    setPermissionDialogOpen(true)
  }

  const openEditPermissionDialog = (permission: AdminPermission) => {
    setPermissionDialogMode('edit')
    setEditingPermission(permission)
    setPermissionForm({
      name: permission.name,
      apiPath: permission.apiPath,
      httpMethod: normalizeHttpMethod(permission.httpMethod),
      module: permission.module ?? NO_MODULE,
    })
    setPermissionDialogOpen(true)
  }

  const closePermissionDialog = () => {
    if (createPermissionMutation.isPending || updatePermissionMutation.isPending) {
      return
    }

    setPermissionDialogOpen(false)
    setPermissionForm(EMPTY_PERMISSION_FORM)
    setEditingPermission(null)
  }

  const closeModuleDialog = () => {
    if (createModuleMutation.isPending) {
      return
    }

    setModuleDialogOpen(false)
    setModuleName('')
    setSelectedPermissionIds([])
  }

  const submitPermission = () => {
    const name = permissionForm.name.trim()
    const apiPath = permissionForm.apiPath.trim()

    if (!name || !apiPath) {
      toast.error(t('admin.permissions.validationRequired'))
      return
    }

    const moduleValue = permissionForm.module === NO_MODULE ? undefined : permissionForm.module.trim().toUpperCase()

    if (permissionDialogMode === 'create') {
      createPermissionMutation.mutate({
        name,
        apiPath,
        httpMethod: permissionForm.httpMethod,
        module: moduleValue,
      })
      return
    }

    if (!editingPermission) {
      return
    }

    const payload: UpdatePermissionPayload = {}

    if (name !== editingPermission.name) {
      payload.name = name
    }

    if (apiPath !== editingPermission.apiPath) {
      payload.apiPath = apiPath
    }

    if (permissionForm.httpMethod !== normalizeHttpMethod(editingPermission.httpMethod)) {
      payload.httpMethod = permissionForm.httpMethod
    }

    const originalModule = editingPermission.module ?? NO_MODULE
    if (permissionForm.module !== originalModule) {
      payload.module = permissionForm.module === NO_MODULE ? null : permissionForm.module.toUpperCase()
    }

    if (Object.keys(payload).length === 0) {
      toast.info(t('admin.noChanges'))
      return
    }

    updatePermissionMutation.mutate({
      permissionId: editingPermission.permissionId,
      payload,
    })
  }

  const unassignedPermissions = useMemo(
    () => permissions.filter((permission) => !permission.module),
    [permissions],
  )

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{t('admin.permissions.title')}</CardTitle>
            <CardDescription>
              {t('admin.permissions.description')}
            </CardDescription>
          </div>
          <div className="flex w-full max-w-3xl flex-wrap gap-2">
            <div className="relative min-w-64 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('admin.permissions.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={() => setModuleDialogOpen(true)}>
              <Settings className="size-4" />
              {t('admin.permissions.createModule')}
            </Button>
            <Button onClick={openCreatePermissionDialog}>
              <Plus className="size-4" />
              {t('admin.permissions.newPermission')}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {modules.length === 0 ? (
            <Badge variant="outline">{t('admin.permissions.emptyModules')}</Badge>
          ) : (
            modules.map((moduleName) => (
              <div key={moduleName} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                <span className="font-medium">{moduleName}</span>
                <button
                  type="button"
                  className="text-destructive"
                  disabled={deleteModuleMutation.isPending}
                  aria-label={t('admin.permissions.removeModuleButtonAria', { module: moduleName })}
                  onClick={() => setDeleteModuleTarget(moduleName)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="w-full overflow-x-auto rounded-md border">
          <Table className="min-w-225">
            <TableHeader>
              <TableRow>
                <TableHead className="w-60">{t('admin.permissions.tableName')}</TableHead>
                <TableHead className="w-90">{t('admin.permissions.tableApiPath')}</TableHead>
                <TableHead className="w-30">{t('admin.permissions.tableMethod')}</TableHead>
                <TableHead className="w-35">{t('admin.permissions.tableModule')}</TableHead>
                <TableHead className="w-40 text-right">{t('admin.permissions.tableActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPermissions.map((permission) => (
                <TableRow key={permission.permissionId}>
                  <TableCell>
                    <p className="font-medium">{permission.name}</p>
                    <p className="text-xs text-muted-foreground">ID: {permission.permissionId}</p>
                  </TableCell>
                  <TableCell className="max-w-88 truncate font-mono text-xs" title={permission.apiPath}>
                    {permission.apiPath}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={resolveMethodBadgeClass(permission.httpMethod)}>{permission.httpMethod}</Badge>
                  </TableCell>
                  <TableCell>
                    {permission.module ? (
                      <Badge variant="outline" className={resolveModuleBadgeClass(permission.module)}>{permission.module}</Badge>
                    ) : (
                      <Badge variant="secondary">{t('admin.permissions.noModule')}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(ICON_ACTION_BUTTON_BASE, 'text-amber-500 hover:bg-amber-500/15 hover:text-amber-600')}
                        title={t('admin.permissions.editPermission')}
                        onClick={() => openEditPermissionDialog(permission)}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only">{t('admin.permissions.editPermission')}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(ICON_ACTION_BUTTON_BASE, 'text-destructive hover:bg-destructive/15 hover:text-destructive')}
                        disabled={deletePermissionMutation.isPending}
                        title={t('admin.permissions.deletePermission')}
                        onClick={() => setDeletePermissionTarget(permission)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">{t('admin.permissions.deletePermission')}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredPermissions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {t('admin.permissions.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <AdminTablePagination
          page={safePermissionsPage}
          pageSize={TABLE_PAGE_SIZE}
          totalItems={filteredPermissions.length}
          onPageChange={setPage}
        />
      </CardContent>

      <Dialog open={permissionDialogOpen} onOpenChange={(open) => { if (!open) closePermissionDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{permissionDialogMode === 'create' ? t('admin.permissions.createTitle') : t('admin.permissions.editTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.permissions.dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin-permission-name">{t('admin.permissions.nameLabel')}</Label>
              <Input
                id="admin-permission-name"
                value={permissionForm.name}
                onChange={(event) => setPermissionForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-permission-api-path">{t('admin.permissions.apiPathLabel')}</Label>
              <Input
                id="admin-permission-api-path"
                value={permissionForm.apiPath}
                onChange={(event) => setPermissionForm((prev) => ({ ...prev, apiPath: event.target.value }))}
                placeholder={t('admin.permissions.apiPathPlaceholder')}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('admin.permissions.methodLabel')}</Label>
                <Select
                  value={permissionForm.httpMethod}
                  onValueChange={(value) => setPermissionForm((prev) => ({ ...prev, httpMethod: normalizeHttpMethod(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HTTP_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t('admin.permissions.moduleLabel')}</Label>
                <Select value={permissionForm.module} onValueChange={(value) => setPermissionForm((prev) => ({ ...prev, module: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_MODULE}>{t('admin.permissions.noModule')}</SelectItem>
                    {modules.map((moduleName) => (
                      <SelectItem key={moduleName} value={moduleName}>{moduleName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePermissionDialog}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submitPermission} disabled={createPermissionMutation.isPending || updatePermissionMutation.isPending}>
              {(createPermissionMutation.isPending || updatePermissionMutation.isPending) && <Loader2 className="size-4 animate-spin" />}
              {permissionDialogMode === 'create' ? t('admin.permissions.createAction') : t('task.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moduleDialogOpen} onOpenChange={(open) => { if (!open) closeModuleDialog() }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('admin.permissions.moduleDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.permissions.moduleDialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin-module-name">{t('admin.permissions.moduleNameLabel')}</Label>
              <Input
                id="admin-module-name"
                value={moduleName}
                onChange={(event) => setModuleName(event.target.value)}
                placeholder={t('admin.permissions.moduleNamePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('admin.permissions.unassignedPermissions')}</Label>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
                {unassignedPermissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('admin.permissions.allAssigned')}</p>
                ) : (
                  unassignedPermissions.map((permission) => {
                    const checked = selectedPermissionIds.includes(permission.permissionId)
                    return (
                      <label key={permission.permissionId} className="flex items-start gap-2 rounded border px-2 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const nextChecked = event.target.checked
                            setSelectedPermissionIds((prev) => {
                              if (nextChecked) {
                                return [...prev, permission.permissionId]
                              }
                              return prev.filter((id) => id !== permission.permissionId)
                            })
                          }}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{permission.name}</span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">{permission.apiPath} [{permission.httpMethod}]</span>
                        </span>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModuleDialog}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={createModuleMutation.isPending || moduleName.trim().length === 0 || selectedPermissionIds.length === 0}
              onClick={() => {
                createModuleMutation.mutate({
                  newModuleName: moduleName.trim().toUpperCase(),
                  permissionIds: selectedPermissionIds,
                })
              }}
            >
              {createModuleMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('admin.permissions.createModuleAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={Boolean(deletePermissionTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletePermissionTarget(null)
          }
        }}
        title={t('admin.permissions.deleteConfirmTitle')}
        description={deletePermissionTarget
          ? t('admin.permissions.deleteConfirmDescription', { target: deletePermissionTarget.name })
          : t('admin.permissions.deleteConfirmDescriptionGeneric')}
        confirmText={t('common.delete')}
        confirmVariant="destructive"
        loading={deletePermissionMutation.isPending}
        onConfirm={() => {
          if (!deletePermissionTarget) {
            return
          }

          deletePermissionMutation.mutate(deletePermissionTarget.permissionId, {
            onSettled: () => {
              setDeletePermissionTarget(null)
            },
          })
        }}
      />

      <ConfirmModal
        open={Boolean(deleteModuleTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteModuleTarget(null)
          }
        }}
        title={t('admin.permissions.removeModuleTitle')}
        description={deleteModuleTarget
          ? t('admin.permissions.removeModuleDescription', { module: deleteModuleTarget })
          : t('admin.permissions.removeModuleDescriptionGeneric')}
        confirmText={t('admin.permissions.removeModuleConfirm')}
        confirmVariant="destructive"
        loading={deleteModuleMutation.isPending}
        onConfirm={() => {
          if (!deleteModuleTarget) {
            return
          }

          deleteModuleMutation.mutate(deleteModuleTarget, {
            onSettled: () => {
              setDeleteModuleTarget(null)
            },
          })
        }}
      />
    </Card>
  )
}

function normalizeHttpMethod(method: string): HttpMethodName {
  const upper = method.toUpperCase()
  if (HTTP_METHODS.includes(upper as HttpMethodName)) {
    return upper as HttpMethodName
  }
  return 'GET'
}
