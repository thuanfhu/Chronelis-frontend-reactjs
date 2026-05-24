import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useState } from 'react'
import { toast } from 'sonner'
import { usePermissions } from '../context/permissions-context'
import { adminPermissionApi } from '@/lib/api/modules/admin-permission-api'
import { useTranslation } from 'react-i18next'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'module' | 'permission'
  data: {
    permissionId?: string
    name: string
    module?: string
  }
}

export function PermissionsDeleteDialog({ open, onOpenChange, type, data }: Props) {
  const { refetch } = usePermissions()
  const [isDeleting, setIsDeleting] = useState(false)
  const { t } = useTranslation()

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      if (type === 'module' && data.name) {
        await adminPermissionApi.deleteModule(data.name)
        toast.success(t('moduleDeleteSuccess', { moduleName: data.name }))
      } else if (data.permissionId) {
        await adminPermissionApi.remove(data.permissionId)
        toast.success(t('permissionDeleteSuccess'))
      }
      refetch()
      onOpenChange(false)
    } catch (error) {
      toast.error(t('permissionDeleteError'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {type === 'module' ? t('moduleConfirmDelete') : t('permissionConfirmDelete')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {type === 'module'
              ? t('moduleDeleteDesc', { moduleName: data.name })
              : t('permissionDeleteDesc', { permissionName: data.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? t('permissionDeleting') : t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
