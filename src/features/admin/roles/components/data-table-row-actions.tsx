import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import type { Row } from '@tanstack/react-table'
import { IconEdit, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRoles } from '../context/roles-context'
import type { Role } from '../data/schema'
import { useTranslation } from 'react-i18next'

interface DataTableRowActionsProps<TData> {
  row: Row<TData>
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const role = row.original as Role
  const { setOpen, setCurrentRow } = useRoles()
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
        >
          <DotsHorizontalIcon className="h-4 w-4" />
          <span className="sr-only">{t('openMenu')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(role)
            setOpen('edit')
          }}
        >
          <IconEdit className="mr-2 h-4 w-4 text-amber-500" />
          {t('edit')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(role)
            setOpen('delete')
          }}
          className="text-red-600"
        >
          <IconTrash className="mr-2 h-4 w-4 text-red-500" />
          {t('delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
