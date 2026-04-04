import { http, unwrapData, unwrapPagination, unwrapVoid } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { PageResult, SourceViewType, Task, TaskPriorityType } from '@/types/domain'

interface PageQuery {
  page?: number
  size?: number
}

export interface CreateTaskPayload {
  projectId: number
  goalId?: number
  statusId: number
  title: string
  description?: string
  priority: TaskPriorityType
  assigneeId?: string
  dueDate?: string
  estimatedMinutes?: number
  boardPosition?: number
  taskTypeId?: number
  sourceView?: SourceViewType
}

export interface UpdateTaskPayload {
  title?: string
  description?: string
  goalId?: number
  priority?: TaskPriorityType
  dueDate?: string
  estimatedMinutes?: number
  taskTypeId?: number
}

export const taskApi = {
  async create(payload: CreateTaskPayload) {
    const response = await http.post<ApiResponse<Task>>('/tasks', payload)
    return unwrapData(response.data)
  },

  async update(taskId: number, payload: UpdateTaskPayload) {
    const response = await http.patch<ApiResponse<Task>>(`/tasks/${taskId}`, payload)
    return unwrapData(response.data)
  },

  async detail(taskId: number) {
    const response = await http.get<ApiResponse<Task>>(`/tasks/${taskId}`)
    return unwrapData(response.data)
  },

  async listByProject(projectId: number, query: PageQuery) {
    const response = await http.get<ApiResponse<unknown>>(`/tasks/project/${projectId}`, { params: query })
    return unwrapPagination<Task>(response.data) as PageResult<Task>
  },

  async listByGoal(goalId: number, query: PageQuery) {
    const response = await http.get<ApiResponse<unknown>>(`/tasks/goal/${goalId}`, { params: query })
    return unwrapPagination<Task>(response.data) as PageResult<Task>
  },

  async move(taskId: number, statusId: number, targetPosition?: number) {
    const response = await http.patch<ApiResponse<Task>>(`/tasks/${taskId}/move`, {
      statusId,
      targetPosition,
    })
    return unwrapData(response.data)
  },

  async reorder(taskId: number, targetPosition: number) {
    const response = await http.patch<ApiResponse<Task>>(`/tasks/${taskId}/reorder`, {
      targetPosition,
    })
    return unwrapData(response.data)
  },

  async assign(taskId: number, assigneeId?: string) {
    const response = await http.patch<ApiResponse<Task>>(`/tasks/${taskId}/assignee`, {
      assigneeId,
    })
    return unwrapData(response.data)
  },

  async updateCompletion(taskId: number, isCompleted: boolean) {
    const response = await http.patch<ApiResponse<Task>>(`/tasks/${taskId}/completion`, {
      isCompleted,
    })
    return unwrapData(response.data)
  },

  async remove(taskId: number) {
    const response = await http.delete<ApiResponse<void>>(`/tasks/${taskId}`)
    return unwrapVoid(response.data)
  },
}
