import { useState } from 'react'
import { IconAlertTriangle } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRoles } from '../context/roles-context'
import { useTranslation } from 'react-i18next'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RolesDeleteDialog({ open, onOpenChange }: Props) {
  const [value, setValue] = useState('')
  const { currentRow, deleteRole } = useRoles()
  const { t } = useTranslation()

  if (!currentRow) return null

  const handleDelete = async () => {
    if (value.trim() !== currentRow.name) return
    try {
      await deleteRole(currentRow.roleId)
      toast.success(t('roleDeleteSuccess', { roleName: currentRow.name, defaultValue: `Vai trò "${currentRow.name}" đã được xóa thành công` }))
      onOpenChange(false)
      setValue('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('roleDeleteError', 'Lỗi khi xóa vai trò'))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        onOpenChange(newOpen)
        if (!newOpen) setValue('')
      }}
    >
      <DialogContent className="sm:max-w-[425px] dark:bg-zinc-900">
        <DialogHeader className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <IconAlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
          </div>
          <div className="text-center">
            <DialogTitle className="text-lg font-semibold text-foreground">
              {t('confirmDelete')}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              {t('roleDeleteConfirmation', { roleName: currentRow.name, defaultValue: `Bạn có chắc chắn muốn xóa vai trò "${currentRow.name}"?` })}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="role-name-confirm" className="text-sm font-medium">
              {t('enterRoleNameToConfirm', { roleName: currentRow.name, defaultValue: `Nhập tên vai trò "${currentRow.name}" để xác nhận` })}
            </Label>
            <Input
              id="role-name-confirm"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('enterRoleNamePlaceholder', 'Nhập tên vai trò')}
              className="border-red-200 focus-visible:ring-red-500"
            />
          </div>

          <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/50">
            <IconAlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertTitle className="text-red-700 dark:text-red-300 font-medium">{t('warning')}</AlertTitle>
            <AlertDescription className="text-red-600 dark:text-red-400 text-xs">
              {t('roleDeleteWarning', 'Thao tác này không thể hoàn tác và có thể ảnh hưởng đến người dùng đang giữ vai trò này.')}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => { onOpenChange(false); setValue('') }}
            className="flex-1 sm:flex-none"
          >
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={value.trim() !== currentRow.name}
            className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white disabled:bg-red-200 dark:disabled:bg-red-900/50"
          >
            {t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
