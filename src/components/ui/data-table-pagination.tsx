import { ChevronLeftIcon, ChevronRightIcon, DoubleArrowLeftIcon, DoubleArrowRightIcon } from '@radix-ui/react-icons'
import type { Table } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslation } from 'react-i18next'

interface DataTablePaginationProps<TData> {
  table: Table<TData>
  totalPages?: number
  onPageChange?: (page: number) => void
}

export function DataTablePagination<TData>({ table, totalPages, onPageChange }: DataTablePaginationProps<TData>) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-between overflow-auto px-2">
      <div className="hidden flex-1 text-sm text-muted-foreground sm:block">
        {table.getFilteredSelectedRowModel().rows.length} {t('selectedCount')} {t('tablePagination.of')}{' '}
        {table.getFilteredRowModel().rows.length} {t('tablePagination.entries')}
      </div>
      <div className="flex items-center sm:space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="hidden text-sm font-medium sm:block">{t('tablePagination.rowsPerPage')}</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-[100px] items-center justify-center text-sm font-medium whitespace-nowrap">
          {t('tablePagination.page')} {table.getState().pagination.pageIndex + 1} {t('tablePagination.of')}{' '}
          {totalPages ?? table.getPageCount()}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => {
              table.setPageIndex(0)
              onPageChange?.(1)
            }}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">{t('tablePagination.first')}</span>
            <DoubleArrowLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => {
              table.previousPage()
              onPageChange?.(table.getState().pagination.pageIndex)
            }}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">{t('tablePagination.previous')}</span>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => {
              table.nextPage()
              onPageChange?.(table.getState().pagination.pageIndex + 2)
            }}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">{t('tablePagination.next')}</span>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => {
              const lastPage = (totalPages ?? table.getPageCount()) - 1
              table.setPageIndex(lastPage)
              onPageChange?.(totalPages ?? table.getPageCount())
            }}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">{t('tablePagination.last')}</span>
            <DoubleArrowRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
