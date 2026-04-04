import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useUiStore } from '@/app/store/ui-store'
import { useAuthStore } from '@/app/store/auth-store'
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

export function TaskDeleteConfirmDialog() {
  const queryClient = useQueryClient()

  const taskDeleteConfirmTaskId = useUiStore((state) => state.taskDeleteConfirmTaskId)
  const closeTaskDeleteConfirm = useUiStore((state) => state.closeTaskDeleteConfirm)
  const taskDrawerTaskId = useUiStore((state) => state.taskDrawerTaskId)
  const closeTaskDrawer = useUiStore((state) => state.closeTaskDrawer)
  const currentUserId = useAuthStore((state) => state.currentUser?.userId ?? null)

  const hasTargetTask = taskDeleteConfirmTaskId !== null
  const targetTaskId = taskDeleteConfirmTaskId ?? 0

  const taskQuery = useQuery({
    queryKey: queryKeys.tasks.detail(targetTaskId),
    queryFn: () => taskApi.detail(targetTaskId),
    enabled: hasTargetTask,
  })

  const canDeleteTask = Boolean(
    taskQuery.data
    && currentUserId
    && taskQuery.data.createdBy.userId === currentUserId,
  )

  const description = !taskQuery.data
    ? 'Bạn có chắc muốn xóa task này không? Hành động này không thể hoàn tác.'
    : !canDeleteTask
      ? 'Bạn không có quyền xóa task này. Chỉ người tạo task mới có thể xóa.'
      : `Bạn có chắc muốn xóa task "${taskQuery.data.title}" không? Hành động này không thể hoàn tác.`

  const deleteTaskMutation = useMutation({
    mutationFn: () => {
      if (!canDeleteTask) {
        throw new Error('Bạn không có quyền xóa task này')
      }
      return taskApi.remove(targetTaskId)
    },
    onSuccess: async () => {
      const projectId = taskQuery.data?.projectId
      const deletedTaskId = targetTaskId

      if (taskDrawerTaskId === deletedTaskId) {
        closeTaskDrawer()
      }
      closeTaskDeleteConfirm()

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(deletedTaskId) }),
        queryClient.invalidateQueries({ queryKey: ['task-schedules', 'task', deletedTaskId] }),
        projectId
          ? queryClient.invalidateQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] })
          : Promise.resolve(),
      ])

      toast.success('Xóa task thành công')
    },
    onError: (error: Error) => {
      toast.error('Xóa task thất bại', { description: error.message })
    },
  })

  return (
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
  )
}
