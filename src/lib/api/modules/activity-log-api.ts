import { http, unwrapPagination } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { ActivityActionType, ActivityLog, ActivityTargetType, PageResult } from '@/types/domain'

interface PageQuery {
  page?: number
  size?: number
}

export interface ActivityFilter extends PageQuery {
  actorId?: string
  actionType?: ActivityActionType
  targetType?: ActivityTargetType
  fromDateTime?: string
  toDateTime?: string
}

export const activityLogApi = {
  async listByWorkspace(workspaceId: number, filter: ActivityFilter) {
    const response = await http.get<ApiResponse<unknown>>(`/activity-logs/workspace/${workspaceId}`, {
      params: filter,
    })
    return unwrapPagination<ActivityLog>(response.data) as PageResult<ActivityLog>
  },
}
