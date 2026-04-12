import { http, unwrapData, unwrapPagination, unwrapVoid } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { AdminPermission, PagedQueryParams, PagedResult } from '@/lib/api/modules/admin-types'

export interface CreatePermissionPayload {
  name: string
  apiPath: string
  httpMethod: string
  module?: string
}

export interface UpdatePermissionPayload {
  name?: string
  apiPath?: string
  httpMethod?: string
  module?: string | null
}

export interface CreateModulePayload {
  moduleName: string
  permissionIds: string[]
}

export const adminPermissionApi = {
  async list(params: PagedQueryParams = {}) {
    const response = await http.get<ApiResponse<unknown>>('/permissions', {
      params: {
        page: params.page ?? 1,
        size: params.size ?? 200,
      },
    })

    return unwrapPagination<AdminPermission>(response.data) as PagedResult<AdminPermission>
  },

  async getById(permissionId: string) {
    const response = await http.get<ApiResponse<AdminPermission>>(`/permissions/${permissionId}`)
    return unwrapData(response.data)
  },

  async create(payload: CreatePermissionPayload) {
    const response = await http.post<ApiResponse<AdminPermission>>('/permissions', payload)
    return unwrapData(response.data)
  },

  async update(permissionId: string, payload: UpdatePermissionPayload) {
    const response = await http.patch<ApiResponse<AdminPermission>>(`/permissions/${permissionId}`, payload)
    return unwrapData(response.data)
  },

  async remove(permissionId: string) {
    const response = await http.delete<ApiResponse<void>>(`/permissions/${permissionId}`)
    return unwrapVoid(response.data)
  },

  async listModules() {
    const response = await http.get<ApiResponse<string[]>>('/permissions/modules')
    return unwrapData(response.data)
  },

  async createModule(payload: CreateModulePayload) {
    const response = await http.post<ApiResponse<AdminPermission[]>>('/permissions/module', payload)
    return unwrapData(response.data)
  },

  async deleteModule(moduleName: string) {
    const response = await http.delete<ApiResponse<void>>(`/permissions/module/${encodeURIComponent(moduleName)}`)
    return unwrapVoid(response.data)
  },
}
