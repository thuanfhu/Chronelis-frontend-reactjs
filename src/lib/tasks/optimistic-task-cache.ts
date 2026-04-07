import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { PageResult, Task, TaskSchedule, TaskStatus } from '@/types/domain'

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
  statuses?: TaskStatus[]
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
  const currentTask = tasks.find((task) => task.id === params.taskId)
  if (!currentTask) {
    return tasks
  }

  const statusById = new Map<number, TaskStatus>()
  for (const task of tasks) {
    statusById.set(task.status.id, { ...task.status })
  }
  for (const status of params.statuses ?? []) {
    statusById.set(status.id, { ...status })
  }

  const orderedStatuses = [...statusById.values()].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position
    }
    return left.id - right.id
  })

  const firstClosedStatus = orderedStatuses.find((status) => status.isClosed)
  const firstOpenStatus = orderedStatuses.find((status) => !status.isClosed)

  let targetStatus = currentTask.status
  if (params.isCompleted && !currentTask.status.isClosed && firstClosedStatus) {
    targetStatus = firstClosedStatus
  }
  if (!params.isCompleted && currentTask.status.isClosed && firstOpenStatus) {
    targetStatus = firstOpenStatus
  }

  if (targetStatus.id === currentTask.status.id) {
    return tasks.map((task) => {
      if (task.id !== params.taskId) return task

      return {
        ...task,
        status: { ...targetStatus },
        isCompleted: params.isCompleted,
        completedAt: params.isCompleted ? nowIso : undefined,
      }
    })
  }

  const statusMap = mapByStatus(tasks)
  const sourceTasks = statusMap.get(currentTask.status.id)
  if (!sourceTasks) {
    return tasks
  }

  const sourceIndex = sourceTasks.findIndex((task) => task.id === params.taskId)
  if (sourceIndex < 0) {
    return tasks
  }

  const [movingTask] = sourceTasks.splice(sourceIndex, 1)
  statusMap.set(currentTask.status.id, reindexBoardPositions(sourceTasks))

  const targetTasks = statusMap.get(targetStatus.id) ?? []
  targetTasks.push({
    ...movingTask,
    status: { ...targetStatus },
    isCompleted: params.isCompleted,
    completedAt: params.isCompleted ? nowIso : undefined,
  })
  statusMap.set(targetStatus.id, reindexBoardPositions(targetTasks))

  return flattenStatusMap(statusMap)
}

export function applyTaskDelete(tasks: Task[], taskId: number): Task[] {
  return tasks.filter((task) => task.id !== taskId)
}

export function applyTaskReplace(tasks: Task[], updatedTask: Task): Task[] {
  return tasks.map((task) => {
    if (task.id !== updatedTask.id) {
      return task
    }

    return cloneTask(updatedTask)
  })
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
