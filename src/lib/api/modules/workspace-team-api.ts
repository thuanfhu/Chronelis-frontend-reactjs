import { http, unwrapData, unwrapVoid } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { WorkspaceTeam, WorkspaceTeamMember } from '@/types/domain'

export interface CreateTeamPayload {
  workspaceId: number
  name: string
  description?: string
}

export interface UpdateTeamPayload {
  name?: string
  description?: string
}

export interface AddTeamMemberPayload {
  userId: string
}

export const workspaceTeamApi = {
  async create(payload: CreateTeamPayload) {
    const response = await http.post<ApiResponse<WorkspaceTeam>>('/workspace-teams', payload)
    return unwrapData(response.data)
  },

  async update(teamId: number, payload: UpdateTeamPayload) {
    const response = await http.patch<ApiResponse<WorkspaceTeam>>(`/workspace-teams/${teamId}`, payload)
    return unwrapData(response.data)
  },

  async detail(teamId: number) {
    const response = await http.get<ApiResponse<WorkspaceTeam>>(`/workspace-teams/${teamId}`)
    return unwrapData(response.data)
  },

  async listByWorkspace(workspaceId: number) {
    const response = await http.get<ApiResponse<WorkspaceTeam[]>>(`/workspace-teams/workspace/${workspaceId}`)
    return unwrapData(response.data)
  },

  async remove(teamId: number) {
    const response = await http.delete<ApiResponse<void>>(`/workspace-teams/${teamId}`)
    return unwrapVoid(response.data)
  },

  async addMember(teamId: number, payload: AddTeamMemberPayload) {
    const response = await http.post<ApiResponse<WorkspaceTeamMember>>(`/workspace-teams/${teamId}/members`, payload)
    return unwrapData(response.data)
  },

  async removeMember(teamId: number, userId: string) {
    const response = await http.delete<ApiResponse<void>>(`/workspace-teams/${teamId}/members/${userId}`)
    return unwrapVoid(response.data)
  },

  async listMembers(teamId: number) {
    const response = await http.get<ApiResponse<WorkspaceTeamMember[]>>(`/workspace-teams/${teamId}/members`)
    return unwrapData(response.data)
  },
}
