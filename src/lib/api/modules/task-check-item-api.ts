import { http, unwrapData } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { TaskCheckItem } from '@/types/domain'

export interface CreateCheckItemPayload {
  taskId: number
  title: string
}

export interface UpdateCheckItemPayload {
  title?: string
  isChecked?: boolean
}

export interface ReorderCheckItemsPayload {
  taskId: number
  itemIdsInOrder: number[]
}

export const taskCheckItemApi = {
  async create(payload: CreateCheckItemPayload) {
    const response = await http.post<ApiResponse<TaskCheckItem>>('/task-check-items', payload)
    return unwrapData(response.data)
  },

  async update(checkItemId: number, payload: UpdateCheckItemPayload) {
    const response = await http.patch<ApiResponse<TaskCheckItem>>(`/task-check-items/${checkItemId}`, payload)
    return unwrapData(response.data)
  },

  async toggle(checkItemId: number) {
    const response = await http.patch<ApiResponse<TaskCheckItem>>(`/task-check-items/${checkItemId}/toggle`)
    return unwrapData(response.data)
  },

  async remove(checkItemId: number) {
    const response = await http.delete<ApiResponse<void>>(`/task-check-items/${checkItemId}`)
    return unwrapData(response.data)
  },

  async listByTask(taskId: number) {
    const response = await http.get<ApiResponse<TaskCheckItem[]>>(`/task-check-items/task/${taskId}`)
    return unwrapData(response.data)
  },

  async reorder(payload: ReorderCheckItemsPayload) {
    const response = await http.patch<ApiResponse<void>>('/task-check-items/reorder', payload)
    return unwrapData(response.data)
  },
}
