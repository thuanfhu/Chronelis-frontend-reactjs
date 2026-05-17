import React, { useState, useCallback, useEffect } from 'react'
import type { Role } from '../data/schema'
import { createContext, useContext } from 'react'
import { toast } from 'sonner'
import { adminRoleApi } from '@/lib/api/modules/admin-role-api'

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
  createRole: (data: {
    name: string
    description: string
    active: boolean
    permissionIds: string[]
  }) => Promise<void>
  updateRole: (
    roleId: string,
    data: {
      name?: string
      description?: string
      active?: boolean
      permissionIds?: string[]
    }
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
  const [open, setOpenState] = useState<RolesDialogType | null>(null)
  const setOpen: SetOpenType = useCallback(
    (type) => {
      setOpenState(type)
    },
    []
  )
  const [currentRow, setCurrentRow] = useState<Role | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState({
    totalPages: 1,
    currentPage: 1,
    totalElements: 0,
  })

  const fetchRoles = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true)
      setError(null)
      const result = await adminRoleApi.list({ page, size: 50 })
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
      setRoles(mappedRoles)
      const metaData = (result as any).meta
      if (metaData) {
        setMeta({
          totalPages: metaData.totalPages || 1,
          currentPage: metaData.currentPage || page,
          totalElements: metaData.totalElements || mappedRoles.length,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi khi tải dữ liệu')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const refetch = useCallback(() => {
    fetchRoles(meta.currentPage)
  }, [fetchRoles, meta.currentPage])

  const createRole = useCallback(
    async (data: { name: string; description: string; active: boolean; permissionIds: string[] }) => {
      try {
        setIsLoading(true)
        await adminRoleApi.create({
          name: data.name,
          description: data.description,
          active: data.active,
          permissionIds: data.permissionIds,
        })
        setOpen(null)
        fetchRoles()
        toast.success('Tạo vai trò thành công')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Đã xảy ra lỗi khi tạo vai trò')
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [fetchRoles, setOpen]
  )

  const updateRole = useCallback(
    async (roleId: string, data: { name?: string; description?: string; active?: boolean; permissionIds?: string[] }) => {
      try {
        setIsLoading(true)
        await adminRoleApi.update(roleId, data)
        setOpen(null)
        setCurrentRow(null)
        fetchRoles()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Đã xảy ra lỗi khi cập nhật vai trò')
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [fetchRoles, setOpen]
  )

  const deleteRole = useCallback(
    async (roleId: string) => {
      try {
        setIsLoading(true)
        await adminRoleApi.remove(roleId)
        setOpen(null)
        setCurrentRow(null)
        fetchRoles()
        toast.success('Xóa vai trò thành công')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Đã xảy ra lỗi khi xóa vai trò')
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [fetchRoles, setOpen]
  )

  const updateRolePermissions = useCallback(
    async (roleId: string, permissionIds: string[]) => {
      try {
        setIsLoading(true)
        await adminRoleApi.update(roleId, { permissionIds })
        fetchRoles()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Đã xảy ra lỗi khi cập nhật quyền')
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [fetchRoles]
  )

  const removePermissions = useCallback(
    async (roleId: string, permissionIds: string[]) => {
      try {
        setIsLoading(true)
        await adminRoleApi.deletePermissions(roleId, { permissionIds })
        fetchRoles()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Đã xảy ra lỗi khi xóa quyền')
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [fetchRoles]
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
        error,
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
