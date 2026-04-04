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
    queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(projectId, 1, 50) })
    queryClient.invalidateQueries({ queryKey: queryKeys.statuses.byProject(projectId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId, 1, 200) })
    queryClient.invalidateQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] })
    queryClient.invalidateQueries({ queryKey: ['task-schedules', 'task'] })
  }, [projectId, queryClient, workspaceId])

  const projectDestination = workspaceId && projectId ? `/public/workspaces/${workspaceId}/projects/${projectId}/events` : null

  useRealtimeSubscription(projectDestination, handleProjectMessage)
}
