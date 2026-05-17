import React, { useState, useCallback } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import type { User } from '../data/schema'
import { createContext, useContext } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminUserApi } from '@/lib/api/modules/admin-user-api'

type UsersDialogType = 'invite' | 'add' | 'edit' | 'delete' | 'view'

interface UsersContextType {
  users: User[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  createUser: (data: any) => Promise<void>
  updateUser: (id: string, data: any) => Promise<void>
  deleteUser: (id: string) => Promise<void>
  open: UsersDialogType | null
  setOpen: (type: UsersDialogType | null) => void
  currentRow: User | null
  setCurrentRow: (user: User | null) => void
}

const UsersContext = createContext<UsersContextType | undefined>(undefined)

interface Props {
  children: React.ReactNode
}

export const UsersProvider = ({ children }: Props) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useDialogState<UsersDialogType>(null)
  const [currentRow, setCurrentRow] = useState<User | null>(null)

  const {
    data: users = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const result = await adminUserApi.list({ page: 1, size: 200 })
      // Map AdminUser -> User shape
      return (result.content || []).map((u: any): User => ({
        userId: u.userId,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        nickname: u.nickname,
        phoneNumber: u.phoneNumber,
        avatar: u.avatarUrl || u.avatar,
        avatarUrl: u.avatarUrl,
        birthDate: u.birthDate,
        gender: u.gender,
        nationality: u.nationality,
        isVerified: u.isVerified ?? false,
        roles: (u.roles || []).map((r: any) => ({
          roleId: r.roleId,
          id: r.roleId,
          name: r.name,
          description: r.description || '',
          active: r.active ?? true,
          permissions: r.permissions || [],
        })),
        createdAt: u.createdAt || new Date().toISOString(),
        provider: u.provider,
      })) as User[]
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const { email, firstName, lastName, isVerified, roleIds, phoneNumber, nickname, avatar, nationality } = userData
      return adminUserApi.update('new-user', {
        email,
        firstName,
        lastName,
        isVerified,
        roleIds,
        phoneNumber,
        nickname,
        avatarUrl: avatar,
        nationality,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Tạo người dùng thành công')
      setOpen(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Lỗi khi tạo người dùng')
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const payload: any = {}
      if (data.firstName !== undefined) payload.firstName = data.firstName
      if (data.lastName !== undefined) payload.lastName = data.lastName
      if (data.email !== undefined) payload.email = data.email
      if (data.phoneNumber !== undefined) payload.phoneNumber = data.phoneNumber
      if (data.nickname !== undefined) payload.nickname = data.nickname
      if (data.avatar !== undefined) payload.avatarUrl = data.avatar
      if (data.nationality !== undefined) payload.nationality = data.nationality
      if (data.isVerified !== undefined) payload.isVerified = data.isVerified
      if (data.roleIds !== undefined) payload.roleIds = data.roleIds
      return adminUserApi.update(id, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Cập nhật thông tin người dùng thành công')
      setOpen(null)
      setCurrentRow(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Lỗi khi cập nhật người dùng')
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return adminUserApi.remove(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Xóa người dùng thành công')
      setOpen(null)
      setCurrentRow(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Lỗi khi xóa người dùng')
    },
  })

  const createUser = useCallback(
    async (data: any) => {
      await createUserMutation.mutateAsync(data)
    },
    [createUserMutation]
  )

  const updateUser = useCallback(
    async (id: string, data: any) => {
      await updateUserMutation.mutateAsync({ id, data })
    },
    [updateUserMutation]
  )

  const deleteUser = useCallback(
    async (id: string) => {
      await deleteUserMutation.mutateAsync(id)
    },
    [deleteUserMutation]
  )

  return (
    <UsersContext.Provider
      value={{
        users,
        isLoading,
        error: error as string | null,
        refetch,
        createUser,
        updateUser,
        deleteUser,
        open,
        setOpen,
        currentRow,
        setCurrentRow,
      }}
    >
      {children}
    </UsersContext.Provider>
  )
}

export function useUsers() {
  const context = useContext(UsersContext)
  if (context === undefined) {
    throw new Error('useUsers must be used within a UsersProvider')
  }
  return context
}
