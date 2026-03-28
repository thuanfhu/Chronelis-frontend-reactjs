import { http, unwrapData, unwrapPagination } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { PageResult, TaskSchedule } from '@/types/domain'

interface PageQuery {
  page?: number
  size?: number
}

export interface TaskSchedulePayload {
  taskId: number
  scheduledStart: string
  scheduledEnd: string
}

export interface UpdateTaskSchedulePayload {
  scheduledStart: string
  scheduledEnd: string
}

export const taskScheduleApi = {
  async create(payload: TaskSchedulePayload) {
    const response = await http.post<ApiResponse<TaskSchedule>>('/task-schedules', payload)
    return unwrapData(response.data)
  },

  async update(scheduleId: number, payload: UpdateTaskSchedulePayload) {
    const response = await http.patch<ApiResponse<TaskSchedule>>(`/task-schedules/${scheduleId}`, payload)
    return unwrapData(response.data)
  },

  async remove(scheduleId: number) {
    const response = await http.delete<ApiResponse<void>>(`/task-schedules/${scheduleId}`)
    return unwrapData(response.data)
  },

  async listByTask(taskId: number) {
    const response = await http.get<ApiResponse<TaskSchedule[]>>(`/task-schedules/task/${taskId}`)
    return unwrapData(response.data)
  },

  async projectCalendar(projectId: number, fromDate: string, toDate: string, query: PageQuery) {
    const response = await http.get<ApiResponse<unknown>>(`/task-schedules/calendar/project/${projectId}`, {
      params: {
        fromDate,
        toDate,
        ...query,
      },
    })
    return unwrapPagination<TaskSchedule>(response.data) as PageResult<TaskSchedule>
  },

  async workspaceCalendar(workspaceId: number, fromDate: string, toDate: string, query: PageQuery) {
    const response = await http.get<ApiResponse<unknown>>(`/task-schedules/calendar/workspace/${workspaceId}`, {
      params: {
        fromDate,
        toDate,
        ...query,
      },
    })
    return unwrapPagination<TaskSchedule>(response.data) as PageResult<TaskSchedule>
  },
}
