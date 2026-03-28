import { http, unwrapData, unwrapPagination } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { PageResult, Workspace, WorkspaceMember, WorkspaceMemberRoleType } from '@/types/domain'

export interface WorkspacePayload {
  name: string
}

export interface AddWorkspaceMemberPayload {
  userId: string
  role: WorkspaceMemberRoleType
}

export interface PageQuery {
  page?: number
  size?: number
}

export const workspaceApi = {
  async list(query: PageQuery) {
    const response = await http.get<ApiResponse<unknown>>('/workspaces', { params: query })
    return unwrapPagination<Workspace>(response.data) as PageResult<Workspace>
  },

  async detail(workspaceId: number) {
    const response = await http.get<ApiResponse<Workspace>>(`/workspaces/${workspaceId}`)
    return unwrapData(response.data)
  },

  async create(payload: WorkspacePayload) {
    const response = await http.post<ApiResponse<Workspace>>('/workspaces', payload)
    return unwrapData(response.data)
  },

  async update(workspaceId: number, payload: WorkspacePayload) {
    const response = await http.patch<ApiResponse<Workspace>>(`/workspaces/${workspaceId}`, payload)
    return unwrapData(response.data)
  },

  async members(workspaceId: number) {
    const response = await http.get<ApiResponse<WorkspaceMember[]>>(`/workspaces/${workspaceId}/members`)
    return unwrapData(response.data)
  },

  async addMember(workspaceId: number, payload: AddWorkspaceMemberPayload) {
    const response = await http.post<ApiResponse<WorkspaceMember>>(`/workspaces/${workspaceId}/members`, payload)
    return unwrapData(response.data)
  },

  async updateMemberRole(workspaceId: number, userId: string, role: WorkspaceMemberRoleType) {
    const response = await http.patch<ApiResponse<WorkspaceMember>>(`/workspaces/${workspaceId}/members/${userId}/role`, {
      role,
    })
    return unwrapData(response.data)
  },

  async removeMember(workspaceId: number, userId: string) {
    const response = await http.delete<ApiResponse<void>>(`/workspaces/${workspaceId}/members/${userId}`)
    return unwrapData(response.data)
  },
}
