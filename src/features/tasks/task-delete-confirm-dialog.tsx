import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useUiStore } from '@/app/store/ui-store'
import { Button } from '@/components/ui/button'
import { DeferredDeleteStack } from '@/components/shared/deferred-delete-stack'
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

export function TaskDeleteConfirmDialog() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

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

  const restoreCommentSnapshots = useCallback(
    (snapshots: CommentSnapshot) => {
      for (const [queryKey, data] of snapshots) {
        queryClient.setQueryData(queryKey, data)
      }
    },
    [queryClient],
  )

  const restorePendingDelete = useCallback(
    (pendingDelete: PendingTaskDelete) => {
      queryClient.setQueryData(queryKeys.tasks.detail(pendingDelete.taskId), pendingDelete.snapshots.taskDetail)
      restoreProjectTaskQueries(queryClient, pendingDelete.snapshots.projectTasks)
      restoreGoalTaskQueries(queryClient, pendingDelete.snapshots.goalTasks)
      restoreProjectCalendarQueries(queryClient, pendingDelete.snapshots.projectCalendar)
      restoreTaskScheduleQueries(queryClient, pendingDelete.snapshots.taskSchedules)
      restoreCommentSnapshots(pendingDelete.snapshots.comments)
    },
    [queryClient, restoreCommentSnapshots],
  )

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
    toast.success(t('task.undoDeleteSuccess', { name: pendingDelete.taskTitle }))
  }

  const finalizePendingDelete = useCallback(
    async (taskId: number) => {
      const pendingDelete = pendingDeletesRef.current.find((item) => item.taskId === taskId)
      if (!pendingDelete || pendingDelete.status !== 'pending') {
        return
      }

      if (finalizingTaskIdsRef.current.has(taskId)) {
        return
      }

      finalizingTaskIdsRef.current.add(taskId)

      setPendingDeletes((previous) =>
        previous.map((item) => (item.taskId === taskId ? { ...item, status: 'finalizing' } : item)),
      )

      try {
        await taskApi.remove(taskId)
        toast.success(t('task.deleteSuccessWithName', { name: pendingDelete.taskTitle }))
      } catch (error) {
        if (error instanceof Error && isNotFoundError(error)) {
          toast.success(t('task.deletedBeforeWithName', { name: pendingDelete.taskTitle }))
        } else {
          restorePendingDelete(pendingDelete)

          const descriptionText = error instanceof Error ? error.message : t('task.deleteUnknownError')

          toast.error(t('task.deleteFailed'), { description: descriptionText })
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
    },
    [queryClient, removePendingDelete, restorePendingDelete],
  )

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
      if (!hasTargetTask) {
        throw new Error(t('task.notFound'))
      }

      const cachedTask = queryClient.getQueryData<Task>(queryKeys.tasks.detail(targetTaskId))
      const task = cachedTask ?? (await taskApi.detail(targetTaskId))

      const existingPendingDelete = pendingDeletesRef.current.find((item) => item.taskId === task.id)
      if (existingPendingDelete) {
        throw new Error(t('task.deleteAlreadyPending'))
      }

      if (taskDrawerTaskId === task.id) {
        closeTaskDrawer()
      }
      closeTaskDeleteConfirm()

      const snapshots = applyOptimisticDelete(task)

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
    onError: (error: Error) => {
      toast.error(t('task.deleteFailed'), { description: error.message })
    },
  })

  return (
    <>
      <Dialog
        open={hasTargetTask}
        onOpenChange={(open) => {
          if (!open) closeTaskDeleteConfirm()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader className="space-y-3 border-b border-border/60 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              {t('task.deleteConfirm')}
            </DialogTitle>
            <DialogDescription className="space-y-3 text-left leading-relaxed text-muted-foreground">
              <p>{t('task.deleteDialogDescription')}</p>
              <div className="rounded-2xl border border-destructive/12 bg-destructive/5 px-3 py-3 text-sm text-foreground/80">
                {t('task.deleteImmediateEffect')}
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => closeTaskDeleteConfirm()} disabled={deleteTaskMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTaskMutation.mutate()}
              disabled={deleteTaskMutation.isPending || !hasTargetTask}
            >
              {deleteTaskMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('task.deleteConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeferredDeleteStack
        pendingDeletes={pendingDeletes.map((pendingDelete) => ({
          key: String(pendingDelete.taskId),
          label: pendingDelete.taskTitle,
          payload: pendingDelete,
          createdAt: pendingDelete.createdAt,
          expiresAt: pendingDelete.expiresAt,
          status: pendingDelete.status,
        }))}
        clockMs={clockMs}
        undoWindowMs={TASK_DELETE_UNDO_WINDOW_MS}
        onUndo={(key) => undoPendingDelete(Number(key))}
        itemTitle={() => t('task.deletingTask')}
      />
    </>
  )
}
