import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/query-keys'
import { useRealtimeSubscription } from '@/lib/websocket/use-realtime'

export function useWorkspaceRealtime(workspaceId: number | null) {
  const queryClient = useQueryClient()

  const handleMessage = useCallback(
    () => {
      if (!workspaceId) {
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) })
      queryClient.invalidateQueries({ queryKey: ['projects', 'workspace', workspaceId] })
    },
    [queryClient, workspaceId],
  )

  const destination = workspaceId ? `/public/workspaces/${workspaceId}/events` : null
  useRealtimeSubscription(destination, handleMessage)
}

export function useProjectRealtime(workspaceId: number | null, projectId: number | null) {
  const queryClient = useQueryClient()

  const handleProjectMessage = useCallback(() => {
    if (!workspaceId || !projectId) {
      return
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) })
    queryClient.invalidateQueries({ queryKey: ['goals', projectId] })
    queryClient.invalidateQueries({ queryKey: queryKeys.statuses.byProject(projectId) })
    queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] })
    queryClient.invalidateQueries({ queryKey: ['tasks', 'detail'] })
    queryClient.invalidateQueries({ queryKey: ['task-comments'] })
    queryClient.invalidateQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] })
    queryClient.invalidateQueries({ queryKey: ['task-schedules', 'task'] })
  }, [projectId, queryClient, workspaceId])

  const projectDestination = workspaceId && projectId ? `/public/workspaces/${workspaceId}/projects/${projectId}/events` : null

  useRealtimeSubscription(projectDestination, handleProjectMessage)
}

export function useTaskRealtime(workspaceId: number | null, projectId: number | null, taskId: number | null) {
  const queryClient = useQueryClient()

  const handleTaskMessage = useCallback(() => {
    if (!workspaceId || !projectId || !taskId) {
      return
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.comments.byTask(taskId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTask(taskId) })
    queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] })
    queryClient.invalidateQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] })
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
  }, [projectId, queryClient, taskId, workspaceId])

  const taskDestination = workspaceId && projectId && taskId
    ? `/public/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/events`
    : null

  useRealtimeSubscription(taskDestination, handleTaskMessage)
}
