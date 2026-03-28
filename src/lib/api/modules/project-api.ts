import { http, unwrapData, unwrapPagination } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { PageResult, Project, ProjectStatusType } from '@/types/domain'

interface ProjectPayload {
  name: string
  description?: string
}

interface CreateProjectPayload extends ProjectPayload {
  workspaceId: number
}

interface PageQuery {
  page?: number
  size?: number
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
}
