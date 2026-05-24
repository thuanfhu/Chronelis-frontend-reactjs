import { IconPlus, IconFolder } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { CreateModuleDialog } from './create-module-dialog'
import { PermissionsFormDialog } from './permissions-form-dialog'

export function PermissionsPrimaryButtons() {
  const { t } = useTranslation()
  const [addPermOpen, setAddPermOpen] = useState(false)
  const [addModuleOpen, setAddModuleOpen] = useState(false)

  return (
    <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
      <Button variant="outline" className="space-x-1 w-full sm:w-auto" onClick={() => setAddModuleOpen(true)}>
        <span>{t('moduleAdd')}</span> <IconFolder size={18} />
      </Button>
      <Button className="space-x-1 w-full sm:w-auto" onClick={() => setAddPermOpen(true)}>
        <span>{t('permissionAddTitle')}</span> <IconPlus size={18} />
      </Button>
      <PermissionsFormDialog open={addPermOpen} onOpenChange={setAddPermOpen} currentRow={null} />
      <CreateModuleDialog open={addModuleOpen} onOpenChange={setAddModuleOpen} />
    </div>
  )
}
