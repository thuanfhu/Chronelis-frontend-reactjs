import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Circle, MessageSquare, CalendarClock, Loader2, Trash2, Send } from 'lucide-react'
import { useUiStore } from '@/app/store/ui-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
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
    if (!hasTask) return
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
      if (!taskQuery.data) throw new Error('Task không tồn tại')
      return taskApi.updateCompletion(taskQuery.data.id, !taskQuery.data.isCompleted)
    },
    onSuccess: () => {
      void invalidateTaskData()
      toast.success('Cập nhật trạng thái thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật thất bại', { description: error.message })
    },
  })

  const addCommentMutation = useMutation({
    mutationFn: () => {
      if (!hasTask) throw new Error('Task chưa được chọn')
      return taskCommentApi.add(taskId, newComment.trim())
    },
    onSuccess: () => {
      setNewComment('')
      void invalidateTaskData()
      toast.success('Thêm comment thành công')
    },
    onError: (error: Error) => {
      toast.error('Thêm comment thất bại', { description: error.message })
    },
  })

  const addScheduleMutation = useMutation({
    mutationFn: () => {
      if (!hasTask) throw new Error('Task chưa được chọn')
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
      toast.success('Thêm lịch thành công')
    },
    onError: (error: Error) => {
      toast.error('Thêm lịch thất bại', { description: error.message })
    },
  })

  const removeScheduleMutation = useMutation({
    mutationFn: (scheduleId: number) => taskScheduleApi.remove(scheduleId),
    onSuccess: () => {
      void invalidateTaskData()
      toast.success('Xóa lịch thành công')
    },
    onError: (error: Error) => {
      toast.error('Xóa lịch thất bại', { description: error.message })
    },
  })

  const comments = commentsQuery.data ?? []
  const schedules = schedulesQuery.data ?? []
  const canCreateSchedule = Boolean(scheduledStart && scheduledEnd && scheduledEnd >= scheduledStart)
  const task = taskQuery.data

  return (
    <Sheet open={hasTask} onOpenChange={(open) => { if (!open) setTaskDrawerTaskId(null) }}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base">Chi tiết task</SheetTitle>
            <Badge variant="outline" className="text-[10px]">#{taskId}</Badge>
          </div>
          <SheetDescription className="sr-only">Xem và quản lý chi tiết task</SheetDescription>
        </SheetHeader>

        {taskQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : task ? (
          <ScrollArea className="flex-1">
            <div className="space-y-5 px-6 py-4">
              {/* Task info */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">{task.title}</h3>
                {task.description && (
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Mức ưu tiên</p>
                    <TaskPriorityBadge priority={task.priority} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Trạng thái</p>
                    <Badge variant="secondary">{task.status.name}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Người giao</p>
                    <p className="text-sm">{task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : 'Chưa giao'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Hạn chót</p>
                    <p className="text-sm">{task.dueDate ? formatDateTime(task.dueDate) : 'Chưa đặt'}</p>
                  </div>
                </div>

                <Button
                  className="w-full gap-2"
                  variant={task.isCompleted ? 'secondary' : 'default'}
                  onClick={() => toggleCompletionMutation.mutate()}
                  disabled={toggleCompletionMutation.isPending}
                >
                  {toggleCompletionMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : task.isCompleted ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Circle className="size-4" />
                  )}
                  {task.isCompleted ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
                </Button>
              </div>

              <Separator />

              {/* Comments */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">Comments ({comments.length})</h4>
                </div>

                <div className="flex gap-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Nhập nội dung comment..."
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    className="shrink-0 self-end"
                    onClick={() => addCommentMutation.mutate()}
                    disabled={addCommentMutation.isPending || !newComment.trim()}
                  >
                    {addCommentMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </div>

                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Chưa có comment nào</p>
                ) : (
                  <div className="space-y-2">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-2.5">
                        <Avatar className="mt-0.5 size-7 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                            {comment.user.firstName.charAt(0)}{comment.user.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <p className="text-xs font-medium">{comment.user.firstName} {comment.user.lastName}</p>
                            <span className="text-[10px] text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Schedules */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">Lịch biểu ({schedules.length})</h4>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bắt đầu</Label>
                    <Input type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Kết thúc</Label>
                    <Input type="datetime-local" value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} />
                  </div>
                  <Button className="w-full" size="sm" onClick={() => addScheduleMutation.mutate()} disabled={addScheduleMutation.isPending || !canCreateSchedule}>
                    {addScheduleMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Thêm lịch biểu
                  </Button>
                </div>

                {schedules.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Chưa có lịch biểu nào</p>
                ) : (
                  <div className="space-y-2">
                    {schedules.map((schedule) => (
                      <div key={schedule.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <p className="text-xs"><span className="text-muted-foreground">Bắt đầu:</span> {formatDateTime(schedule.scheduledStart)}</p>
                          <p className="text-xs"><span className="text-muted-foreground">Kết thúc:</span> {formatDateTime(schedule.scheduledEnd)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => removeScheduleMutation.mutate(schedule.id)}
                          disabled={removeScheduleMutation.isPending}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Không tìm thấy task.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
