import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { PageResult, Task, TaskSchedule, TaskStatus } from '@/types/domain'
import {
  clearRememberedTaskOpenStatus,
  getRememberedTaskOpenStatus,
  rememberTaskOpenStatus,
} from '@/lib/tasks/task-status-memory'

type TaskPage = PageResult<Task>
type SchedulePage = PageResult<TaskSchedule>

export type TaskProjectSnapshot = Array<[QueryKey, TaskPage | undefined]>
export type GoalTaskSnapshot = Array<[QueryKey, TaskPage | undefined]>
export type ProjectCalendarSnapshot = Array<[QueryKey, SchedulePage | undefined]>
export type TaskScheduleSnapshot = Array<[QueryKey, TaskSchedule[] | undefined]>

interface MoveTaskParams {
  taskId: number
  targetStatusId: number
  targetPosition?: number
  statuses: TaskStatus[]
}

interface ReorderTaskParams {
  taskId: number
  targetPosition: number
  statusId: number
}

interface CompletionParams {
  taskId: number
  isCompleted: boolean
  statuses: TaskStatus[]
}

interface ScheduleUpdateParams {
  scheduleId: number
  scheduledStart: string
  scheduledEnd: string
}

function sortByBoardPosition(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.boardPosition - b.boardPosition)
}

function cloneTask(task: Task): Task {
  return {
    ...task,
    status: { ...task.status },
    assignee: task.assignee ? { ...task.assignee } : undefined,
    createdBy: { ...task.createdBy },
    taskType: task.taskType ? { ...task.taskType } : undefined,
  }
}

function mapByStatus(tasks: Task[]): Map<number, Task[]> {
  const result = new Map<number, Task[]>()
  for (const task of sortByBoardPosition(tasks)) {
    if (!result.has(task.status.id)) {
      result.set(task.status.id, [])
    }
    result.get(task.status.id)!.push(cloneTask(task))
  }
  return result
}

function flattenStatusMap(statusMap: Map<number, Task[]>): Task[] {
  const flattened: Task[] = []
  for (const tasks of statusMap.values()) {
    flattened.push(...tasks)
  }
  return flattened
}

function reindexBoardPositions(tasks: Task[]): Task[] {
  return tasks.map((task, index) => ({
    ...task,
    boardPosition: index,
  }))
}

function resolveDefaultOpenStatus(statuses: TaskStatus[]): TaskStatus | null {
  const orderedOpenStatuses = [...statuses]
    .filter((status) => !Boolean(status.isClosed))
    .sort((left, right) => left.position - right.position)

  if (orderedOpenStatuses.length === 0) {
    return null
  }

  const preferred = orderedOpenStatuses.find((status) => {
    const code = status.code.toUpperCase()
    const name = status.name.toUpperCase()
    return code.includes('TODO') || code.includes('INBOX') || name.includes('TODO') || name.includes('INBOX')
  })

  return preferred ?? orderedOpenStatuses[0]
}

export function applyTaskMove(tasks: Task[], params: MoveTaskParams): Task[] {
  const statusMap = mapByStatus(tasks)
  const statusById = new Map(params.statuses.map((status) => [status.id, status]))

  let movingTask: Task | null = null
  let sourceStatusId: number | null = null

  for (const [statusId, list] of statusMap) {
    const index = list.findIndex((task) => task.id === params.taskId)
    if (index >= 0) {
      movingTask = list.splice(index, 1)[0]
      sourceStatusId = statusId
      statusMap.set(statusId, reindexBoardPositions(list))
      break
    }
  }

  if (!movingTask || sourceStatusId == null) {
    return tasks
  }

  const targetStatus = statusById.get(params.targetStatusId)
  const targetList = statusMap.get(params.targetStatusId) ?? []
  const insertIndex = Math.max(0, Math.min(params.targetPosition ?? targetList.length, targetList.length))

  const movedTask: Task = {
    ...movingTask,
    status: targetStatus
      ? { ...targetStatus }
      : movingTask.status,
    isCompleted: targetStatus ? Boolean(targetStatus.isClosed) : movingTask.isCompleted,
    completedAt: targetStatus
      ? (Boolean(targetStatus.isClosed)
          ? (movingTask.completedAt ?? new Date().toISOString())
          : undefined)
      : movingTask.completedAt,
  }

  if (targetStatus) {
    if (Boolean(targetStatus.isClosed)) {
      if (!Boolean(movingTask.status.isClosed)) {
        rememberTaskOpenStatus(movedTask.id, movingTask.status.id)
      }
    } else {
      rememberTaskOpenStatus(movedTask.id, targetStatus.id)
    }
  }

  targetList.splice(insertIndex, 0, movedTask)
  statusMap.set(params.targetStatusId, reindexBoardPositions(targetList))

  return flattenStatusMap(statusMap)
}

export function applyTaskReorder(tasks: Task[], params: ReorderTaskParams): Task[] {
  const statusMap = mapByStatus(tasks)
  const list = statusMap.get(params.statusId)
  if (!list || list.length <= 1) {
    return tasks
  }

  const fromIndex = list.findIndex((task) => task.id === params.taskId)
  if (fromIndex < 0) {
    return tasks
  }

  const [movingTask] = list.splice(fromIndex, 1)
  const insertIndex = Math.max(0, Math.min(params.targetPosition, list.length))
  list.splice(insertIndex, 0, movingTask)

  statusMap.set(params.statusId, reindexBoardPositions(list))
  return flattenStatusMap(statusMap)
}

export function applyTaskCompletion(tasks: Task[], params: CompletionParams): Task[] {
  const nowIso = new Date().toISOString()
  const statusById = new Map(params.statuses.map((status) => [status.id, status]))
  const statusMap = mapByStatus(tasks)

  let sourceStatusId: number | null = null
  let movingTask: Task | null = null

  for (const [statusId, list] of statusMap.entries()) {
    const taskIndex = list.findIndex((task) => task.id === params.taskId)
    if (taskIndex < 0) {
      continue
    }

    sourceStatusId = statusId
    movingTask = list.splice(taskIndex, 1)[0]
    statusMap.set(statusId, reindexBoardPositions(list))
    break
  }

  if (!movingTask || sourceStatusId == null) {
    return tasks
  }

  const sourceStatus = statusById.get(sourceStatusId) ?? movingTask.status
  const closedStatuses = [...params.statuses]
    .filter((status) => Boolean(status.isClosed))
    .sort((left, right) => left.position - right.position)

  let targetStatus = sourceStatus

  if (params.isCompleted) {
    if (!Boolean(sourceStatus.isClosed)) {
      rememberTaskOpenStatus(movingTask.id, sourceStatus.id)
    }

    targetStatus = closedStatuses[0] ?? sourceStatus
    movingTask = {
      ...movingTask,
      isCompleted: true,
      completedAt: movingTask.completedAt ?? nowIso,
    }
  } else {
    const rememberedOpenStatusId = getRememberedTaskOpenStatus(movingTask.id)
    const rememberedOpenStatus = rememberedOpenStatusId != null
      ? statusById.get(rememberedOpenStatusId)
      : null
    const defaultOpenStatus = resolveDefaultOpenStatus(params.statuses)

    targetStatus = rememberedOpenStatus && !Boolean(rememberedOpenStatus.isClosed)
      ? rememberedOpenStatus
      : (defaultOpenStatus ?? sourceStatus)

    if (!Boolean(targetStatus.isClosed)) {
      rememberTaskOpenStatus(movingTask.id, targetStatus.id)
    }

    movingTask = {
      ...movingTask,
      isCompleted: false,
      completedAt: undefined,
    }
  }

  const targetStatusId = targetStatus.id
  movingTask = {
    ...movingTask,
    status: { ...targetStatus },
  }

  if (targetStatusId === sourceStatusId) {
    const sourceList = statusMap.get(sourceStatusId) ?? []
    sourceList.push(movingTask)
    statusMap.set(sourceStatusId, reindexBoardPositions(sourceList))
    return flattenStatusMap(statusMap)
  }

  const targetList = statusMap.get(targetStatusId) ?? []
  targetList.push(movingTask)
  statusMap.set(targetStatusId, reindexBoardPositions(targetList))

  return flattenStatusMap(statusMap)
}

export function applyTaskDelete(tasks: Task[], taskId: number): Task[] {
  clearRememberedTaskOpenStatus(taskId)
  return tasks.filter((task) => task.id !== taskId)
}

export function snapshotProjectTaskQueries(queryClient: QueryClient, projectId: number): TaskProjectSnapshot {
  return queryClient.getQueriesData<TaskPage>({ queryKey: ['tasks', 'project', projectId] })
}

export function restoreProjectTaskQueries(queryClient: QueryClient, snapshot: TaskProjectSnapshot): void {
  for (const [queryKey, data] of snapshot) {
    queryClient.setQueryData(queryKey, data)
  }
}

export function snapshotGoalTaskQueries(queryClient: QueryClient): GoalTaskSnapshot {
  return queryClient.getQueriesData<TaskPage>({ queryKey: ['tasks', 'goal'] })
}

export function restoreGoalTaskQueries(queryClient: QueryClient, snapshot: GoalTaskSnapshot): void {
  for (const [queryKey, data] of snapshot) {
    queryClient.setQueryData(queryKey, data)
  }
}

export function patchProjectTaskQueries(
  queryClient: QueryClient,
  projectId: number,
  updater: (tasks: Task[]) => Task[],
): void {
  queryClient.setQueriesData<TaskPage>(
    { queryKey: ['tasks', 'project', projectId] },
    (oldData) => {
      if (!oldData) return oldData
      return {
        ...oldData,
        content: updater(oldData.content),
      }
    },
  )
}

export function patchGoalTaskQueries(
  queryClient: QueryClient,
  updater: (tasks: Task[]) => Task[],
): void {
  queryClient.setQueriesData<TaskPage>(
    { queryKey: ['tasks', 'goal'] },
    (oldData) => {
      if (!oldData) return oldData
      return {
        ...oldData,
        content: updater(oldData.content),
      }
    },
  )
}

export function snapshotProjectCalendarQueries(queryClient: QueryClient, projectId: number): ProjectCalendarSnapshot {
  return queryClient.getQueriesData<SchedulePage>({ queryKey: ['task-schedules', 'calendar', 'project', projectId] })
}

export function restoreProjectCalendarQueries(queryClient: QueryClient, snapshot: ProjectCalendarSnapshot): void {
  for (const [queryKey, data] of snapshot) {
    queryClient.setQueryData(queryKey, data)
  }
}

export function patchProjectCalendarQueries(
  queryClient: QueryClient,
  projectId: number,
  updater: (schedules: TaskSchedule[]) => TaskSchedule[],
): void {
  queryClient.setQueriesData<SchedulePage>(
    { queryKey: ['task-schedules', 'calendar', 'project', projectId] },
    (oldData) => {
      if (!oldData) return oldData
      return {
        ...oldData,
        content: updater(oldData.content),
      }
    },
  )
}

export function snapshotTaskScheduleQueries(queryClient: QueryClient, taskId: number): TaskScheduleSnapshot {
  return queryClient.getQueriesData<TaskSchedule[]>({ queryKey: ['task-schedules', 'task', taskId] })
}

export function restoreTaskScheduleQueries(queryClient: QueryClient, snapshot: TaskScheduleSnapshot): void {
  for (const [queryKey, data] of snapshot) {
    queryClient.setQueryData(queryKey, data)
  }
}

export function patchTaskScheduleQueries(
  queryClient: QueryClient,
  taskId: number,
  updater: (schedules: TaskSchedule[]) => TaskSchedule[],
): void {
  queryClient.setQueriesData<TaskSchedule[]>(
    { queryKey: ['task-schedules', 'task', taskId] },
    (oldData) => {
      if (!oldData) return oldData
      return updater(oldData)
    },
  )
}

export function applyScheduleUpdate(schedules: TaskSchedule[], params: ScheduleUpdateParams): TaskSchedule[] {
  const updatedDate = params.scheduledStart.slice(0, 10)
  return schedules.map((schedule) => {
    if (schedule.id !== params.scheduleId) return schedule

    return {
      ...schedule,
      scheduledStart: params.scheduledStart,
      scheduledEnd: params.scheduledEnd,
      scheduledDate: updatedDate,
    }
  })
}
