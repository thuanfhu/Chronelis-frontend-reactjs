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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('confirmDelete')}</DialogTitle>
          <DialogDescription>
            {t('roleDeleteConfirmation', { roleName: currentRow.name, defaultValue: `Bạn có chắc chắn muốn xóa vai trò "${currentRow.name}"?` })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Label className="space-y-2 block">
            <span>
              {t('enterRoleNameToConfirm', { roleName: currentRow.name, defaultValue: `Nhập tên vai trò "${currentRow.name}" để xác nhận` })}
            </span>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('enterRoleNamePlaceholder', 'Nhập tên vai trò')}
            />
          </Label>
          <Alert variant="destructive">
            <IconAlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('warning')}</AlertTitle>
            <AlertDescription>{t('roleDeleteWarning', 'Thao tác này không thể hoàn tác')}</AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setValue('') }}>
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={value.trim() !== currentRow.name}
          >
            {t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
