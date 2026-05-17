import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Collapse,
  CollapseContent,
  CollapseTrigger,
} from '@/components/ui/collapse'
import { useRoles } from '../context/roles-context'
import { toast } from 'sonner'
import type { Permission, Role } from '../data/schema'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconChevronRight } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { adminPermissionApi } from '@/lib/api/modules/admin-permission-api'
import { adminRoleApi } from '@/lib/api/modules/admin-role-api'

const formSchema = z.object({
  name: z.string().min(1, 'Tên vai trò không được để trống'),
  description: z.string().min(1, 'Mô tả không được để trống'),
  active: z.boolean(),
  permissionIds: z.array(z.string()).min(1, 'Phải chọn ít nhất một quyền'),
})

type FormValues = z.infer<typeof formSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: Role | null
}

interface GroupedPermissions {
  [key: string]: Permission[]
}

export function RolesFormDialog({ open, onOpenChange, currentRow }: Props) {
  const { updateRole, createRole, handleCloseDialog, fetchRoles } = useRoles()
  const isEdit = !!currentRow
  const [isLoading, setIsLoading] = useState(false)
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({})
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [groupedPermissions, setGroupedPermissions] = useState<GroupedPermissions>({})
  const { t } = useTranslation()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      active: true,
      permissionIds: [],
    },
  })

  useEffect(() => {
    if (open && currentRow) {
      const currentPermissions = (currentRow.permissions || []).map((p) => p.permissionId)
      form.reset({
        name: currentRow.name,
        description: currentRow.description || '',
        active: currentRow.active ?? true,
        permissionIds: currentPermissions,
      })
    } else if (!open) {
      form.reset({
        name: '',
        description: '',
        active: true,
        permissionIds: [],
      })
    }
  }, [open, currentRow, form])

  const handleClose = useCallback(() => {
    form.reset({
      name: '',
      description: '',
      active: true,
      permissionIds: [],
    })
    setOpenModules({})
    onOpenChange(false)
    setTimeout(() => {
      handleCloseDialog()
    }, 100)
  }, [form, handleCloseDialog, onOpenChange])

  const onSubmit = async (data: FormValues) => {
    try {
      if (isEdit && currentRow) {
        const updatedData: { name?: string; description?: string; active?: boolean } = {}
        if (data.name !== currentRow.name) updatedData.name = data.name
        if (data.description !== currentRow.description) updatedData.description = data.description
        if (data.active !== currentRow.active) updatedData.active = data.active

        const currentPermissionIds = (currentRow.permissions || []).map((p) => p.permissionId)
        const addedPermissions = data.permissionIds.filter((id) => !currentPermissionIds.includes(id))
        const removedPermissions = currentPermissionIds.filter((id) => !data.permissionIds.includes(id))

        if (addedPermissions.length > 0) {
          await adminRoleApi.update(currentRow.roleId, { permissionIds: addedPermissions })
        }
        if (removedPermissions.length > 0) {
          await adminRoleApi.deletePermissions(currentRow.roleId, { permissionIds: removedPermissions })
        }

        if (Object.keys(updatedData).length === 0 && addedPermissions.length === 0 && removedPermissions.length === 0) {
          onOpenChange(false)
          return
        }

        if (Object.keys(updatedData).length > 0) {
          await updateRole(currentRow.roleId, updatedData)
        } else {
          fetchRoles()
          handleClose()
        }

        toast.success(t('notification.roleUpdateSuccess', 'Cập nhật vai trò thành công'))
      } else {
        await createRole({
          name: data.name,
          description: data.description,
          active: data.active,
          permissionIds: data.permissionIds,
        })
        toast.success(t('notification.roleCreateSuccess', 'Tạo vai trò thành công'))
      }
      handleClose()
    } catch (error) {
      console.error('Submit error:', error)
      toast.error(error instanceof Error ? error.message : t('notification.genericError', 'Có lỗi xảy ra'))
    }
  }

  // Fetch permissions
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setIsLoading(true)
        const result = await adminPermissionApi.list({ page: 1, size: 500 })
        const perms = (result.content || []).map((p: any) => ({
          permissionId: p.permissionId,
          name: p.name,
          apiPath: p.apiPath || '',
          httpMethod: p.httpMethod || 'GET',
          module: p.module || '',
          createdAt: p.createdAt || '',
          updatedAt: p.updatedAt || '',
          createdBy: p.createdBy || '',
        }))
        setAllPermissions(perms)
      } catch (error) {
        toast.error(t('notification.permissionLoadError', 'Không thể tải danh sách quyền'))
      } finally {
        setIsLoading(false)
      }
    }
    if (open) fetchPermissions()
  }, [open])

  // Group permissions by module
  useEffect(() => {
    const grouped = allPermissions.reduce((acc, permission) => {
      const module = permission.module || 'Other'
      if (!acc[module]) acc[module] = []
      acc[module].push(permission)
      return acc
    }, {} as GroupedPermissions)
    setGroupedPermissions(grouped)
  }, [allPermissions])

  const handleModulePermissionChange = (module: string, checked: boolean) => {
    const currentPermissions = form.getValues('permissionIds')
    const modulePermissionIds = (groupedPermissions[module] || []).map((p) => p.permissionId)
    if (checked) {
      form.setValue('permissionIds', Array.from(new Set([...currentPermissions, ...modulePermissionIds])))
    } else {
      form.setValue('permissionIds', currentPermissions.filter((id) => !modulePermissionIds.includes(id)))
    }
  }

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    const currentPermissions = form.getValues('permissionIds')
    if (checked) {
      form.setValue('permissionIds', [...currentPermissions, permissionId])
    } else {
      form.setValue('permissionIds', currentPermissions.filter((id) => id !== permissionId))
    }
  }

  const toggleModule = (module: string) => {
    setOpenModules((prev) => ({ ...prev, [module]: !prev[module] }))
  }

  const isModuleChecked = (modulePermissions: Permission[]) => {
    const currentPermissions = form.getValues('permissionIds')
    return modulePermissions.length > 0 && modulePermissions.every((p) => currentPermissions.includes(p.permissionId))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) handleClose()
      }}
    >
      <DialogContent
        className="max-w-2xl h-[90vh] p-0 flex flex-col bg-white dark:bg-zinc-800 rounded-lg shadow-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 py-4 border-b bg-slate-50 dark:bg-zinc-700 flex-none">
          <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {isEdit ? t('editRole') : t('addNewRole')}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 dark:text-slate-100">
            {isEdit ? t('editRoleDesc') : t('addNewRoleDesc')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 py-4 space-y-6">
                {/* Basic Info Section */}
                <div className="space-y-4 p-4 bg-white dark:text-slate-100 dark:bg-zinc-800 dark:border-slate-600 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-300 mb-3">
                    {t('basicInfo')}
                  </h3>

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-100">
                          {t('roleName')}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('enterRoleName')}
                            className="bg-white dark:text-slate-100 dark:bg-zinc-800 dark:border-slate-600"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs text-red-500" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-100">
                          {t('description')}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('enterRoleDescription')}
                            className="bg-white dark:text-slate-100 dark:bg-zinc-800 dark:border-slate-600 resize-none min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs text-red-500" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-zinc-700 dark:border-slate-700 p-4 border border-slate-200">
                        <div className="space-y-1">
                          <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-100">
                            {t('status')}
                          </FormLabel>
                          <div className="text-sm text-slate-900 dark:text-slate-200">
                            {t('role')} {field.value ? t('active') : t('inactive')}
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-slate-900 data-[state=unchecked]:bg-slate-100"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Permissions Section */}
                <FormField
                  control={form.control}
                  name="permissionIds"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-base font-semibold text-slate-900 dark:text-slate-300">
                          {t('permissions')}
                        </FormLabel>
                      </div>
                      <FormControl>
                        <div className="space-y-2">
                          {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                            </div>
                          ) : (
                            Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
                              <Collapse
                                key={module}
                                open={openModules[module]}
                                onOpenChange={() => toggleModule(module)}
                              >
                                <div className="w-full rounded-t-lg border bg-white dark:text-slate-100 dark:bg-zinc-800 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors px-4 py-3">
                                  <div className="flex items-center justify-between w-full">
                                    <CollapseTrigger className="flex items-center gap-3">
                                      <IconChevronRight
                                        className={cn(
                                          'h-4 w-4 shrink-0 transition-transform duration-200 text-slate-900 dark:text-slate-300',
                                          openModules[module] && 'rotate-90'
                                        )}
                                      />
                                      <span className="text-sm font-medium text-slate-900 dark:text-slate-300">
                                        {module}
                                      </span>
                                    </CollapseTrigger>
                                    <Switch
                                      checked={isModuleChecked(modulePermissions)}
                                      onCheckedChange={(checked) =>
                                        handleModulePermissionChange(module, checked)
                                      }
                                      className="data-[state=checked]:bg-slate-900 data-[state=unchecked]:bg-slate-100"
                                    />
                                  </div>
                                </div>
                                <CollapseContent className="divide-y divide-slate-100 border-x border-b rounded-b-lg bg-white dark:text-slate-100 dark:bg-zinc-800 dark:border-slate-600">
                                  {modulePermissions.map((permission) => (
                                    <div
                                      key={permission.permissionId}
                                      className="flex items-center justify-between pl-8 pr-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                                    >
                                      <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-100">
                                          {permission.name}
                                        </span>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                          <span>{permission.apiPath}</span>
                                          <span className={cn(
                                            "text-xs font-mono font-bold px-1.5 py-0.5 rounded",
                                            permission.httpMethod === 'GET' && "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20",
                                            permission.httpMethod === 'POST' && "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20",
                                            permission.httpMethod === 'PUT' && "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20",
                                            permission.httpMethod === 'DELETE' && "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20",
                                            permission.httpMethod === 'PATCH' && "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20"
                                          )}>
                                            {permission.httpMethod}
                                          </span>
                                        </div>
                                      </div>
                                      <Switch
                                        checked={field.value.includes(permission.permissionId)}
                                        onCheckedChange={(checked) => {
                                          handlePermissionChange(permission.permissionId, checked)
                                        }}
                                        className="data-[state=checked]:bg-slate-900 data-[state=unchecked]:bg-slate-100"
                                      />
                                    </div>
                                  ))}
                                </CollapseContent>
                              </Collapse>
                            ))
                          )}
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs text-red-500" />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>

            {/* Footer - outside ScrollArea so it always stays at bottom */}
            <div className="flex justify-end gap-4 px-6 py-4 border-t dark:bg-zinc-700 bg-slate-50 flex-none">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors"
              >
                {isEdit ? t('update') : t('add')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
