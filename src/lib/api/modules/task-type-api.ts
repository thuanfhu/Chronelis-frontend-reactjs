import { http, unwrapData, unwrapVoid } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { TaskType } from '@/types/domain'

export interface CreateTaskTypePayload {
  workspaceId: number
  projectId: number
  goalId?: number
  name: string
  description?: string
  color?: string
  icon?: string
}

export interface UpdateTaskTypePayload {
  name?: string
  description?: string
  goalId?: number
  clearGoal?: boolean
  color?: string
  icon?: string
}

export const taskTypeApi = {
  async create(payload: CreateTaskTypePayload) {
    const response = await http.post<ApiResponse<TaskType>>('/task-types', payload)
    return unwrapData(response.data)
  },

  async update(taskTypeId: number, payload: UpdateTaskTypePayload) {
    const response = await http.patch<ApiResponse<TaskType>>(`/task-types/${taskTypeId}`, payload)
    return unwrapData(response.data)
  },

  async detail(taskTypeId: number) {
    const response = await http.get<ApiResponse<TaskType>>(`/task-types/${taskTypeId}`)
    return unwrapData(response.data)
  },

  async listByProject(projectId: number) {
    const response = await http.get<ApiResponse<TaskType[]>>(`/task-types/project/${projectId}`)
    return unwrapData(response.data)
  },

  async remove(taskTypeId: number) {
    const response = await http.delete<ApiResponse<void>>(`/task-types/${taskTypeId}`)
    return unwrapVoid(response.data)
  },
}
