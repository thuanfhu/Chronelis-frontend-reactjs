import { http, unwrapData } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type {
  ProjectAssistantApplyResponse,
  ProjectAssistantPlan,
  ProjectAssistantPreviewResponse,
  ProjectAssistantStatus,
} from '@/types/project-assistant'

interface ProjectAssistantPreviewPayload {
  prompt: string
}

interface ProjectAssistantApplyPayload {
  plan: ProjectAssistantPlan
  actionIds: string[]
}

export const projectAssistantApi = {
  async status() {
    const response = await http.get<ApiResponse<ProjectAssistantStatus>>('/project-assistant/status')
    return unwrapData(response.data)
  },

  async preview(projectId: number, payload: ProjectAssistantPreviewPayload) {
    const response = await http.post<ApiResponse<ProjectAssistantPreviewResponse>>(
      `/project-assistant/projects/${projectId}/preview`,
      payload,
    )
    return unwrapData(response.data)
  },

  async apply(projectId: number, payload: ProjectAssistantApplyPayload) {
    const response = await http.post<ApiResponse<ProjectAssistantApplyResponse>>(
      `/project-assistant/projects/${projectId}/apply`,
      payload,
    )
    return unwrapData(response.data)
  },
}