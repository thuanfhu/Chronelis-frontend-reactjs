import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserCog,
  KeyRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/app/store/auth-store'
import { PageHeader } from '@/components/shared/page-header'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { queryKeys } from '@/lib/api/query-keys'
import { adminPermissionApi, type CreatePermissionPayload, type UpdatePermissionPayload } from '@/lib/api/modules/admin-permission-api'
import { adminRoleApi, type CreateRolePayload, type UpdateRolePayload } from '@/lib/api/modules/admin-role-api'
import { adminUserApi, type UpdateUserForAdminPayload } from '@/lib/api/modules/admin-user-api'
import type { AdminPermission, AdminRole, AdminUser, HttpMethodName } from '@/lib/api/modules/admin-types'
import { isAdminUser } from '@/lib/auth/role-utils'

const PAGE_SIZE = 200
const NO_MODULE = '__NO_MODULE__'
const HTTP_METHODS: HttpMethodName[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export function AdminDashboardPage() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.currentUser)

  const rolesQuery = useQuery({
    queryKey: queryKeys.admin.roles(0, PAGE_SIZE),
    queryFn: () => adminRoleApi.list({ page: 0, size: PAGE_SIZE }),
  })

  const permissionsQuery = useQuery({
    queryKey: queryKeys.admin.permissions(0, PAGE_SIZE),
    queryFn: () => adminPermissionApi.list({ page: 0, size: PAGE_SIZE }),
  })

  const usersQuery = useQuery({
    queryKey: queryKeys.admin.users(0, PAGE_SIZE),
    queryFn: () => adminUserApi.list({ page: 0, size: PAGE_SIZE }),
  })

  const modulesQuery = useQuery({
    queryKey: queryKeys.admin.modules,
    queryFn: adminPermissionApi.listModules,
  })

  const isLoading = rolesQuery.isLoading || permissionsQuery.isLoading || usersQuery.isLoading || modulesQuery.isLoading

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
          Bạn không có quyền quản trị hệ thống.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Quản trị người dùng, vai trò và quyền hệ thống Chronelis"
        actions={(
          <Button variant="outline" onClick={() => void refreshAll()}>
            <RefreshCcw className="size-4" />
            Làm mới
          </Button>
        )}
      />

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5">
            <UserCog className="size-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <ShieldCheck className="size-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-1.5">
            <KeyRound className="size-4" />
            Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersAdminTab
            users={users}
            roles={roles}
            currentUserId={currentUser?.userId}
            onDataChanged={() => void refreshAll()}
          />
        </TabsContent>

        <TabsContent value="roles">
          <RolesAdminTab
            roles={roles}
            permissions={permissions}
            onDataChanged={() => void refreshAll()}
          />
        </TabsContent>

        <TabsContent value="permissions">
          <PermissionsAdminTab
            permissions={permissions}
            modules={modules}
            onDataChanged={() => void refreshAll()}
          />
        </TabsContent>
      </Tabs>
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
  const [search, setSearch] = useState('')
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

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateUserForAdminPayload }) => adminUserApi.update(userId, payload),
    onSuccess: () => {
      toast.success('Cập nhật người dùng thành công')
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error('Cập nhật người dùng thất bại', { description: error.message })
    },
  })

  const addRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => adminUserApi.update(userId, { roleIds: [roleId] }),
    onSuccess: () => {
      toast.success('Đã thêm role cho người dùng')
      setAddRoleId('')
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error('Thêm role thất bại', { description: error.message })
    },
  })

  const removeRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => adminUserApi.deleteRoles(userId, { roleIds: [roleId] }),
    onSuccess: () => {
      toast.success('Đã gỡ role khỏi người dùng')
      setRemoveRoleId('')
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error('Gỡ role thất bại', { description: error.message })
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => adminUserApi.remove(userId),
    onSuccess: () => {
      toast.success('Đã xóa người dùng')
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error('Xóa người dùng thất bại', { description: error.message })
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
      toast.info('Không có thay đổi để cập nhật')
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
            <CardTitle>Quản lý Users</CardTitle>
            <CardDescription>
              Cập nhật thông tin user và quản lý role cấp hệ thống.
            </CardDescription>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên, email, role..."
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Người dùng</TableHead>
              <TableHead>Email / SĐT</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.userId}>
                <TableCell>
                  <p className="font-medium">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-muted-foreground">ID: {user.userId}</p>
                </TableCell>
                <TableCell>
                  <p>{user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.phoneNumber || 'Chưa cập nhật'}</p>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(user.roles ?? []).length === 0 ? (
                      <Badge variant="outline">No role</Badge>
                    ) : (
                      (user.roles ?? []).map((role) => (
                        <Badge key={role.roleId} variant="secondary">{role.name}</Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isVerified ? 'default' : 'outline'}>
                    {user.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                      Sửa
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deleteUserMutation.isPending || user.userId === currentUserId}
                      onClick={() => {
                        if (!window.confirm(`Xóa người dùng ${user.email}?`)) {
                          return
                        }
                        deleteUserMutation.mutate(user.userId)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Không có người dùng phù hợp.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) closeEditDialog() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cập nhật người dùng</DialogTitle>
            <DialogDescription>
              Chỉ các trường thay đổi mới được gửi lên backend để tránh xung đột dữ liệu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="admin-user-first-name">Tên</Label>
                <Input
                  id="admin-user-first-name"
                  value={form.firstName}
                  onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-user-last-name">Họ</Label>
                <Input
                  id="admin-user-last-name"
                  value={form.lastName}
                  onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-user-email">Email</Label>
                <Input
                  id="admin-user-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-user-phone">Số điện thoại</Label>
                <Input
                  id="admin-user-phone"
                  value={form.phoneNumber}
                  onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-user-nickname">Nickname</Label>
                <Input
                  id="admin-user-nickname"
                  value={form.nickname}
                  onChange={(event) => setForm((prev) => ({ ...prev, nickname: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-user-city">Thành phố</Label>
                <Input
                  id="admin-user-city"
                  value={form.city}
                  onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="admin-user-nationality">Quốc tịch</Label>
                <Input
                  id="admin-user-nationality"
                  value={form.nationality}
                  onChange={(event) => setForm((prev) => ({ ...prev, nationality: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="admin-user-biography">Giới thiệu</Label>
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
                <p className="text-sm font-medium">Tài khoản đã xác thực</p>
                <p className="text-xs text-muted-foreground">Bật hoặc tắt trạng thái xác thực tài khoản</p>
              </div>
              <Switch
                checked={form.isVerified}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isVerified: checked }))}
              />
            </div>

            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Thêm role</Label>
                <div className="flex gap-2">
                  <Select value={addRoleId} onValueChange={setAddRoleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn role để thêm" />
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
                <Label>Gỡ role</Label>
                <div className="flex gap-2">
                  <Select value={removeRoleId} onValueChange={setRemoveRoleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn role để gỡ" />
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
              Hủy
            </Button>
            <Button onClick={submitUserUpdate} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const [search, setSearch] = useState('')
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

  const createRoleMutation = useMutation({
    mutationFn: (payload: CreateRolePayload) => adminRoleApi.create(payload),
    onSuccess: () => {
      toast.success('Tạo role thành công')
      onDataChanged()
      closeRoleDialog()
    },
    onError: (error: Error) => {
      toast.error('Tạo role thất bại', { description: error.message })
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ roleId, payload }: { roleId: string; payload: UpdateRolePayload }) => adminRoleApi.update(roleId, payload),
    onSuccess: () => {
      toast.success('Cập nhật role thành công')
      onDataChanged()
      closeRoleDialog()
    },
    onError: (error: Error) => {
      toast.error('Cập nhật role thất bại', { description: error.message })
    },
  })

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => adminRoleApi.remove(roleId),
    onSuccess: () => {
      toast.success('Đã xóa role')
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error('Xóa role thất bại', { description: error.message })
    },
  })

  const addPermissionsMutation = useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) => adminRoleApi.update(roleId, { permissionIds }),
    onSuccess: () => {
      toast.success('Đã thêm permissions vào role')
      setSelectedPermissionIds([])
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error('Thêm permissions thất bại', { description: error.message })
    },
  })

  const removePermissionMutation = useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      adminRoleApi.deletePermissions(roleId, { permissionIds: [permissionId] }),
    onSuccess: () => {
      toast.success('Đã gỡ permission khỏi role')
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error('Gỡ permission thất bại', { description: error.message })
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
      toast.error('Tên role không được để trống')
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
      toast.info('Không có thay đổi để cập nhật')
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
            <CardTitle>Quản lý Roles</CardTitle>
            <CardDescription>
              Tạo role, chỉnh sửa thông tin và quản lý permissions cho từng role.
            </CardDescription>
          </div>
          <div className="flex w-full max-w-md gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo role hoặc permission..."
                className="pl-9"
              />
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="size-4" />
              Role mới
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Mô tả</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRoles.map((role) => (
              <TableRow key={role.roleId}>
                <TableCell>
                  <p className="font-medium">{role.name}</p>
                  <p className="text-xs text-muted-foreground">ID: {role.roleId}</p>
                </TableCell>
                <TableCell className="max-w-72 whitespace-normal text-sm text-muted-foreground">
                  {role.description || 'Không có mô tả'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(role.permissions ?? []).slice(0, 4).map((permission) => (
                      <Badge key={permission.permissionId} variant="secondary">{permission.name}</Badge>
                    ))}
                    {(role.permissions ?? []).length > 4 && (
                      <Badge variant="outline">+{(role.permissions ?? []).length - 4}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={role.active ? 'default' : 'outline'}>
                    {role.active ? 'Bật' : 'Tắt'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(role)}>
                      Sửa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPermissionDialogRoleId(role.roleId)
                        setSelectedPermissionIds([])
                        setPermissionDialogOpen(true)
                      }}
                    >
                      Permissions
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deleteRoleMutation.isPending}
                      onClick={() => {
                        if (!window.confirm(`Xóa role ${role.name}?`)) {
                          return
                        }
                        deleteRoleMutation.mutate(role.roleId)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredRoles.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Không có role phù hợp.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={roleDialogOpen} onOpenChange={(open) => { if (!open) closeRoleDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{roleDialogMode === 'create' ? 'Tạo role mới' : 'Cập nhật role'}</DialogTitle>
            <DialogDescription>
              Role name sẽ được lưu ở định dạng uppercase để đồng bộ backend.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin-role-name">Role name</Label>
              <Input
                id="admin-role-name"
                value={roleForm.name}
                onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ví dụ: ADMIN_SUPPORT"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-role-description">Mô tả</Label>
              <Textarea
                id="admin-role-description"
                rows={3}
                value={roleForm.description}
                onChange={(event) => setRoleForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Role active</p>
                <p className="text-xs text-muted-foreground">Bật/tắt role trong hệ thống</p>
              </div>
              <Switch
                checked={roleForm.active}
                onCheckedChange={(checked) => setRoleForm((prev) => ({ ...prev, active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeRoleDialog}>
              Hủy
            </Button>
            <Button onClick={submitRole} disabled={createRoleMutation.isPending || updateRoleMutation.isPending}>
              {(createRoleMutation.isPending || updateRoleMutation.isPending) && <Loader2 className="size-4 animate-spin" />}
              {roleDialogMode === 'create' ? 'Tạo role' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Quản lý permissions cho role {activeRoleForPermissions?.name}</DialogTitle>
            <DialogDescription>
              Backend xử lý add/remove permissions theo từng thao tác riêng, không replace toàn bộ.
            </DialogDescription>
          </DialogHeader>

          {activeRoleForPermissions ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">Permissions hiện tại</p>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tên</TableHead>
                        <TableHead>API</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Action</TableHead>
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
                            Role chưa có permission.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Thêm permissions</p>
                <div className="rounded-md border p-3">
                  {addablePermissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Không còn permission để thêm.</p>
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
                      Thêm permissions đã chọn
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Không tìm thấy role để quản lý permissions.</p>
          )}
        </DialogContent>
      </Dialog>
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
  const [search, setSearch] = useState('')
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

  const createPermissionMutation = useMutation({
    mutationFn: (payload: CreatePermissionPayload) => adminPermissionApi.create(payload),
    onSuccess: () => {
      toast.success('Tạo permission thành công')
      onDataChanged()
      closePermissionDialog()
    },
    onError: (error: Error) => {
      toast.error('Tạo permission thất bại', { description: error.message })
    },
  })

  const updatePermissionMutation = useMutation({
    mutationFn: ({ permissionId, payload }: { permissionId: string; payload: UpdatePermissionPayload }) =>
      adminPermissionApi.update(permissionId, payload),
    onSuccess: () => {
      toast.success('Cập nhật permission thành công')
      onDataChanged()
      closePermissionDialog()
    },
    onError: (error: Error) => {
      toast.error('Cập nhật permission thất bại', { description: error.message })
    },
  })

  const deletePermissionMutation = useMutation({
    mutationFn: (permissionId: string) => adminPermissionApi.remove(permissionId),
    onSuccess: () => {
      toast.success('Đã xóa permission')
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error('Xóa permission thất bại', { description: error.message })
    },
  })

  const createModuleMutation = useMutation({
    mutationFn: ({ newModuleName, permissionIds }: { newModuleName: string; permissionIds: string[] }) =>
      adminPermissionApi.createModule({ moduleName: newModuleName, permissionIds }),
    onSuccess: () => {
      toast.success('Tạo module thành công')
      onDataChanged()
      closeModuleDialog()
    },
    onError: (error: Error) => {
      toast.error('Tạo module thất bại', { description: error.message })
    },
  })

  const deleteModuleMutation = useMutation({
    mutationFn: (targetModule: string) => adminPermissionApi.deleteModule(targetModule),
    onSuccess: () => {
      toast.success('Đã xóa module khỏi permissions')
      onDataChanged()
    },
    onError: (error: Error) => {
      toast.error('Xóa module thất bại', { description: error.message })
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
      toast.error('Tên permission và API path không được để trống')
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
      toast.info('Không có thay đổi để cập nhật')
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
            <CardTitle>Quản lý Permissions</CardTitle>
            <CardDescription>
              Quản lý endpoint permissions và nhóm module hệ thống.
            </CardDescription>
          </div>
          <div className="flex w-full max-w-3xl flex-wrap gap-2">
            <div className="relative min-w-64 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo API path, method, module..."
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={() => setModuleDialogOpen(true)}>
              <Settings className="size-4" />
              Tạo module
            </Button>
            <Button onClick={openCreatePermissionDialog}>
              <Plus className="size-4" />
              Permission mới
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {modules.length === 0 ? (
            <Badge variant="outline">Chưa có module</Badge>
          ) : (
            modules.map((moduleName) => (
              <div key={moduleName} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                <span className="font-medium">{moduleName}</span>
                <button
                  type="button"
                  className="text-destructive"
                  disabled={deleteModuleMutation.isPending}
                  onClick={() => {
                    if (!window.confirm(`Gỡ module ${moduleName} khỏi tất cả permissions?`)) {
                      return
                    }
                    deleteModuleMutation.mutate(moduleName)
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên permission</TableHead>
              <TableHead>API Path</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Module</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPermissions.map((permission) => (
              <TableRow key={permission.permissionId}>
                <TableCell>
                  <p className="font-medium">{permission.name}</p>
                  <p className="text-xs text-muted-foreground">ID: {permission.permissionId}</p>
                </TableCell>
                <TableCell className="font-mono text-xs">{permission.apiPath}</TableCell>
                <TableCell>
                  <Badge variant="outline">{permission.httpMethod}</Badge>
                </TableCell>
                <TableCell>
                  {permission.module ? <Badge>{permission.module}</Badge> : <Badge variant="secondary">No module</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEditPermissionDialog(permission)}>
                      Sửa
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deletePermissionMutation.isPending}
                      onClick={() => {
                        if (!window.confirm(`Xóa permission ${permission.name}?`)) {
                          return
                        }
                        deletePermissionMutation.mutate(permission.permissionId)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredPermissions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Không có permission phù hợp.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={permissionDialogOpen} onOpenChange={(open) => { if (!open) closePermissionDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{permissionDialogMode === 'create' ? 'Tạo permission mới' : 'Cập nhật permission'}</DialogTitle>
            <DialogDescription>
              Chỉnh sửa chính xác endpoint path và HTTP method theo backend contract.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin-permission-name">Tên</Label>
              <Input
                id="admin-permission-name"
                value={permissionForm.name}
                onChange={(event) => setPermissionForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-permission-api-path">API path</Label>
              <Input
                id="admin-permission-api-path"
                value={permissionForm.apiPath}
                onChange={(event) => setPermissionForm((prev) => ({ ...prev, apiPath: event.target.value }))}
                placeholder="/api/v1/example"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>HTTP method</Label>
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
                <Label>Module</Label>
                <Select value={permissionForm.module} onValueChange={(value) => setPermissionForm((prev) => ({ ...prev, module: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_MODULE}>No module</SelectItem>
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
              Hủy
            </Button>
            <Button onClick={submitPermission} disabled={createPermissionMutation.isPending || updatePermissionMutation.isPending}>
              {(createPermissionMutation.isPending || updatePermissionMutation.isPending) && <Loader2 className="size-4 animate-spin" />}
              {permissionDialogMode === 'create' ? 'Tạo permission' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moduleDialogOpen} onOpenChange={(open) => { if (!open) closeModuleDialog() }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tạo module cho permissions</DialogTitle>
            <DialogDescription>
              Chỉ permissions chưa thuộc module mới có thể gán vào module mới.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin-module-name">Tên module</Label>
              <Input
                id="admin-module-name"
                value={moduleName}
                onChange={(event) => setModuleName(event.target.value)}
                placeholder="Ví dụ: REPORTS"
              />
            </div>

            <div className="space-y-2">
              <Label>Permissions chưa thuộc module</Label>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
                {unassignedPermissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tất cả permissions đã có module.</p>
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
              Hủy
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
              Tạo module
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
