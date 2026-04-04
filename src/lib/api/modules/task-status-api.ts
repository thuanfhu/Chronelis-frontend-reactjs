import { http, unwrapData, unwrapVoid } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { TaskStatus } from '@/types/domain'

export interface CreateTaskStatusPayload {
  projectId: number
  name: string
  code: string
  position?: number
  isClosed?: boolean
}

export interface UpdateTaskStatusPayload {
  name?: string
  code?: string
  position?: number
  isClosed?: boolean
}

export const taskStatusApi = {
  async create(payload: CreateTaskStatusPayload) {
    const response = await http.post<ApiResponse<TaskStatus>>('/task-statuses', payload)
    return unwrapData(response.data)
  },

  async listByProject(projectId: number) {
    const response = await http.get<ApiResponse<TaskStatus[]>>(`/task-statuses/project/${projectId}`)
    return unwrapData(response.data)
  },

  async update(statusId: number, payload: UpdateTaskStatusPayload) {
    const response = await http.patch<ApiResponse<TaskStatus>>(`/task-statuses/${statusId}`, payload)
    return unwrapData(response.data)
  },

  async reorder(projectId: number, statusIdsInOrder: number[]) {
    const response = await http.patch<ApiResponse<TaskStatus[]>>(`/task-statuses/project/${projectId}/reorder`, {
      statusIdsInOrder,
    })
    return unwrapData(response.data)
  },

  async remove(statusId: number) {
    const response = await http.delete<ApiResponse<void>>(`/task-statuses/${statusId}`)
    return unwrapVoid(response.data)
  },
}
