import { http, unwrapData } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'

export interface PomodoroSession {
  id: number
  taskId: number
  user: {
    userId: string
    email: string
    firstName: string
    lastName: string
  }
  durationMinutes: number
  startedAt?: string
  endedAt?: string
  createdAt: string
}

export interface SavePomodoroSessionPayload {
  durationMinutes: number
  startedAt?: string
  endedAt?: string
}

export const pomodoroApi = {
  async saveSession(taskId: number, payload: SavePomodoroSessionPayload) {
    const response = await http.post<ApiResponse<PomodoroSession>>(`/pomodoro/tasks/${taskId}`, payload)
    return unwrapData(response.data)
  },

  async getSessions(taskId: number) {
    const response = await http.get<ApiResponse<PomodoroSession[]>>(`/pomodoro/tasks/${taskId}`)
    return unwrapData(response.data)
  },
}
