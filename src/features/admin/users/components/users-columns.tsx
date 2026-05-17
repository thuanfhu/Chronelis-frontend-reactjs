import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { format } from 'date-fns'
import { vi, enUS } from 'date-fns/locale'
import type { User } from '../data/schema'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { DataTableRowActions } from './data-table-row-actions'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export const useColumns = (): ColumnDef<User>[] => {
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
          aria-label={t('selectRow', 'Select row')}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: 'avatar',
      header: () => <div>{t('userManagement.columns.avatar')}</div>,
      cell: ({ row }) => {
        const user = row.original
        const name = `${user.firstName} ${user.lastName}`
        const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
        return (
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar || user.avatarUrl} alt={name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('userManagement.columns.email')} />
      ),
    },
    {
      accessorKey: 'lastName',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('userManagement.columns.lastName')} />
      ),
    },
    {
      accessorKey: 'firstName',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('userManagement.columns.firstName')} />
      ),
    },
    {
      accessorKey: 'isVerified',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('userManagement.columns.isVerified')} className="justify-center" />
      ),
      cell: ({ row }) => {
        const isVerified = row.getValue('isVerified') as boolean
        return (
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className={isVerified ? 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100' : 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100'}
            >
              {isVerified ? t('userManagement.verification.verified') : t('userManagement.verification.unverified')}
            </Badge>
          </div>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(String(row.getValue(id)))
      },
    },
    {
      accessorKey: 'roles',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('userManagement.columns.roles')} className="justify-center" />
      ),
      cell: ({ row }) => {
        const roles = row.getValue('roles') as Array<any>
        if (!roles || roles.length === 0) return <div className="flex justify-center"><span className="text-muted-foreground text-xs">—</span></div>
        return (
          <div className="flex flex-wrap gap-1 justify-center">
            {roles.slice(0, 2).map((role: any) => (
              <Badge 
                key={role.roleId || role.id || role.name} 
                variant="outline" 
                className={cn(
                  "text-xs border-none",
                  role.name === 'ADMIN' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                  role.name === 'USER' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
                )}
              >
                {role.name}
              </Badge>
            ))}
            {roles.length > 2 && (
              <Badge variant="outline" className="text-xs">+{roles.length - 2}</Badge>
            )}
          </div>
        )
      },
      filterFn: (row, id, value: string[]) => {
        const roles = row.getValue(id) as Array<any>
        if (!roles || roles.length === 0) return false
        return roles.some((r) => value.includes(r.name))
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('userManagement.columns.createdAt')} className="justify-center" />
      ),
      cell: ({ row }) => {
        const dateStr = row.getValue('createdAt') as string
        try {
          const date = new Date(dateStr)
          return (
            <div className="flex flex-col text-sm items-center">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {format(date, 'dd/MM/yyyy', { locale: dateLocale })}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {format(date, 'HH:mm', { locale: dateLocale })}
              </span>
            </div>
          )
        } catch {
          return dateStr || '—'
        }
      },
    },
    {
      id: 'actions',
      cell: DataTableRowActions,
    },
  ], [t, dateLocale])
}
