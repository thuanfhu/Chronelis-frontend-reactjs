import { IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { useRoles } from '../context/roles-context'
import { useTranslation } from 'react-i18next'

export function RolesPrimaryButtons() {
  const { setOpen } = useRoles()
  const { t } = useTranslation()

  return (
    <div className="flex gap-2">
      <Button className="space-x-1" onClick={() => setOpen('add')}>
        <span>{t('addNewRole')}</span> <IconPlus size={18} />
      </Button>
    </div>
  )
}
