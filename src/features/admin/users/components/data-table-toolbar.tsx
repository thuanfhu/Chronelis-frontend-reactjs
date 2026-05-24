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
    <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:flex-1 sm:space-x-2">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-[150px] lg:w-[250px]">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchByEmail')}
              value={(table.getColumn('email')?.getFilterValue() as string) ?? ''}
              onChange={(event) => table.getColumn('email')?.setFilterValue(event.target.value)}
              className="h-9 w-full pl-8 truncate bg-slate-50/50 dark:bg-zinc-800/40"
            />
          </div>
          {table.getColumn('isVerified') && (
            <div className="shrink-0 sm:hidden">
              <DataTableFacetedFilter
                column={table.getColumn('isVerified')}
                title={t('verificationStatus')}
                options={[
                  { label: t('verified'), value: 'true' },
                  { label: t('unverified'), value: 'false' },
                ]}
              />
            </div>
          )}
        </div>

        <div className="hidden sm:flex gap-x-2 flex-wrap">
          {table.getColumn('isVerified') && (
            <DataTableFacetedFilter
              column={table.getColumn('isVerified')}
              title={t('verificationStatus')}
              options={[
                { label: t('verified'), value: 'true' },
                { label: t('unverified'), value: 'false' },
              ]}
            />
          )}
        </div>

        {isFiltered && (
          <Button variant="ghost" onClick={() => table.resetColumnFilters()} className="h-9 px-2 lg:px-3 truncate w-full sm:w-auto">
            {t('reset')}
            <Cross2Icon className="ml-2 h-4 w-4 flex-shrink-0" />
          </Button>
        )}
      </div>

      <div className="flex items-center justify-end w-full sm:w-auto shrink-0">
        <DataTableViewOptions table={table} />
      </div>
    </div>
  )
}
