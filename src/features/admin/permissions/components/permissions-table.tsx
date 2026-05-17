import { useState } from 'react'
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import { DataTableViewOptions } from '@/components/ui/data-table-view-options'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconChevronRight, IconEdit, IconTrash } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { usePermissions } from '../context/permissions-context'
import type { Permission } from '../data/schema'
import { useTranslation } from 'react-i18next'
import { PermissionsFormDialog } from './permissions-form-dialog'
import { PermissionsDeleteDialog } from './permissions-delete-dialog'


interface TableItem {
  id: string
  name: string
  type: 'module' | 'permission'
  apiPath?: string
  httpMethod?: string
  module?: string
  children?: Permission[]
  permissionId?: string
  createdAt?: string
  updatedAt?: string
  createdBy?: string
}

export function PermissionsTable() {
  const {
    permissions,
    isLoading,
    selectedModule,
  } = usePermissions()
  const { t } = useTranslation()

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({})
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteData, setDeleteData] = useState<{ permissionId?: string; name: string; module?: string } | null>(null)

  // Filter permissions by selected module or show all
  const filteredPermissions = selectedModule
    ? permissions.filter((p) => p.module === selectedModule)
    : permissions

  // Group permissions by module  
  const groupedByModule = filteredPermissions.reduce(
    (acc, permission) => {
      const module = permission.module || 'Other'
      if (!acc[module]) acc[module] = []
      acc[module].push(permission)
      return acc
    },
    {} as Record<string, Permission[]>
  )

  // Build flat table data with modules and permissions
  const tableData: TableItem[] = Object.entries(groupedByModule).flatMap(
    ([module, modulePermissions]) => {
      const isExpanded = expandedModules[module] !== false // default expanded
      const rows: TableItem[] = [
        {
          id: `module-${module}`,
          name: module,
          type: 'module' as const,
          children: modulePermissions,
        },
      ]
      if (isExpanded) {
        modulePermissions.forEach((p) => {
          rows.push({
            id: p.permissionId,
            name: p.name,
            type: 'permission' as const,
            apiPath: p.apiPath,
            httpMethod: p.httpMethod,
            module: p.module,
            permissionId: p.permissionId,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            createdBy: p.createdBy,
          })
        })
      }
      return rows
    }
  )

  const handleDeletePermission = (permission: Permission) => {
    setDeleteData({
      permissionId: permission.permissionId,
      name: permission.name,
      module: permission.module,
    })
    setDeleteOpen(true)
  }

  const handleEditPermission = (permission: Permission) => {
    setSelectedPermission(permission)
    setEditOpen(true)
  }

  const columns: ColumnDef<TableItem>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('permissionName')} />
      ),
      cell: ({ row }) => {
        const item = row.original
        if (item.type === 'module') {
          return (
            <button
              className="flex items-center gap-2 font-medium hover:text-primary transition-colors"
              onClick={() => {
                setExpandedModules((prev) => ({
                  ...prev,
                  [item.name]: prev[item.name] === false ? true : false,
                }))
              }}
            >
              <IconChevronRight
                className={cn(
                  'h-4 w-4 shrink-0 transition-transform duration-200',
                  expandedModules[item.name] !== false && 'rotate-90'
                )}
              />
              <Badge variant="outline" className="font-semibold">
                {item.name}
              </Badge>
              <span className="text-xs text-muted-foreground ml-1">
                ({item.children?.length || 0})
              </span>
            </button>
          )
        }
        return <div className="pl-8 font-medium">{item.name}</div>
      },
    },
    {
      accessorKey: 'apiPath',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('permissionApiPath')} />
      ),
      cell: ({ row }) => {
        if (row.original.type === 'module') return null
        return <div className="text-sm text-muted-foreground">{row.original.apiPath}</div>
      },
    },
    {
      accessorKey: 'httpMethod',
      header: 'HTTP Method',
      cell: ({ row }) => {
        if (row.original.type === 'module') return null
        const method = row.original.httpMethod
        const colorMap: Record<string, string> = {
          GET: 'bg-blue-100 text-blue-800',
          POST: 'bg-green-100 text-green-800',
          PUT: 'bg-yellow-100 text-yellow-800',
          PATCH: 'bg-orange-100 text-orange-800',
          DELETE: 'bg-red-100 text-red-800',
        }
        return (
          <Badge variant="secondary" className={cn('text-xs font-mono', colorMap[method || ''] || '')}>
            {method}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const item = row.original
        if (item.type !== 'permission' || !item.permissionId) return null
        const permission: Permission = {
          permissionId: item.permissionId,
          name: item.name,
          apiPath: item.apiPath || '',
          httpMethod: (item.httpMethod as Permission['httpMethod']) || 'GET',
          module: item.module || '',
          createdAt: item.createdAt || '',
          updatedAt: item.updatedAt || '',
          createdBy: item.createdBy || '',
        }
        return (
          <div className="flex items-center gap-1 justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-amber-600"
              onClick={() => handleEditPermission(permission)}
            >
              <IconEdit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-red-600"
              onClick={() => handleDeletePermission(permission)}
            >
              <IconTrash className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-muted-foreground">{t('tableLoading')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder={t('searchPlaceholder')}
            value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn('name')?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>
        <DataTableViewOptions table={table} />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    row.original.type === 'module' &&
                      'bg-muted/40 hover:bg-muted/60 font-medium cursor-pointer'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {t('tableNoData')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />

      {/* Dialogs */}
      {editOpen && (
        <PermissionsFormDialog
          key={selectedPermission ? `perm-edit-${selectedPermission.permissionId}` : 'perm-add'}
          open={editOpen}
          onOpenChange={(isOpen) => {
            setEditOpen(isOpen)
            if (!isOpen) setSelectedPermission(null)
          }}
          currentRow={selectedPermission}
        />
      )}
      {deleteOpen && deleteData && (
        <PermissionsDeleteDialog
          open={deleteOpen}
          onOpenChange={(isOpen) => {
            setDeleteOpen(isOpen)
            if (!isOpen) setDeleteData(null)
          }}
          type="permission"
          data={deleteData}
        />
      )}
    </div>
  )
}
