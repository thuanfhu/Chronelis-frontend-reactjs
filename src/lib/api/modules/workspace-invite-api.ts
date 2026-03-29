import { http, unwrapData } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { WorkspaceInvite, WorkspaceMemberRoleType } from '@/types/domain'

export interface CreateInvitePayload {
  workspaceId: number
  roleToAssign?: WorkspaceMemberRoleType
  maxUses?: number
  expiresAt?: string
}

export interface JoinByInvitePayload {
  inviteCode: string
}

export const workspaceInviteApi = {
  async create(payload: CreateInvitePayload) {
    const response = await http.post<ApiResponse<WorkspaceInvite>>('/workspace-invites', payload)
    return unwrapData(response.data)
  },

  async listActive(workspaceId: number) {
    const response = await http.get<ApiResponse<WorkspaceInvite[]>>(`/workspace-invites/workspace/${workspaceId}`)
    return unwrapData(response.data)
  },

  async revoke(inviteId: number) {
    const response = await http.patch<ApiResponse<void>>(`/workspace-invites/${inviteId}/revoke`)
    return unwrapData(response.data)
  },

  async validate(inviteCode: string) {
    const response = await http.get<ApiResponse<WorkspaceInvite>>(`/workspace-invites/validate/${inviteCode}`)
    return unwrapData(response.data)
  },

  async join(payload: JoinByInvitePayload) {
    const response = await http.post<ApiResponse<void>>('/workspace-invites/join', payload)
    return unwrapData(response.data)
  },
}
