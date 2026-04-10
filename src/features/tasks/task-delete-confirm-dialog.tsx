import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { useUiStore } from '@/app/store/ui-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { taskApi } from '@/lib/api/modules/task-api'
import { queryKeys } from '@/lib/api/query-keys'
import { isNotFoundError } from '@/lib/errors/is-not-found-error'
import {
  applyTaskDelete,
  patchGoalTaskQueries,
  patchProjectCalendarQueries,
  patchProjectTaskQueries,
  patchTaskScheduleQueries,
  restoreGoalTaskQueries,
  restoreProjectCalendarQueries,
  restoreProjectTaskQueries,
  restoreTaskScheduleQueries,
  snapshotGoalTaskQueries,
  snapshotProjectCalendarQueries,
  snapshotProjectTaskQueries,
  snapshotTaskScheduleQueries,
} from '@/lib/tasks/optimistic-task-cache'
import { useProjectPermissions } from '@/lib/permissions/use-project-permissions'
import type { Task, TaskComment } from '@/types/domain'

const TASK_DELETE_UNDO_WINDOW_MS = 5_000

type CommentSnapshot = Array<[QueryKey, TaskComment[] | undefined]>

interface PendingTaskDelete {
  taskId: number
  projectId: number
  taskTitle: string
  createdAt: number
  expiresAt: number
  status: 'pending' | 'finalizing'
  snapshots: {
    taskDetail: Task | undefined
    projectTasks: ReturnType<typeof snapshotProjectTaskQueries>
    goalTasks: ReturnType<typeof snapshotGoalTaskQueries>
    projectCalendar: ReturnType<typeof snapshotProjectCalendarQueries>
    taskSchedules: ReturnType<typeof snapshotTaskScheduleQueries>
    comments: CommentSnapshot
  }
}

function CircularCountdownUndo({
  progress,
  remainingSeconds,
  onUndo,
  disabled,
}: {
  progress: number
  remainingSeconds: number
  onUndo: () => void
  disabled: boolean
}) {
  const radius = 18
  const strokeWidth = 3
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="flex items-center gap-2">
      <div className="relative grid size-11 place-items-center">
        <svg className="size-11 -rotate-90" viewBox="0 0 48 48" aria-hidden>
          <circle
            cx="24"
            cy="24"
            r={radius}
            strokeWidth={strokeWidth}
            className="fill-none stroke-muted/40"
          />
          <circle
            cx="24"
            cy="24"
            r={radius}
            strokeWidth={strokeWidth}
            className="fill-none stroke-primary"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 140ms linear' }}
          />
        </svg>
        <span className="absolute text-[10px] font-semibold tabular-nums">{remainingSeconds}</span>
      </div>

      <Button
        variant="outline"
        size="icon"
        className="size-7 rounded-full"
        onClick={onUndo}
        disabled={disabled}
        aria-label="Hoàn tác xóa"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

export function TaskDeleteConfirmDialog() {
  const queryClient = useQueryClient()
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const routeProjectId = Number(params.projectId)

  const taskDeleteConfirmTaskId = useUiStore((state) => state.taskDeleteConfirmTaskId)
  const closeTaskDeleteConfirm = useUiStore((state) => state.closeTaskDeleteConfirm)
  const taskDrawerTaskId = useUiStore((state) => state.taskDrawerTaskId)
  const closeTaskDrawer = useUiStore((state) => state.closeTaskDrawer)

  const [pendingDeletes, setPendingDeletes] = useState<PendingTaskDelete[]>([])
  const [clockMs, setClockMs] = useState(() => Date.now())
  const pendingDeletesRef = useRef<PendingTaskDelete[]>([])
  const finalizingTaskIdsRef = useRef(new Set<number>())

  useEffect(() => {
    pendingDeletesRef.current = pendingDeletes
  }, [pendingDeletes])

  const hasTargetTask = taskDeleteConfirmTaskId !== null
  const targetTaskId = taskDeleteConfirmTaskId ?? 0

  const taskQuery = useQuery({
    queryKey: queryKeys.tasks.detail(targetTaskId),
    queryFn: () => taskApi.detail(targetTaskId),
    enabled: hasTargetTask,
  })

  const permissionProjectId = Number.isFinite(routeProjectId)
    ? routeProjectId
    : (taskQuery.data?.projectId ?? Number.NaN)

  const {
    canManageTask: canManageTaskByGoal,
    permissionsReady,
  } = useProjectPermissions({
    workspaceId,
    projectId: permissionProjectId,
    enabled: Number.isFinite(workspaceId) && Number.isFinite(permissionProjectId),
  })

  const canDeleteTask = Boolean(
    taskQuery.data
    && permissionsReady
    && canManageTaskByGoal(taskQuery.data.goalId),
  )

  const description = !taskQuery.data
    ? 'Bạn có chắc muốn xóa task này không? Bạn có thể hoàn tác trong 5 giây.'
    : !canDeleteTask
      ? 'Bạn không có quyền xóa task này theo vai trò quản lý hiện tại.'
      : `Bạn có chắc muốn xóa task "${taskQuery.data.title}" không? Bạn có thể hoàn tác trong 5 giây.`

  const restoreCommentSnapshots = useCallback((snapshots: CommentSnapshot) => {
    for (const [queryKey, data] of snapshots) {
      queryClient.setQueryData(queryKey, data)
    }
  }, [queryClient])

  const restorePendingDelete = useCallback((pendingDelete: PendingTaskDelete) => {
    queryClient.setQueryData(queryKeys.tasks.detail(pendingDelete.taskId), pendingDelete.snapshots.taskDetail)
    restoreProjectTaskQueries(queryClient, pendingDelete.snapshots.projectTasks)
    restoreGoalTaskQueries(queryClient, pendingDelete.snapshots.goalTasks)
    restoreProjectCalendarQueries(queryClient, pendingDelete.snapshots.projectCalendar)
    restoreTaskScheduleQueries(queryClient, pendingDelete.snapshots.taskSchedules)
    restoreCommentSnapshots(pendingDelete.snapshots.comments)
  }, [queryClient, restoreCommentSnapshots])

  const applyOptimisticDelete = (task: Task) => {
    const snapshots: PendingTaskDelete['snapshots'] = {
      taskDetail: queryClient.getQueryData<Task>(queryKeys.tasks.detail(task.id)),
      projectTasks: snapshotProjectTaskQueries(queryClient, task.projectId),
      goalTasks: snapshotGoalTaskQueries(queryClient),
      projectCalendar: snapshotProjectCalendarQueries(queryClient, task.projectId),
      taskSchedules: snapshotTaskScheduleQueries(queryClient, task.id),
      comments: queryClient.getQueriesData<TaskComment[]>({ queryKey: ['task-comments', task.id] }),
    }

    queryClient.setQueryData(queryKeys.tasks.detail(task.id), undefined)
    patchProjectTaskQueries(queryClient, task.projectId, (tasks) => applyTaskDelete(tasks, task.id))
    patchGoalTaskQueries(queryClient, (tasks) => applyTaskDelete(tasks, task.id))
    patchProjectCalendarQueries(queryClient, task.projectId, (schedules) =>
      schedules.filter((schedule) => schedule.taskId !== task.id),
    )
    patchTaskScheduleQueries(queryClient, task.id, () => [])
    queryClient.setQueriesData<TaskComment[]>({ queryKey: ['task-comments', task.id] }, () => [])

    return snapshots
  }

  const removePendingDelete = useCallback((taskId: number) => {
    finalizingTaskIdsRef.current.delete(taskId)
    setPendingDeletes((previous) => previous.filter((item) => item.taskId !== taskId))
  }, [])

  const undoPendingDelete = (taskId: number) => {
    const pendingDelete = pendingDeletesRef.current.find((item) => item.taskId === taskId)
    if (!pendingDelete || pendingDelete.status !== 'pending') {
      return
    }

    restorePendingDelete(pendingDelete)
    removePendingDelete(taskId)
    toast.success(`Đã hoàn tác xóa task "${pendingDelete.taskTitle}"`)
  }

  const finalizePendingDelete = useCallback(async (taskId: number) => {
    const pendingDelete = pendingDeletesRef.current.find((item) => item.taskId === taskId)
    if (!pendingDelete || pendingDelete.status !== 'pending') {
      return
    }

    if (finalizingTaskIdsRef.current.has(taskId)) {
      return
    }

    finalizingTaskIdsRef.current.add(taskId)

    setPendingDeletes((previous) =>
      previous.map((item) =>
        item.taskId === taskId
          ? { ...item, status: 'finalizing' }
          : item,
      ),
    )

    try {
      await taskApi.remove(taskId)
      toast.success(`Đã xóa task "${pendingDelete.taskTitle}"`)
    } catch (error) {
      if (error instanceof Error && isNotFoundError(error)) {
        toast.success(`Task "${pendingDelete.taskTitle}" đã được xóa trước đó`)
      } else {
        restorePendingDelete(pendingDelete)

        const descriptionText = error instanceof Error
          ? error.message
          : 'Đã xảy ra lỗi không xác định'

        toast.error('Xóa task thất bại', { description: descriptionText })
        removePendingDelete(taskId)
        return
      }
    }

    removePendingDelete(taskId)

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks', 'project', pendingDelete.projectId] }),
      queryClient.invalidateQueries({ queryKey: ['tasks', 'goal'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) }),
      queryClient.invalidateQueries({ queryKey: ['task-schedules', 'task', taskId] }),
      queryClient.invalidateQueries({ queryKey: ['task-schedules', 'calendar', 'project', pendingDelete.projectId] }),
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] }),
    ])
  }, [queryClient, removePendingDelete, restorePendingDelete])

  useEffect(() => {
    if (pendingDeletes.length === 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      const now = Date.now()
      setClockMs(now)

      const expiredTaskIds = pendingDeletesRef.current
        .filter((item) => item.status === 'pending' && item.expiresAt <= now)
        .map((item) => item.taskId)

      for (const taskId of expiredTaskIds) {
        void finalizePendingDelete(taskId)
      }
    }, 100)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [pendingDeletes.length, finalizePendingDelete])

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      const task = taskQuery.data
      if (!task || !canDeleteTask) {
        throw new Error('Bạn không có quyền xóa task này')
      }

      const existingPendingDelete = pendingDeletesRef.current.find((item) => item.taskId === task.id)
      if (existingPendingDelete) {
        throw new Error('Task này đang chờ xóa. Bạn có thể hoàn tác hoặc đợi hoàn tất.')
      }

      const snapshots = applyOptimisticDelete(task)

      if (taskDrawerTaskId === task.id) {
        closeTaskDrawer()
      }
      closeTaskDeleteConfirm()

      const createdAt = Date.now()
      setPendingDeletes((previous) => [
        ...previous,
        {
          taskId: task.id,
          projectId: task.projectId,
          taskTitle: task.title,
          createdAt,
          expiresAt: createdAt + TASK_DELETE_UNDO_WINDOW_MS,
          status: 'pending',
          snapshots,
        },
      ])
    },
    onSuccess: () => {
      toast.success('Task đã được xóa tạm thời. Bạn có 5 giây để hoàn tác.')
    },
    onError: (error: Error) => {
      toast.error('Không thể xóa task', { description: error.message })
    },
  })

  return (
    <>
      <Dialog open={hasTargetTask} onOpenChange={(open) => { if (!open) closeTaskDeleteConfirm() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              Xác nhận xóa task
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeTaskDeleteConfirm()}
              disabled={deleteTaskMutation.isPending}
            >
              Hủy
            </Button>
            {canDeleteTask && (
              <Button
                variant="destructive"
                onClick={() => deleteTaskMutation.mutate()}
                disabled={deleteTaskMutation.isPending}
              >
                {deleteTaskMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Xóa task
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pendingDeletes.length > 0 && (
        <div className="pointer-events-none fixed right-4 bottom-4 z-70 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
          {pendingDeletes.map((pendingDelete) => {
            const remainingMs = Math.max(0, pendingDelete.expiresAt - clockMs)
            const progress = Math.max(
              0,
              Math.min(100, (remainingMs / TASK_DELETE_UNDO_WINDOW_MS) * 100),
            )
            const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))

            return (
              <div
                key={pendingDelete.taskId}
                className="pointer-events-auto rounded-lg border border-border/80 bg-card/95 p-3 shadow-lg backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Đang xóa task</p>
                    <p className="truncate text-xs text-muted-foreground">{pendingDelete.taskTitle}</p>
                  </div>

                  <CircularCountdownUndo
                    progress={progress}
                    remainingSeconds={remainingSeconds}
                    onUndo={() => undoPendingDelete(pendingDelete.taskId)}
                    disabled={pendingDelete.status !== 'pending'}
                  />
                </div>

                <p className="mt-1 text-[11px] text-muted-foreground">
                  {pendingDelete.status === 'finalizing'
                    ? 'Đang xóa vĩnh viễn...'
                    : `Tự động xóa sau ${remainingSeconds}s`}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
