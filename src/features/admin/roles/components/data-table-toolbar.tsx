import { Cross2Icon } from '@radix-ui/react-icons'
import type { Table } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableFacetedFilter } from '@/components/ui/data-table-faceted-filter'
import { DataTableViewOptions } from '@/components/ui/data-table-view-options'
import { useTranslation } from 'react-i18next'
import { IconSearch } from '@tabler/icons-react'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
}

export function DataTableToolbar<TData>({ table }: DataTableToolbarProps<TData>) {
  const { t } = useTranslation()
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2">
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
            onChange={(event) => table.getColumn('name')?.setFilterValue(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px] pl-8 truncate"
          />
        </div>
        <div className="flex gap-x-2 flex-wrap">
          {table.getColumn('active') && (
            <DataTableFacetedFilter
              column={table.getColumn('active')}
              title={t('status')}
              options={[
                { label: t('active'), value: 'true' },
                { label: t('inactive'), value: 'false' },
              ]}
            />
          )}
        </div>
        {isFiltered && (
          <Button variant="ghost" onClick={() => table.resetColumnFilters()} className="h-8 px-2 lg:px-3 truncate">
            {t('reset')}
            <Cross2Icon className="ml-2 h-4 w-4 flex-shrink-0" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
}
