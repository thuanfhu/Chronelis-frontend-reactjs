import { http, unwrapData, unwrapPagination, unwrapVoid } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { Notification, NotificationUnreadCount, PageResult } from '@/types/domain'

interface PageQuery {
  page?: number
  size?: number
}

export const notificationApi = {
  async list(query: PageQuery) {
    const response = await http.get<ApiResponse<unknown>>('/notifications', { params: query })
    return unwrapPagination<Notification>(response.data) as PageResult<Notification>
  },

  async unreadCount() {
    const response = await http.get<ApiResponse<NotificationUnreadCount>>('/notifications/unread-count')
    return unwrapData(response.data)
  },

  async markOneAsRead(notificationId: number) {
    const response = await http.patch<ApiResponse<void>>(`/notifications/${notificationId}/read`)
    return unwrapVoid(response.data)
  },

  async markAllAsRead() {
    const response = await http.patch<ApiResponse<void>>('/notifications/read-all')
    return unwrapVoid(response.data)
  },
}
