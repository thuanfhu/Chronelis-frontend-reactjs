import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { format } from 'date-fns'
import { vi, enUS } from 'date-fns/locale'
import type { Role } from '../data/schema'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { DataTableRowActions } from './data-table-row-actions'
import { useTranslation } from 'react-i18next'

export const useColumns = (): ColumnDef<Role>[] => {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'vi' ? vi : enUS

  return useMemo(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('selectAll')}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('roleName')} />
      ),
    },
    {
      accessorKey: 'description',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('description')} />
      ),
    },
    {
      accessorKey: 'permissions',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('permissions')} />
      ),
      cell: ({ row }) => {
        const permissions = row.getValue('permissions') as Array<any>
        return <div>{(permissions || []).length}</div>
      },
    },
    {
      accessorKey: 'active',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('status')} />
      ),
      cell: ({ row }) => {
        const active = row.getValue('active') as boolean
        return (
          <Badge
            variant="outline"
            className={
              active ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'
            }
          >
            {active ? t('active') : t('inactive')}
          </Badge>
        )
      },
      filterFn: (row, id, value) => {
        return value === String(row.getValue(id))
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('createdAt', 'Created At')} />
      ),
      cell: ({ row }) => {
        const dateStr = row.getValue('createdAt') as string
        if (!dateStr) return '—'
        try {
          return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: dateLocale })
        } catch {
          return dateStr
        }
      },
    },
    {
      accessorKey: 'createdBy',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('createdBy', 'Created By')} />
      ),
    },
    {
      id: 'actions',
      cell: DataTableRowActions,
    },
  ], [t, dateLocale])
}
