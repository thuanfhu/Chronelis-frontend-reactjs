import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { httpMethods } from '../data/data'
import type { Permission } from '../data/schema'
import { toast } from 'sonner'
import { usePermissions } from '../context/permissions-context'
import { adminPermissionApi } from '@/lib/api/modules/admin-permission-api'
import { useTranslation } from 'react-i18next'

const addPermissionSchema = z.object({
  name: z.string().min(1, 'Tên permission là bắt buộc'),
  apiPath: z.string().min(1, 'API path là bắt buộc'),
  httpMethod: z.enum(['GET', 'DELETE', 'POST', 'PUT', 'PATCH'] as const),
  module: z.string().default(''),
})

const editPermissionSchema = z.object({
  name: z.string().optional(),
  apiPath: z.string().optional(),
  httpMethod: z.enum(['GET', 'DELETE', 'POST', 'PUT', 'PATCH'] as const).optional(),
  module: z.string().optional(),
})

interface PermissionsFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Permission | null
}

export function PermissionsFormDialog({ open, onOpenChange, currentRow }: PermissionsFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [availableModules, setAvailableModules] = useState<string[]>([])
  const { refetch } = usePermissions()
  const { t } = useTranslation()

  const isEditMode = !!currentRow
  const schema = isEditMode ? editPermissionSchema : addPermissionSchema

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: currentRow?.name || '',
      apiPath: currentRow?.apiPath || '',
      httpMethod: currentRow?.httpMethod || 'GET',
      module: currentRow?.module || '',
    },
  })

  useEffect(() => {
    if (currentRow) {
      form.reset({
        name: currentRow.name,
        apiPath: currentRow.apiPath,
        httpMethod: currentRow.httpMethod,
        module: currentRow.module,
      })
    }
  }, [currentRow, form])

  useEffect(() => {
    if (open) fetchModules()
  }, [open])

  const fetchModules = async () => {
    try {
      const modules = await adminPermissionApi.listModules()
      setAvailableModules(modules || [])
    } catch (error) {
      console.error('Error fetching modules:', error)
      setAvailableModules([])
    }
  }

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setIsLoading(true)
    try {
      let payload = { ...values }

      if (payload.module === 'none' || !payload.module) {
        payload.module = ''
      }

      if (isEditMode && currentRow) {
        const changedFields = Object.entries(values).reduce(
          (acc, [key, value]) => {
            if (value !== currentRow[key as keyof Permission]) {
              ;(acc as any)[key] = value
            }
            return acc
          },
          {} as Record<string, any>,
        )

        if ((changedFields as any).module === 'none' || !(changedFields as any).module) {
          delete (changedFields as any).module
        }

        if (Object.keys(changedFields).length === 0) {
          onOpenChange(false)
          return
        }

        await adminPermissionApi.update(currentRow.permissionId, changedFields)
        toast.success(t('notification.permissionUpdateSuccess', 'Cập nhật quyền thành công'))
      } else {
        const { name, apiPath, httpMethod, module } = values as z.infer<typeof addPermissionSchema>
        const createPayload: any = {
          name: name as string,
          apiPath: apiPath as string,
          httpMethod: httpMethod as 'GET' | 'DELETE' | 'POST' | 'PUT' | 'PATCH',
          ...(module !== 'none' && module ? { module } : {}),
        }
        await adminPermissionApi.create(createPayload)
        toast.success(t('notification.permissionCreateSuccess', 'Tạo quyền thành công'))
      }

      await refetch()
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('notification.genericError', 'Có lỗi xảy ra')
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] dark:bg-zinc-800">
        <DialogHeader>
          <DialogTitle>{currentRow ? t('permissionEditTitle') : t('permissionAddTitle')}</DialogTitle>
          <DialogDescription>{currentRow ? t('permissionEditDesc') : t('permissionAddDesc')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('permissionName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('permissionNamePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('permissionApiPath')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('permissionApiPathPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="httpMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('permissionHttpMethod')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue>{field.value ? field.value : t('permissionHttpMethodPlaceholder')}</SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {httpMethods.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="module"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('permissionModule')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || 'none'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('permissionModulePlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t('none', 'Không có')}</SelectItem>
                      {availableModules.map((module) => (
                        <SelectItem key={module} value={module}>
                          {module}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? t('permissionUpdating') : t('submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
