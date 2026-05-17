import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Permission } from '../data/schema'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  searchQuery: string
  setSearchQuery: (query: string) => void
  collapsedModules: Record<string, boolean>
  setCollapsedModules: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  expandAll: () => void
  collapseAll: () => void
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)

interface Props {
  children: React.ReactNode
}

export default function PermissionsProvider({ children }: Props) {
  const queryClient = useQueryClient()
  const [selectedModule, setSelectedModule] = useState<string | null>(null)
  const [open, setOpen] = useState<PermissionsDialogType | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentRow, setCurrentRow] = useState<Permission | null>(null)

  const {
    data: permissionsData,
    isLoading,
  } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: async () => {
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
      })).sort((a, b) => a.name.localeCompare(b.name))

      // Extract unique modules
      const uniqueModules = Array.from(
        new Set(mapped.map((p) => p.module).filter(Boolean))
      ).sort() as string[]

      return { permissions: mapped, modules: uniqueModules }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  const permissions = permissionsData?.permissions || []
  const modules = permissionsData?.modules || []

  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({})

  React.useEffect(() => {
    setCollapsedModules((prev) => {
      const newState = { ...prev }
      let hasChanges = false
      modules.forEach((moduleName) => {
        if (newState[moduleName] === undefined) {
          newState[moduleName] = true // Mặc định đóng
          hasChanges = true
        }
      })
      return hasChanges ? newState : prev
    })
  }, [modules])

  const expandAll = useCallback(() => {
    setCollapsedModules((prev) => {
      const newState = { ...prev }
      modules.forEach((moduleName) => {
        newState[moduleName] = false
      })
      return newState
    })
  }, [modules])

  const collapseAll = useCallback(() => {
    setCollapsedModules((prev) => {
      const newState = { ...prev }
      modules.forEach((moduleName) => {
        newState[moduleName] = true
      })
      return newState
    })
  }, [modules])

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-permissions'] })
  }, [queryClient])

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
        searchQuery,
        setSearchQuery,
        collapsedModules,
        setCollapsedModules,
        expandAll,
        collapseAll,
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
