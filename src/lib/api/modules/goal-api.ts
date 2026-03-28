import { http, unwrapData, unwrapPagination } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { Goal, GoalStatusType, GoalType, PageResult } from '@/types/domain'

interface PageQuery {
  page?: number
  size?: number
}

export interface CreateGoalPayload {
  projectId: number
  title: string
  goalType: GoalType
  status?: GoalStatusType
  progressPercent?: number
}

export interface UpdateGoalPayload {
  title?: string
  goalType?: GoalType
  status?: GoalStatusType
  progressPercent?: number
}

export const goalApi = {
  async create(payload: CreateGoalPayload) {
    const response = await http.post<ApiResponse<Goal>>('/goals', payload)
    return unwrapData(response.data)
  },

  async update(goalId: number, payload: UpdateGoalPayload) {
    const response = await http.patch<ApiResponse<Goal>>(`/goals/${goalId}`, payload)
    return unwrapData(response.data)
  },

  async detail(goalId: number) {
    const response = await http.get<ApiResponse<Goal>>(`/goals/${goalId}`)
    return unwrapData(response.data)
  },

  async listByProject(projectId: number, query: PageQuery) {
    const response = await http.get<ApiResponse<unknown>>(`/goals/project/${projectId}`, { params: query })
    return unwrapPagination<Goal>(response.data) as PageResult<Goal>
  },

  async remove(goalId: number) {
    const response = await http.delete<ApiResponse<void>>(`/goals/${goalId}`)
    return unwrapData(response.data)
  },
}
