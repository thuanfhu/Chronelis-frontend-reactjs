import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { User } from '../data/schema'
import { useUsers } from '../context/users-context'
import { useTranslation } from 'react-i18next'

interface Props {
  currentRow: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UsersDeleteDialog({ currentRow, open, onOpenChange }: Props) {
  const [value, setValue] = useState('')
  const { deleteUser } = useUsers()
  const { t } = useTranslation()

  const handleDelete = async () => {
    if (!currentRow || value.trim() !== currentRow.email) return
    await deleteUser(currentRow.userId)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('userManagement.deleteUser')}</DialogTitle>
          <DialogDescription>
            {t('userManagement.deleteConfirmation')}{' '}
            <span className="font-medium">{currentRow?.email}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder={t('userManagement.enterEmailToConfirm')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={value.trim() !== currentRow?.email}
          >
            {t('userManagement.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
