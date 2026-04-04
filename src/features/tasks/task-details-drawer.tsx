import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CheckCircle2, Circle, MessageSquare, CalendarClock, Loader2, Trash2, Send, Pencil, MoreHorizontal, Timer, X,
} from 'lucide-react'
import { useUiStore } from '@/app/store/ui-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { taskApi } from '@/lib/api/modules/task-api'
import { taskCommentApi } from '@/lib/api/modules/task-comment-api'
import { taskScheduleApi } from '@/lib/api/modules/task-schedule-api'
import { queryKeys } from '@/lib/api/query-keys'
import {
  applyTaskCompletion,
  patchProjectTaskQueries,
  restoreProjectTaskQueries,
  snapshotProjectTaskQueries,
} from '@/lib/tasks/optimistic-task-cache'
import { formatDateTime, toLocalDateTimePayload } from '@/lib/utils/datetime'
import { TaskPriorityBadge } from '@/features/tasks/task-priority-badge'
import type { Task, TaskPriorityType } from '@/types/domain'

interface ScheduleDraft {
  start: string
  end: string
}

function toInputDateTimeValue(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 16)
  }

  const local = new Date(parsed.getTime() - (parsed.getTimezoneOffset() * 60000))
  return local.toISOString().slice(0, 16)
}

export function TaskDetailsDrawer() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const routeProjectId = Number(params.projectId)

  const taskDrawerTaskId = useUiStore((state) => state.taskDrawerTaskId)
  const taskDrawerMode = useUiStore((state) => state.taskDrawerMode)
  const closeTaskDrawer = useUiStore((state) => state.closeTaskDrawer)
  const setTaskDrawerMode = useUiStore((state) => state.setTaskDrawerMode)

  const queryClient = useQueryClient()

  const [newComment, setNewComment] = useState('')
  const [scheduledStart, setScheduledStart] = useState('')
  const [scheduledEnd, setScheduledEnd] = useState('')
  const [editTitle, setEditTitle] = useState<string | null>(null)
  const [editDescription, setEditDescription] = useState<string | null>(null)
  const [editPriority, setEditPriority] = useState<TaskPriorityType | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [editingCommentContent, setEditingCommentContent] = useState('')
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<number, ScheduleDraft>>({})

  const hasTask = taskDrawerTaskId !== null
  const taskId = taskDrawerTaskId ?? 0
  const isEditingTask = taskDrawerMode === 'edit'

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

  const resetTransientState = () => {
    setNewComment('')
    setScheduledStart('')
    setScheduledEnd('')
    setEditTitle(null)
    setEditDescription(null)
    setEditPriority(null)
    setEditingCommentId(null)
    setEditingCommentContent('')
    setScheduleDrafts({})
  }

  const handleCloseDrawer = () => {
    closeTaskDrawer()
    resetTransientState()
  }

  const invalidateTaskData = async () => {
    if (!hasTask) return

    const projectId = taskQuery.data?.projectId

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.byTask(taskId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTask(taskId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount }),
      projectId
        ? queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId, 1, 200) })
        : Promise.resolve(),
      projectId
        ? queryClient.invalidateQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] })
        : Promise.resolve(),
    ])
  }

  const toggleCompletionMutation = useMutation({
    mutationFn: () => {
      if (!taskQuery.data) throw new Error('Task không tồn tại')
      return taskApi.updateCompletion(taskQuery.data.id, !taskQuery.data.isCompleted)
    },
    onMutate: async () => {
      if (!taskQuery.data) return {}

      const currentTask = taskQuery.data
      const nextCompleted = !currentTask.isCompleted

      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.tasks.detail(currentTask.id) }),
        queryClient.cancelQueries({ queryKey: ['tasks', 'project', currentTask.projectId] }),
      ])

      const taskDetailSnapshot = queryClient.getQueryData<Task>(queryKeys.tasks.detail(currentTask.id))
      const projectTasksSnapshot = snapshotProjectTaskQueries(queryClient, currentTask.projectId)

      queryClient.setQueryData<Task>(queryKeys.tasks.detail(currentTask.id), (oldTask) => {
        if (!oldTask) return oldTask
        return {
          ...oldTask,
          isCompleted: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
        }
      })

      patchProjectTaskQueries(queryClient, currentTask.projectId, (tasks) =>
        applyTaskCompletion(tasks, {
          taskId: currentTask.id,
          isCompleted: nextCompleted,
        }),
      )

      return {
        taskDetailSnapshot,
        projectTasksSnapshot,
      }
    },
    onError: (error: Error, _variables, context) => {
      const currentTask = taskQuery.data
      if (currentTask && context?.taskDetailSnapshot) {
        queryClient.setQueryData(queryKeys.tasks.detail(currentTask.id), context.taskDetailSnapshot)
      }
      if (context?.projectTasksSnapshot) {
        restoreProjectTaskQueries(queryClient, context.projectTasksSnapshot)
      }
      toast.error('Cập nhật thất bại', { description: error.message })
    },
    onSettled: () => {
      void invalidateTaskData()
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

  const updateScheduleMutation = useMutation({
    mutationFn: ({ scheduleId, start, end }: { scheduleId: number; start: string; end: string }) =>
      taskScheduleApi.update(scheduleId, {
        scheduledStart: toLocalDateTimePayload(start),
        scheduledEnd: toLocalDateTimePayload(end),
      }),
    onSuccess: () => {
      void invalidateTaskData()
      toast.success('Cập nhật lịch thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật lịch thất bại', { description: error.message })
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

  const updateTaskMutation = useMutation({
    mutationFn: () => {
      if (!taskQuery.data) throw new Error('Task không tồn tại')

      return taskApi.update(taskId, {
        title: (editTitle ?? taskQuery.data.title).trim(),
        description: (editDescription ?? taskQuery.data.description ?? '').trim() || undefined,
        priority: editPriority ?? taskQuery.data.priority,
      })
    },
    onSuccess: () => {
      setTaskDrawerMode('view')
      setEditTitle(null)
      setEditDescription(null)
      setEditPriority(null)
      void invalidateTaskData()
      toast.success('Cập nhật task thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật task thất bại', { description: error.message })
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: () => taskApi.remove(taskId),
    onSuccess: () => {
      const projectId = taskQuery.data?.projectId
      handleCloseDrawer()
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId, 1, 200) })
        void queryClient.invalidateQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] })
      }
      toast.success('Xóa task thành công')
    },
    onError: (error: Error) => {
      toast.error('Xóa task thất bại', { description: error.message })
    },
  })

  const updateCommentMutation = useMutation({
    mutationFn: () => {
      if (!editingCommentId) throw new Error('Comment không tồn tại')
      return taskCommentApi.update(editingCommentId, editingCommentContent.trim())
    },
    onSuccess: () => {
      setEditingCommentId(null)
      setEditingCommentContent('')
      void invalidateTaskData()
      toast.success('Cập nhật comment thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật comment thất bại', { description: error.message })
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) => taskCommentApi.remove(commentId),
    onSuccess: () => {
      void invalidateTaskData()
      toast.success('Xóa comment thành công')
    },
    onError: (error: Error) => {
      toast.error('Xóa comment thất bại', { description: error.message })
    },
  })

  const comments = commentsQuery.data ?? []
  const schedules = schedulesQuery.data ?? []
  const canCreateSchedule = Boolean(scheduledStart && scheduledEnd && scheduledEnd > scheduledStart)
  const task = taskQuery.data

  const enterEditMode = () => {
    if (!task) return
    setEditTitle(task.title)
    setEditDescription(task.description ?? '')
    setEditPriority(task.priority)
    setTaskDrawerMode('edit')
  }

  const leaveEditMode = () => {
    setTaskDrawerMode('view')
    setEditTitle(null)
    setEditDescription(null)
    setEditPriority(null)
  }

  const openPomodoro = () => {
    if (!task) return

    const resolvedProjectId = Number.isFinite(routeProjectId) ? routeProjectId : task.projectId
    if (!Number.isFinite(workspaceId) || !Number.isFinite(resolvedProjectId)) return

    navigate(`/workspaces/${workspaceId}/projects/${resolvedProjectId}/pomodoro/${task.id}`, {
      state: {
        returnTo: `${location.pathname}${location.search}`,
      },
    })
    handleCloseDrawer()
  }

  return (
    <Sheet open={hasTask} onOpenChange={(open) => { if (!open) handleCloseDrawer() }}>
      <SheetContent showCloseButton={false} className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base">Chi tiết task</SheetTitle>
            <Badge variant="outline" className="text-[10px]">#{taskId}</Badge>

            <div className="ml-auto flex items-center gap-1">
              {task && !isEditingTask && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={enterEditMode}
                >
                  <Pencil className="size-3.5" />
                </Button>
              )}
              {task && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => deleteTaskMutation.mutate()}
                  disabled={deleteTaskMutation.isPending}
                >
                  {deleteTaskMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </Button>
              )}
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={handleCloseDrawer}
                >
                  <X className="size-4" />
                </Button>
              </SheetClose>
            </div>
          </div>
          <SheetDescription className="sr-only">Xem và quản lý chi tiết task</SheetDescription>
        </SheetHeader>

        {taskQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : task ? (
          <>
            <ScrollArea className="flex-1">
              <div className="space-y-5 px-6 py-4">
                {/* Task info */}
                <div className="space-y-3">
                  {isEditingTask ? (
                    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tiêu đề</Label>
                        <Input value={editTitle ?? task.title} onChange={(e) => setEditTitle(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Mô tả</Label>
                        <Textarea value={editDescription ?? task.description ?? ''} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Mức ưu tiên</Label>
                        <div className="flex gap-1.5">
                          {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((priority) => (
                            <Button
                              key={priority}
                              type="button"
                              variant={(editPriority ?? task.priority) === priority ? 'default' : 'outline'}
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setEditPriority(priority)}
                            >
                              {priority}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-lg font-semibold">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      )}
                    </>
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

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      className="gap-2"
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
                    <Button variant="outline" className="gap-2" onClick={openPomodoro}>
                      <Timer className="size-4" />
                      Pomodoro
                    </Button>
                  </div>

                  {task.taskType && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Loại task</p>
                        <Badge variant="secondary" className="gap-1 text-[10px]" style={task.taskType.color ? { backgroundColor: `${task.taskType.color}20`, color: task.taskType.color } : undefined}>
                          {task.taskType.icon && <span>{task.taskType.icon}</span>}
                          {task.taskType.name}
                        </Badge>
                      </div>
                    </div>
                  )}
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
                        <div key={comment.id} className="group/comment flex gap-2.5">
                          <Avatar className="mt-0.5 size-7 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                              {comment.user.firstName.charAt(0)}{comment.user.lastName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <p className="text-xs font-medium">{comment.user.firstName} {comment.user.lastName}</p>
                              <span className="text-[10px] text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="ml-auto rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover/comment:opacity-100">
                                    <MoreHorizontal className="size-3" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingCommentId(comment.id)
                                      setEditingCommentContent(comment.content)
                                    }}
                                  >
                                    <Pencil className="mr-2 size-3" />
                                    Chỉnh sửa
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => deleteCommentMutation.mutate(comment.id)}
                                  >
                                    <Trash2 className="mr-2 size-3" />
                                    Xóa
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            {editingCommentId === comment.id ? (
                              <div className="mt-1 space-y-1.5">
                                <Textarea
                                  value={editingCommentContent}
                                  onChange={(e) => setEditingCommentContent(e.target.value)}
                                  rows={2}
                                  className="text-sm"
                                />
                                <div className="flex gap-1.5">
                                  <Button size="sm" className="h-7 text-xs" onClick={() => updateCommentMutation.mutate()} disabled={updateCommentMutation.isPending || !editingCommentContent.trim()}>
                                    {updateCommentMutation.isPending && <Loader2 className="mr-1 size-3 animate-spin" />}
                                    Lưu
                                  </Button>
                                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingCommentId(null)}>Hủy</Button>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-0.5 text-sm text-muted-foreground">{comment.content}</p>
                            )}
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
                      <Input type="datetime-local" step={900} value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Kết thúc</Label>
                      <Input type="datetime-local" step={900} value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} />
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
                      {schedules.map((schedule) => {
                        const draft = scheduleDrafts[schedule.id]
                        const startValue = draft?.start ?? toInputDateTimeValue(schedule.scheduledStart)
                        const endValue = draft?.end ?? toInputDateTimeValue(schedule.scheduledEnd)
                        const canUpdate = Boolean(startValue && endValue && endValue > startValue)

                        return (
                          <div key={schedule.id} className="space-y-2 rounded-lg border p-3">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Bắt đầu</Label>
                                <Input
                                  type="datetime-local"
                                  step={900}
                                  value={startValue}
                                  onChange={(event) => {
                                    const nextStart = event.target.value
                                    setScheduleDrafts((prev) => ({
                                      ...prev,
                                      [schedule.id]: {
                                        start: nextStart,
                                        end: prev[schedule.id]?.end ?? endValue,
                                      },
                                    }))
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Kết thúc</Label>
                                <Input
                                  type="datetime-local"
                                  step={900}
                                  value={endValue}
                                  onChange={(event) => {
                                    const nextEnd = event.target.value
                                    setScheduleDrafts((prev) => ({
                                      ...prev,
                                      [schedule.id]: {
                                        start: prev[schedule.id]?.start ?? startValue,
                                        end: nextEnd,
                                      },
                                    }))
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] text-muted-foreground">{formatDateTime(schedule.scheduledStart)} → {formatDateTime(schedule.scheduledEnd)}</p>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => updateScheduleMutation.mutate({
                                    scheduleId: schedule.id,
                                    start: startValue,
                                    end: endValue,
                                  })}
                                  disabled={updateScheduleMutation.isPending || !canUpdate}
                                >
                                  {updateScheduleMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                                  Lưu
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-destructive hover:text-destructive"
                                  onClick={() => removeScheduleMutation.mutate(schedule.id)}
                                  disabled={removeScheduleMutation.isPending}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            {isEditingTask && (
              <div className="border-t bg-background/95 px-6 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={leaveEditMode}>Hủy</Button>
                  <Button
                    size="sm"
                    onClick={() => updateTaskMutation.mutate()}
                    disabled={updateTaskMutation.isPending || !(editTitle ?? task.title).trim()}
                  >
                    {updateTaskMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                    Lưu thay đổi
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Không tìm thấy task.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
