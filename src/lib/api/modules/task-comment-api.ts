import { http, unwrapData } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { TaskComment } from '@/types/domain'

export const taskCommentApi = {
  async add(taskId: number, content: string) {
    const response = await http.post<ApiResponse<TaskComment>>('/task-comments', { taskId, content })
    return unwrapData(response.data)
  },

  async update(commentId: number, content: string) {
    const response = await http.patch<ApiResponse<TaskComment>>(`/task-comments/${commentId}`, { content })
    return unwrapData(response.data)
  },

  async remove(commentId: number) {
    const response = await http.delete<ApiResponse<void>>(`/task-comments/${commentId}`)
    return unwrapData(response.data)
  },

  async listByTask(taskId: number) {
    const response = await http.get<ApiResponse<TaskComment[]>>(`/task-comments/task/${taskId}`)
    return unwrapData(response.data)
  },
}
