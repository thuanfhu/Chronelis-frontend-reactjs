import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { Permission } from '../data/schema'
import { adminPermissionApi } from '@/lib/api/modules/admin-permission-api'

type PermissionsDialogType = 'add' | 'edit' | 'delete'

interface PermissionsContextType {
  permissions: Permission[]
  modules: string[]
  isLoading: boolean
  refetch: () => void
  selectedModule: string | null
  setSelectedModule: (module: string | null) => void
  open: PermissionsDialogType | null
  setOpen: (type: PermissionsDialogType | null) => void
  currentRow: Permission | null
  setCurrentRow: (permission: Permission | null) => void
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)

interface Props {
  children: React.ReactNode
}

export default function PermissionsProvider({ children }: Props) {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [modules, setModules] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModule, setSelectedModule] = useState<string | null>(null)
  const [open, setOpen] = useState<PermissionsDialogType | null>(null)
  const [currentRow, setCurrentRow] = useState<Permission | null>(null)

  const fetchPermissions = useCallback(async () => {
    try {
      setIsLoading(true)
      const result = await adminPermissionApi.list({ page: 1, size: 500 })
      const mapped: Permission[] = (result.content || []).map((p: any) => ({
        permissionId: p.permissionId,
        name: p.name,
        apiPath: p.apiPath || '',
        httpMethod: p.httpMethod || 'GET',
        module: p.module || '',
        createdAt: p.createdAt || '',
        updatedAt: p.updatedAt || '',
        createdBy: p.createdBy || '',
      }))
      setPermissions(mapped)

      // Extract unique modules
      const uniqueModules = Array.from(
        new Set(mapped.map((p) => p.module).filter(Boolean))
      ).sort() as string[]
      setModules(uniqueModules)
    } catch (error) {
      console.error('Error fetching permissions:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  const refetch = useCallback(() => {
    fetchPermissions()
  }, [fetchPermissions])

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        modules,
        isLoading,
        refetch,
        selectedModule,
        setSelectedModule,
        open,
        setOpen,
        currentRow,
        setCurrentRow,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  const context = useContext(PermissionsContext)
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider')
  }
  return context
}
