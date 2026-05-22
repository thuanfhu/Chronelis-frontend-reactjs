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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

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
      size: 40,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('roleName')} />
      ),
      cell: ({ row }) => {
        const role = row.original
        return (
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <div className="font-medium cursor-help hover:text-primary transition-colors">
                  {role.name}
                </div>
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                className="bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-lg p-3 max-w-[600px] w-max"
              >
                <p className="text-sm font-semibold mb-1 text-slate-900 dark:text-slate-100">{role.name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed text-balance">{role.description || t('noDescription', 'Không có mô tả')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
      size: 200,
    },
    {
      accessorKey: 'permissions',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('permissions')} className="justify-center" />
      ),
      cell: ({ row }) => {
        const permissions = row.getValue('permissions') as Array<any>
        return <div className="text-center">{(permissions || []).length}</div>
      },
      size: 100,
    },
    {
      accessorKey: 'active',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('status')} className="justify-center" />
      ),
      cell: ({ row }) => {
        const active = row.getValue('active') as boolean
        return (
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className={
                active ? 'bg-green-100 text-green-900 border-green-200' : 'bg-red-100 text-red-900 border-red-200'
              }
            >
              {active ? t('active') : t('inactive')}
            </Badge>
          </div>
        )
      },
      filterFn: (row, id, value) => {
        return value === String(row.getValue(id))
      },
      size: 120,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('createdAt', 'Created At')} className="justify-center" />
      ),
      cell: ({ row }) => {
        const dateStr = row.getValue('createdAt') as string
        if (!dateStr) return <div className="text-center">-</div>
        try {
          const cleanDateStr = dateStr.replace(' PM', '').replace(' AM', '')
          const date = new Date(cleanDateStr.includes('T') ? cleanDateStr : cleanDateStr.replace(' ', 'T'))
          
          if (isNaN(date.getTime())) {
            return <div className="text-center text-muted-foreground">{dateStr}</div>
          }
          
          return (
            <div className="text-center font-mono text-sm">
              {format(date, 'dd/MM/yyyy HH:mm', { locale: dateLocale })}
            </div>
          )
        } catch {
          return <div className="text-center text-muted-foreground">{dateStr}</div>
        }
      },
      size: 180,
    },
    {
      accessorKey: 'createdBy',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('createdBy', 'Created By')} className="justify-center" />
      ),
      cell: ({ row }) => (
        <div className="text-center text-sm text-muted-foreground">
          {row.getValue('createdBy') || '-'}
        </div>
      ),
      size: 150,
    },
    {
      id: 'actions',
      cell: DataTableRowActions,
      size: 50,
    },
  ], [t, dateLocale])
}
