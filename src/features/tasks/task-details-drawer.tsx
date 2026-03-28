import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { useUiStore } from '@/app/store/ui-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { taskApi } from '@/lib/api/modules/task-api'
import { taskCommentApi } from '@/lib/api/modules/task-comment-api'
import { taskScheduleApi } from '@/lib/api/modules/task-schedule-api'
import { queryKeys } from '@/lib/api/query-keys'
import { formatDateTime, toLocalDateTimePayload } from '@/lib/utils/datetime'
import { TaskPriorityBadge } from '@/features/tasks/task-priority-badge'

export function TaskDetailsDrawer() {
  const taskDrawerTaskId = useUiStore((state) => state.taskDrawerTaskId)
  const setTaskDrawerTaskId = useUiStore((state) => state.setTaskDrawerTaskId)
  const queryClient = useQueryClient()

  const [newComment, setNewComment] = useState('')
  const [scheduledStart, setScheduledStart] = useState('')
  const [scheduledEnd, setScheduledEnd] = useState('')

  const hasTask = taskDrawerTaskId !== null
  const taskId = taskDrawerTaskId ?? 0

  const taskQuery = useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: () => taskApi.detail(taskId),
    enabled: hasTask,
  })

  const commentsQuery = useQuery({
    queryKey: queryKeys.comments.byTask(taskId),
    queryFn: () => taskCommentApi.listByTask(taskId),
    enabled: hasTask,
  })

  const schedulesQuery = useQuery({
    queryKey: queryKeys.schedules.byTask(taskId),
    queryFn: () => taskScheduleApi.listByTask(taskId),
    enabled: hasTask,
  })

  const invalidateTaskData = async () => {
    if (!hasTask) {
      return
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.byTask(taskId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTask(taskId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount }),
      taskQuery.data
        ? queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(taskQuery.data.projectId, 1, 200) })
        : Promise.resolve(),
    ])
  }

  const toggleCompletionMutation = useMutation({
    mutationFn: () => {
      if (!taskQuery.data) {
        throw new Error('Task khong ton tai')
      }
      return taskApi.updateCompletion(taskQuery.data.id, !taskQuery.data.isCompleted)
    },
    onSuccess: () => {
      void invalidateTaskData()
      toast.success('Cap nhat completion thanh cong')
    },
    onError: (error: Error) => {
      toast.error('Cap nhat completion that bai', { description: error.message })
    },
  })

  const addCommentMutation = useMutation({
    mutationFn: () => {
      if (!hasTask) {
        throw new Error('Task chua duoc chon')
      }
      return taskCommentApi.add(taskId, newComment)
    },
    onSuccess: () => {
      setNewComment('')
      void invalidateTaskData()
      toast.success('Them comment thanh cong')
    },
    onError: (error: Error) => {
      toast.error('Them comment that bai', { description: error.message })
    },
  })

  const addScheduleMutation = useMutation({
    mutationFn: () => {
      if (!hasTask) {
        throw new Error('Task chua duoc chon')
      }

      return taskScheduleApi.create({
        taskId,
        scheduledStart: toLocalDateTimePayload(scheduledStart),
        scheduledEnd: toLocalDateTimePayload(scheduledEnd),
      })
    },
    onSuccess: () => {
      setScheduledStart('')
      setScheduledEnd('')
      void invalidateTaskData()
      toast.success('Them schedule thanh cong')
    },
    onError: (error: Error) => {
      toast.error('Them schedule that bai', { description: error.message })
    },
  })

  const removeScheduleMutation = useMutation({
    mutationFn: (scheduleId: number) => taskScheduleApi.remove(scheduleId),
    onSuccess: () => {
      void invalidateTaskData()
      toast.success('Xoa schedule thanh cong')
    },
    onError: (error: Error) => {
      toast.error('Xoa schedule that bai', { description: error.message })
    },
  })

  const comments = commentsQuery.data ?? []
  const schedules = schedulesQuery.data ?? []

  const canCreateSchedule = Boolean(scheduledStart && scheduledEnd && scheduledEnd >= scheduledStart)

  if (!hasTask) {
    return null
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/35" onClick={() => setTaskDrawerTaskId(null)} />

      <aside className="fixed right-0 top-0 z-40 h-dvh w-full max-w-xl border-l border-border bg-background p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Task details</p>
            <h2 className="text-lg font-semibold">#{taskId}</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={() => setTaskDrawerTaskId(null)}>
            <X className="size-4" />
          </Button>
        </div>

        {taskQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Dang tai task...</p>
        ) : taskQuery.data ? (
          <div className="h-[calc(100dvh-96px)] space-y-3 overflow-y-auto pr-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{taskQuery.data.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Priority</span>
                  <TaskPriorityBadge priority={taskQuery.data.priority} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span>{taskQuery.data.status.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Assignee</span>
                  <span>{taskQuery.data.assignee ? `${taskQuery.data.assignee.firstName} ${taskQuery.data.assignee.lastName}` : 'Unassigned'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Due date</span>
                  <span>{formatDateTime(taskQuery.data.dueDate)}</span>
                </div>
                <Button
                  className="w-full"
                  variant={taskQuery.data.isCompleted ? 'secondary' : 'default'}
                  onClick={() => toggleCompletionMutation.mutate()}
                  disabled={toggleCompletionMutation.isPending}
                >
                  {taskQuery.data.isCompleted ? 'Mark incomplete' : 'Mark completed'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Comments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder="Nhap noi dung comment"
                />
                <Button
                  onClick={() => addCommentMutation.mutate()}
                  disabled={addCommentMutation.isPending || newComment.trim().length === 0}
                >
                  Add comment
                </Button>

                <div className="space-y-2">
                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chua co comment nao</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="rounded-md border bg-card p-3 text-sm">
                        <p className="font-medium">{comment.user.firstName} {comment.user.lastName}</p>
                        <p className="mt-1 text-muted-foreground">{comment.content}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Schedules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input type="datetime-local" value={scheduledStart} onChange={(event) => setScheduledStart(event.target.value)} />
                <Input type="datetime-local" value={scheduledEnd} onChange={(event) => setScheduledEnd(event.target.value)} />
                <Button
                  onClick={() => addScheduleMutation.mutate()}
                  disabled={addScheduleMutation.isPending || !canCreateSchedule}
                >
                  Add schedule
                </Button>

                <div className="space-y-2">
                  {schedules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chua co schedule nao</p>
                  ) : (
                    schedules.map((schedule) => (
                      <div key={schedule.id} className="rounded-md border bg-card p-3 text-sm">
                        <p>Start: {formatDateTime(schedule.scheduledStart)}</p>
                        <p>End: {formatDateTime(schedule.scheduledEnd)}</p>
                        <Button
                          className="mt-2"
                          size="sm"
                          variant="destructive"
                          onClick={() => removeScheduleMutation.mutate(schedule.id)}
                          disabled={removeScheduleMutation.isPending}
                        >
                          Remove
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Khong tim thay task.</p>
        )}
      </aside>
    </>
  )
}
