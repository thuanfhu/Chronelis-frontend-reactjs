import { useState, useEffect } from 'react'
import { usePermissions } from '../context/permissions-context'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CreateModuleDialog } from './create-module-dialog'
import { PermissionsDeleteDialog } from './permissions-delete-dialog'
import { PermissionsFormDialog } from './permissions-form-dialog'
import type { Permission } from '../data/schema'
import type {
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { SortableTreeItem } from './sortable-tree'
import { toast } from 'sonner'
import { adminPermissionApi } from '@/lib/api/modules/admin-permission-api'
import { useTranslation } from 'react-i18next'
import { DataTableSkeleton } from '@/components/ui/data-table-skeleton'
import { useQueryClient } from '@tanstack/react-query'

function DroppableArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'other-permissions',
  })
  const { t } = useTranslation()

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'space-y-3 p-6 rounded-xl border-2 border-dashed transition-all duration-200',
        isOver 
          ? 'border-primary bg-primary/5 dark:bg-primary/10 scale-[1.01] shadow-inner' 
          : 'border-slate-200 dark:border-slate-800',
        !children &&
          'min-h-[150px] flex flex-col items-center justify-center text-muted-foreground bg-slate-50/50 dark:bg-zinc-900/30'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('otherPermissions', 'Quyền chưa phân loại')}
        </h3>
        <Badge variant="secondary" className="rounded-full font-mono text-[10px]">
          {Array.isArray(children) ? children.length : children ? 1 : 0}
        </Badge>
      </div>
      {children || (
        <div className="text-sm text-center max-w-sm opacity-60">
          {t('dragPermissionHere', 'Kéo thả các quyền không thuộc module nào vào đây')}
        </div>
      )}
    </div>
  )
}

export function PermissionsTable() {
  const queryClient = useQueryClient()
  const { permissions, isLoading, refetch } = usePermissions()
  const [openCreateModule, setOpenCreateModule] = useState(false)
  const [deleteData, setDeleteData] = useState<{
    type: 'module' | 'permission'
    data: { permissionId?: string; name: string; module?: string }
  } | null>(null)
  const [openCreatePermission, setOpenCreatePermission] = useState(false)
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const modules = Array.from(new Set(permissions.map((p) => p.module).filter(Boolean))) as string[]

  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>(() => {
    return modules.reduce((acc, moduleName) => {
      acc[moduleName] = true // true = collapsed
      return acc
    }, {} as Record<string, boolean>)
  })
  const [isDragging, setIsDragging] = useState(false)
  const { t } = useTranslation()

  // Mở module khi nó mới được tạo
  useEffect(() => {
    setCollapsedModules((prev) => {
      const newState = { ...prev }
      let hasChanges = false
      modules.forEach((moduleName) => {
        if (newState[moduleName] === undefined) {
          newState[moduleName] = false // Mở module mới
          hasChanges = true
        }
      })
      return hasChanges ? newState : prev
    })
  }, [modules])

  const toggleCollapse = (moduleName: string) => {
    setCollapsedModules((prev) => ({
      ...prev,
      [moduleName]: !prev[moduleName],
    }))
  }

  const handleDelete = (permission: Permission) => {
    setDeleteData({
      type: 'permission',
      data: {
        permissionId: permission.permissionId,
        name: permission.name,
        module: permission.module,
      },
    })
  }

  const handleEdit = (permission: Permission) => {
    setSelectedPermission(permission)
    setOpenCreatePermission(true)
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    setIsDragging(true)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setIsDragging(false)
    setActiveId(null)

    const { active, over } = event
    if (!over || active.id === over.id) return

    const draggedPermission = permissions.find((p) => p.permissionId === active.id)
    if (!draggedPermission) return

    let newModule: string | null = null

    if (modules.includes(over.id as string)) {
      newModule = over.id as string
    } else {
      newModule = ''
    }

    if (newModule !== (draggedPermission.module || '')) {
      // Optimistic update
      const previousPermissions = permissions
      
      const optimisticPermissions = permissions.map(p => {
        if (p.permissionId === draggedPermission.permissionId) {
          return { ...p, module: newModule }
        }
        return p
      })
      
      // Update local cache directly for snappy UI
      queryClient.setQueryData(['admin-permissions'], (oldData: any) => {
        if (!oldData) return oldData
        return {
          ...oldData,
          permissions: optimisticPermissions
        }
      })
      
      // Mở module đích nếu nó đang bị đóng
      if (newModule && collapsedModules[newModule]) {
        toggleCollapse(newModule)
      }

      try {
        await adminPermissionApi.update(draggedPermission.permissionId, {
          module: newModule || '',
        })
        
        toast.success(t('notification.permissionUpdateSuccess', 'Cập nhật quyền thành công'))
        // Refetch to ensure data consistency
        refetch()
      } catch (error) {
        // Revert optimistic update
        queryClient.setQueryData(['admin-permissions'], (oldData: any) => {
          if (!oldData) return oldData
          return {
            ...oldData,
            permissions: previousPermissions
          }
        })
        const message = error instanceof Error ? error.message : t('notification.genericError')
        toast.error(message)
      }
    }
  }

  if (isLoading) {
    return <DataTableSkeleton columns={1} rows={5} />
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Modules và Permissions */}
        <div className="grid gap-3 max-h-[calc(100vh-14rem)] overflow-y-auto pr-2 pb-10">
          {modules.map((moduleName) => {
            const modulePermissions = permissions.filter(
              (p) => p.module === moduleName
            )

            return (
              <SortableContext
                key={moduleName}
                items={modulePermissions.map((p) => p.permissionId)}
              >
                <SortableTreeItem
                  id={moduleName}
                  collapsed={collapsedModules[moduleName]}
                  onCollapse={() => toggleCollapse(moduleName)}
                  permission={{
                    permissionId: moduleName,
                    name: moduleName,
                    httpMethod: 'GET',
                    apiPath: '',
                    module: moduleName,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    createdBy: 'system',
                  }}
                  onDelete={(permission) =>
                    setDeleteData({
                      type: 'module',
                      data: {
                        name: permission.name,
                        module: permission.module,
                      },
                    })
                  }
                  isModule
                >
                  {modulePermissions.map((permission) => (
                    <SortableTreeItem
                      key={permission.permissionId}
                      id={permission.permissionId}
                      permission={permission}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </SortableTreeItem>
              </SortableContext>
            )
          })}

          {/* Khu vực Permissions khác */}
          {(isDragging || permissions.some((p) => !p.module || p.module === 'none' || p.module === '')) && (
            <div className="mt-8">
              <DroppableArea>
                <SortableContext
                  items={permissions
                    .filter((p) => !p.module || p.module === 'none' || p.module === '')
                    .map((p) => p.permissionId)}
                >
                  <div className="grid gap-2 w-full">
                    {permissions
                      .filter((p) => !p.module || p.module === 'none' || p.module === '')
                      .map((permission) => (
                        <SortableTreeItem
                          key={permission.permissionId}
                          id={permission.permissionId}
                          permission={permission}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                  </div>
                </SortableContext>
              </DroppableArea>
            </div>
          )}
        </div>

        <CreateModuleDialog
          open={openCreateModule}
          onOpenChange={setOpenCreateModule}
        />

        <PermissionsFormDialog
          key={selectedPermission ? `perm-edit-${selectedPermission.permissionId}` : 'perm-add'}
          open={openCreatePermission}
          onOpenChange={(isOpen) => {
            setOpenCreatePermission(isOpen)
            if (!isOpen) setSelectedPermission(null)
          }}
          currentRow={selectedPermission}
        />

        {deleteData && (
          <PermissionsDeleteDialog
            open={!!deleteData}
            onOpenChange={(open) => !open && setDeleteData(null)}
            type={deleteData.type}
            data={deleteData.data}
          />
        )}

        {/* Hiển thị overlay khi kéo */}
        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
        >
          {activeId ? (
            <div className="rounded-md border bg-white dark:bg-zinc-800 px-4 py-3 shadow-xl scale-105 opacity-90 border-primary">
              <div className="font-medium text-primary">
                {permissions.find((p) => p.permissionId === activeId)?.name}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
