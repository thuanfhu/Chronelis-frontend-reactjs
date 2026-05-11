import { http, unwrapData, unwrapPagination, unwrapVoid } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type {
  EffectiveProjectAccessRoleType,
  PageResult,
  Project,
  ProjectAccessRoleType,
  ProjectAccessSubjectType,
  ProjectStatusType,
  ProjectVisibilityType,
  UserSummary,
  WorkspaceTeam,
} from '@/types/domain'

interface ProjectPayload {
  name: string
  description?: string
  visibility?: ProjectVisibilityType
  managerUserId?: string
  managerTeamId?: number
}

interface CreateProjectPayload extends ProjectPayload {
  workspaceId: number
}

interface PageQuery {
  page?: number
  size?: number
}

export interface ProjectAccessPayload {
  subjectType: ProjectAccessSubjectType
  userId?: string
  teamId?: number
  role: ProjectAccessRoleType
}

export interface ProjectAccess {
  id: number
  projectId: number
  subjectType: ProjectAccessSubjectType
  user?: UserSummary
  team?: WorkspaceTeam
  role: ProjectAccessRoleType
  grantedBy: UserSummary
  createdAt: string
  updatedAt: string
}

export interface EffectiveProjectAccess {
  projectId: number
  workspaceId: number
  visibility: ProjectVisibilityType
  effectiveRole: EffectiveProjectAccessRoleType
  workspaceOwner: boolean
  canViewProject: boolean
  canContribute: boolean
  canManageProjectWork: boolean
  canManageProjectAccess: boolean
  canManageManagerAccess: boolean
  canChangeVisibility: boolean
  canDeleteProject: boolean
  canAssignOthers: boolean
  canComment: boolean
}

export const projectApi = {
  async create(payload: CreateProjectPayload) {
    const response = await http.post<ApiResponse<Project>>('/projects', payload)
    return unwrapData(response.data)
  },

  async update(projectId: number, payload: Partial<ProjectPayload>) {
    const response = await http.patch<ApiResponse<Project>>(`/projects/${projectId}`, payload)
    return unwrapData(response.data)
  },

  async updateStatus(projectId: number, status: ProjectStatusType) {
    const response = await http.patch<ApiResponse<Project>>(`/projects/${projectId}/status`, { status })
    return unwrapData(response.data)
  },

  async detail(projectId: number) {
    const response = await http.get<ApiResponse<Project>>(`/projects/${projectId}`)
    return unwrapData(response.data)
  },

  async listByWorkspace(workspaceId: number, query: PageQuery) {
    const response = await http.get<ApiResponse<unknown>>(`/projects/workspace/${workspaceId}`, { params: query })
    return unwrapPagination<Project>(response.data) as PageResult<Project>
  },

  async remove(projectId: number) {
    const response = await http.delete<ApiResponse<void>>(`/projects/${projectId}`)
    return unwrapVoid(response.data)
  },

  async effectiveAccess(projectId: number) {
    const response = await http.get<ApiResponse<EffectiveProjectAccess>>(`/projects/${projectId}/access/me`)
    return unwrapData(response.data)
  },

  async listAccess(projectId: number) {
    const response = await http.get<ApiResponse<ProjectAccess[]>>(`/projects/${projectId}/access`)
    return unwrapData(response.data)
  },

  async upsertAccess(projectId: number, payload: ProjectAccessPayload) {
    const response = await http.post<ApiResponse<ProjectAccess>>(`/projects/${projectId}/access`, payload)
    return unwrapData(response.data)
  },

  async updateAccess(projectId: number, accessId: number, role: ProjectAccessRoleType) {
    const response = await http.patch<ApiResponse<ProjectAccess>>(`/projects/${projectId}/access/${accessId}`, { role })
    return unwrapData(response.data)
  },

  async revokeAccess(projectId: number, accessId: number) {
    const response = await http.delete<ApiResponse<void>>(`/projects/${projectId}/access/${accessId}`)
    return unwrapVoid(response.data)
  },
}
