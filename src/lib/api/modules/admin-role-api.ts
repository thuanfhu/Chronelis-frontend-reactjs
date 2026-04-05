import { http, unwrapData, unwrapPagination, unwrapVoid } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { AdminRole, PagedQueryParams, PagedResult } from '@/lib/api/modules/admin-types'

export interface CreateRolePayload {
  name: string
  description?: string
  active?: boolean
  permissionIds?: string[]
}

export interface UpdateRolePayload {
  name?: string
  description?: string
  active?: boolean
  permissionIds?: string[]
}

export interface DeletePermissionsFromRolePayload {
  permissionIds: string[]
}

export const adminRoleApi = {
  async list(params: PagedQueryParams = {}) {
    const response = await http.get<ApiResponse<unknown>>('/roles', {
      params: {
        page: params.page ?? 0,
        size: params.size ?? 200,
      },
    })

    return unwrapPagination<AdminRole>(response.data) as PagedResult<AdminRole>
  },

  async getById(roleId: string) {
    const response = await http.get<ApiResponse<AdminRole>>(`/roles/${roleId}`)
    return unwrapData(response.data)
  },

  async create(payload: CreateRolePayload) {
    const response = await http.post<ApiResponse<AdminRole>>('/roles', payload)
    return unwrapData(response.data)
  },

  async update(roleId: string, payload: UpdateRolePayload) {
    const response = await http.patch<ApiResponse<AdminRole>>(`/roles/${roleId}`, payload)
    return unwrapData(response.data)
  },

  async remove(roleId: string) {
    const response = await http.delete<ApiResponse<void>>(`/roles/${roleId}`)
    return unwrapVoid(response.data)
  },

  async deletePermissions(roleId: string, payload: DeletePermissionsFromRolePayload) {
    const response = await http.delete<ApiResponse<void>>(`/roles/${roleId}/permissions`, {
      data: payload,
    })

    return unwrapVoid(response.data)
  },
}
