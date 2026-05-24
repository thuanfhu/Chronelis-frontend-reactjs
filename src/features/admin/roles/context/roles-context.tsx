import React, { useState, useCallback } from 'react'
import type { Role } from '../data/schema'
import { createContext, useContext } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminRoleApi } from '@/lib/api/modules/admin-role-api'
import { useTranslation } from 'react-i18next'

type RolesDialogType = 'add' | 'edit' | 'delete'
type SetOpenType = (type: RolesDialogType | null) => void

interface RolesContextType {
  roles: Role[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  meta: {
    totalPages: number
    currentPage: number
    totalElements: number
  }
  fetchRoles: (page?: number) => Promise<void>
  createRole: (data: { name: string; description: string; active: boolean; permissionIds: string[] }) => Promise<void>
  updateRole: (
    roleId: string,
    data: {
      name?: string
      description?: string
      active?: boolean
      permissionIds?: string[]
    },
  ) => Promise<void>
  deleteRole: (roleId: string) => Promise<void>
  updateRolePermissions: (roleId: string, permissions: string[]) => Promise<void>
  removePermissions: (roleId: string, permissionIds: string[]) => Promise<void>
  open: RolesDialogType | null
  setOpen: SetOpenType
  currentRow: Role | null
  setCurrentRow: (role: Role | null) => void
  handleCloseDialog: () => void
}

const RolesContext = createContext<RolesContextType | undefined>(undefined)

interface Props {
  children: React.ReactNode
}

export default function RolesProvider({ children }: Props) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [open, setOpenState] = useState<RolesDialogType | null>(null)
  const setOpen: SetOpenType = useCallback((type) => {
    setOpenState(type)
  }, [])
  const [currentRow, setCurrentRow] = useState<Role | null>(null)

  const {
    data: rolesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const result = await adminRoleApi.list({ page: 1, size: 50 })
      const mappedRoles: Role[] = (result.content || []).map((r: any) => ({
        roleId: r.roleId,
        name: r.name,
        description: r.description || '',
        active: r.active ?? true,
        permissions: (r.permissions || []).map((p: any) => ({
          permissionId: p.permissionId,
          name: p.name,
          apiPath: p.apiPath || '',
          httpMethod: p.httpMethod || 'GET',
          module: p.module || '',
          createdAt: p.createdAt || '',
          updatedAt: p.updatedAt || '',
          createdBy: p.createdBy || '',
        })),
        createdAt: r.createdAt || '',
        updatedAt: r.updatedAt || '',
        createdBy: r.createdBy || '',
      }))
      const metaData = (result as any).meta
      return {
        roles: mappedRoles,
        meta: {
          totalPages: metaData?.totalPages || 1,
          currentPage: metaData?.currentPage || 1,
          totalElements: metaData?.totalElements || mappedRoles.length,
        },
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  const roles = rolesData?.roles || []
  const meta = rolesData?.meta || { totalPages: 1, currentPage: 1, totalElements: 0 }

  const fetchRoles = useCallback(
    async (_page: number = 1) => {
      await refetch()
    },
    [refetch],
  )

  const createRoleMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; active: boolean; permissionIds: string[] }) => {
      return adminRoleApi.create({
        name: data.name,
        description: data.description,
        active: data.active,
        permissionIds: data.permissionIds,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      toast.success(t('notification.roleCreateSuccess', 'Tạo vai trò thành công'))
      setOpen(null)
    },
    onError: (err: Error) => {
      toast.error(err.message || t('notification.roleCreateError', 'Lỗi khi tạo vai trò'))
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ roleId, data }: { roleId: string; data: any }) => {
      return adminRoleApi.update(roleId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      setOpen(null)
      setCurrentRow(null)
    },
    onError: (err: Error) => {
      toast.error(err.message || t('notification.roleUpdateError'))
    },
  })

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      return adminRoleApi.remove(roleId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      toast.success(t('notification.roleDeleteSuccess'))
      setOpen(null)
      setCurrentRow(null)
    },
    onError: (err: Error) => {
      toast.error(err.message || t('notification.roleDeleteError'))
    },
  })

  const createRole = useCallback(
    async (data: { name: string; description: string; active: boolean; permissionIds: string[] }) => {
      await createRoleMutation.mutateAsync(data)
    },
    [createRoleMutation],
  )

  const updateRole = useCallback(
    async (roleId: string, data: any) => {
      await updateRoleMutation.mutateAsync({ roleId, data })
    },
    [updateRoleMutation],
  )

  const deleteRole = useCallback(
    async (roleId: string) => {
      await deleteRoleMutation.mutateAsync(roleId)
    },
    [deleteRoleMutation],
  )

  const updateRolePermissions = useCallback(
    async (roleId: string, permissionIds: string[]) => {
      try {
        await adminRoleApi.update(roleId, { permissionIds })
        queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : t('notification.permissionUpdateError', 'Lỗi khi cập nhật quyền'),
        )
        throw err
      }
    },
    [queryClient, t],
  )

  const removePermissions = useCallback(
    async (roleId: string, permissionIds: string[]) => {
      try {
        await adminRoleApi.deletePermissions(roleId, { permissionIds })
        queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('notification.permissionRemoveError', 'Lỗi khi xóa quyền'))
        throw err
      }
    },
    [queryClient, t],
  )

  const handleCloseDialog = useCallback(() => {
    setOpen(null)
    setCurrentRow(null)
  }, [setOpen])

  return (
    <RolesContext.Provider
      value={{
        roles,
        isLoading,
        error: error as string | null,
        refetch,
        meta,
        fetchRoles,
        createRole,
        updateRole,
        deleteRole,
        updateRolePermissions,
        removePermissions,
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        handleCloseDialog,
      }}
    >
      {children}
    </RolesContext.Provider>
  )
}

export function useRoles() {
  const context = useContext(RolesContext)
  if (context === undefined) {
    throw new Error('useRoles must be used within a RolesProvider')
  }
  return context
}
