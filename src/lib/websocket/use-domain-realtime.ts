import { useCallback } from 'react'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/query-keys'
import {
  dedupeSchedulesById,
  patchProjectTaskQueries,
  patchTaskScheduleQueries,
  removeById,
  removeMatchingOptimisticSchedules,
  upsertById,
} from '@/lib/tasks/optimistic-task-cache'
import { useRealtimeSubscription } from '@/lib/websocket/use-realtime'
import type { PageResult, RealtimeEvent, Task, TaskSchedule } from '@/types/domain'

type SchedulePage = PageResult<TaskSchedule>

function tryParseRealtimeEvent(rawBody: string): RealtimeEvent | null {
  try {
    const parsed = JSON.parse(rawBody) as RealtimeEvent
    return typeof parsed?.eventType === 'string' ? parsed : null
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTaskSchedule(value: unknown): value is TaskSchedule {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.taskId === 'number' &&
    typeof value.scheduledStart === 'string' &&
    typeof value.scheduledEnd === 'string' &&
    typeof value.scheduledDate === 'string'
  )
}

function isTask(value: unknown): value is Task {
  return isRecord(value) && typeof value.id === 'number' && typeof value.projectId === 'number'
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function getCalendarRangeFromQueryKey(queryKey: QueryKey): { fromDate: string; toDate: string } | null {
  const parts = Array.isArray(queryKey) ? queryKey : []
  const fromDate = parts[4]
  const toDate = parts[5]
  if (typeof fromDate !== 'string' || typeof toDate !== 'string') {
    return null
  }

  return { fromDate, toDate }
}

function isScheduleInRange(schedule: TaskSchedule, fromDate: string, toDate: string): boolean {
  return schedule.scheduledDate >= fromDate && schedule.scheduledDate <= toDate
}

function warnDuplicateScheduleIds(schedules: TaskSchedule[], source: string) {
  if (!import.meta.env.DEV) {
    return
  }

  const seen = new Set<number>()
  const duplicates = new Set<number>()
  for (const schedule of schedules) {
    if (seen.has(schedule.id)) {
      duplicates.add(schedule.id)
      continue
    }
    seen.add(schedule.id)
  }

  if (duplicates.size > 0) {
    console.warn(`[Chronelis realtime] duplicate scheduleId after ${source}`, [...duplicates])
  }
}

function patchProjectCalendarQueriesByRange(
  queryClient: QueryClient,
  projectId: number,
  updater: (schedules: TaskSchedule[], range: { fromDate: string; toDate: string } | null) => TaskSchedule[],
  source: string,
) {
  const queries = queryClient.getQueriesData<SchedulePage>({
    queryKey: ['task-schedules', 'calendar', 'project', projectId],
  })

  for (const [queryKey, data] of queries) {
    if (!data) {
      continue
    }

    const nextContent = dedupeSchedulesById(updater(data.content, getCalendarRangeFromQueryKey(queryKey)))
    warnDuplicateScheduleIds(nextContent, source)
    queryClient.setQueryData<SchedulePage>(queryKey, {
      ...data,
      content: nextContent,
    })
  }
}

function removeScheduleFromAllTaskScheduleQueries(queryClient: QueryClient, scheduleId: number) {
  queryClient.setQueriesData<TaskSchedule[]>({ queryKey: ['task-schedules', 'task'] }, (oldData) => {
    if (!oldData) return oldData
    return removeById(oldData, scheduleId)
  })
}

export function useWorkspaceRealtime(workspaceId: number | null) {
  const queryClient = useQueryClient()

  const handleMessage = useCallback(() => {
    if (!workspaceId) {
      return
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) })
    queryClient.invalidateQueries({ queryKey: ['projects', 'workspace', workspaceId] })
  }, [queryClient, workspaceId])

  const destination = workspaceId ? `/public/workspaces/${workspaceId}/events` : null
  useRealtimeSubscription(destination, handleMessage)
}

export function useProjectRealtime(workspaceId: number | null, projectId: number | null) {
  const queryClient = useQueryClient()

  const handleProjectMessage = useCallback((rawBody: string) => {
    if (!workspaceId || !projectId) {
      return
    }

    const event = tryParseRealtimeEvent(rawBody)
    if (event?.eventType === 'task-schedule.created' && isTaskSchedule(event.data)) {
      const schedule = event.data
      patchProjectCalendarQueriesByRange(
        queryClient,
        projectId,
        (schedules, range) => {
          if (range && !isScheduleInRange(schedule, range.fromDate, range.toDate)) {
            return removeById(schedules, schedule.id)
          }

          return upsertById(removeMatchingOptimisticSchedules(schedules, schedule), schedule)
        },
        event.eventType,
      )
      patchTaskScheduleQueries(queryClient, schedule.taskId, (schedules) =>
        upsertById(removeMatchingOptimisticSchedules(schedules, schedule), schedule),
      )
      return
    }

    if (event?.eventType === 'task-schedule.updated' && isTaskSchedule(event.data)) {
      const schedule = event.data
      patchProjectCalendarQueriesByRange(
        queryClient,
        projectId,
        (schedules, range) => {
          if (range && !isScheduleInRange(schedule, range.fromDate, range.toDate)) {
            return removeById(schedules, schedule.id)
          }

          return upsertById(removeMatchingOptimisticSchedules(schedules, schedule), schedule)
        },
        event.eventType,
      )
      patchTaskScheduleQueries(queryClient, schedule.taskId, (schedules) =>
        upsertById(removeMatchingOptimisticSchedules(schedules, schedule), schedule),
      )
      return
    }

    if (event?.eventType === 'task-schedule.deleted') {
      const scheduleId = toPositiveNumber(event.data)
      if (scheduleId != null) {
        patchProjectCalendarQueriesByRange(
          queryClient,
          projectId,
          (schedules) => removeById(schedules, scheduleId),
          event.eventType,
        )
        removeScheduleFromAllTaskScheduleQueries(queryClient, scheduleId)
      }
      return
    }

    if (event?.eventType === 'task.deleted') {
      const taskId = toPositiveNumber(event.data)
      if (taskId != null) {
        patchProjectTaskQueries(queryClient, projectId, (tasks) => tasks.filter((task) => task.id !== taskId))
        patchProjectCalendarQueriesByRange(
          queryClient,
          projectId,
          (schedules) => schedules.filter((schedule) => schedule.taskId !== taskId),
          event.eventType,
        )
        queryClient.setQueriesData<TaskSchedule[]>({ queryKey: ['task-schedules', 'task', taskId] }, () => [])
      }
      return
    } else if (event?.eventType.startsWith('task.') && isTask(event.data)) {
      const task = event.data
      queryClient.setQueryData(queryKeys.tasks.detail(task.id), task)
      patchProjectTaskQueries(queryClient, projectId, (tasks) => upsertById(tasks, task))
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

  const projectDestination =
    workspaceId && projectId ? `/public/workspaces/${workspaceId}/projects/${projectId}/events` : null
  const privateProjectDestination =
    workspaceId && projectId ? `/client/private/workspaces/${workspaceId}/projects/${projectId}/events` : null

  useRealtimeSubscription(projectDestination, handleProjectMessage)
  useRealtimeSubscription(privateProjectDestination, handleProjectMessage)
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

  const taskDestination =
    workspaceId && projectId && taskId
      ? `/public/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/events`
      : null
  const privateTaskDestination =
    workspaceId && projectId && taskId
      ? `/client/private/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/events`
      : null

  useRealtimeSubscription(taskDestination, handleTaskMessage)
  useRealtimeSubscription(privateTaskDestination, handleTaskMessage)
}
