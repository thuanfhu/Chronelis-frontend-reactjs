import { http, unwrapData, unwrapPagination, unwrapVoid } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { AdminUser, PagedQueryParams, PagedResult } from '@/lib/api/modules/admin-types'

export interface UpdateUserForAdminPayload {
  firstName?: string
  lastName?: string
  email?: string
  phoneNumber?: string
  nickname?: string
  avatarUrl?: string
  biography?: string
  city?: string
  nationality?: string
  isVerified?: boolean
  roleIds?: string[]
}

export interface DeleteRolesFromUserPayload {
  roleIds: string[]
}

export const adminUserApi = {
  async list(params: PagedQueryParams = {}) {
    const response = await http.get<ApiResponse<unknown>>('/users', {
      params: {
        page: params.page ?? 1,
        size: params.size ?? 200,
      },
    })

    return unwrapPagination<AdminUser>(response.data) as PagedResult<AdminUser>
  },

  async getById(userId: string) {
    const response = await http.get<ApiResponse<AdminUser>>(`/users/${userId}`)
    return unwrapData(response.data)
  },

  async update(userId: string, payload: UpdateUserForAdminPayload) {
    const response = await http.patch<ApiResponse<AdminUser>>(`/users/${userId}`, payload)
    return unwrapData(response.data)
  },

  async remove(userId: string) {
    const response = await http.delete<ApiResponse<void>>(`/users/${userId}`)
    return unwrapVoid(response.data)
  },

  async deleteRoles(userId: string, payload: DeleteRolesFromUserPayload) {
    const response = await http.delete<ApiResponse<void>>(`/users/${userId}/roles`, {
      data: payload,
    })

    return unwrapVoid(response.data)
  },
}
