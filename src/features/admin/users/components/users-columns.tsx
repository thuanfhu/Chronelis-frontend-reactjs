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
        <DataTableColumnHeader column={column} title={t('userManagement.columns.isVerified')} />
      ),
      cell: ({ row }) => {
        const isVerified = row.getValue('isVerified') as boolean
        return (
          <Badge
            variant="outline"
            className={isVerified ? 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100' : 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100'}
          >
            {isVerified ? t('userManagement.verification.verified') : t('userManagement.verification.unverified')}
          </Badge>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(String(row.getValue(id)))
      },
    },
    {
      accessorKey: 'roles',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('userManagement.columns.roles')} />
      ),
      cell: ({ row }) => {
        const roles = row.getValue('roles') as Array<any>
        if (!roles || roles.length === 0) return <span className="text-muted-foreground text-xs">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {roles.slice(0, 2).map((role: any) => (
              <Badge key={role.roleId || role.id || role.name} variant="secondary" className="text-xs">
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
        <DataTableColumnHeader column={column} title={t('userManagement.columns.createdAt')} />
      ),
      cell: ({ row }) => {
        const dateStr = row.getValue('createdAt') as string
        try {
          return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: dateLocale })
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
