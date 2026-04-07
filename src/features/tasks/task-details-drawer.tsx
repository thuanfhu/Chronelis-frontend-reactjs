import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CheckCircle2, Circle, MessageSquare, Loader2, Trash2, Send, Pencil, MoreHorizontal, Timer, X, CornerDownRight, NotebookText,
} from 'lucide-react'
import { useUiStore } from '@/app/store/ui-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { taskStatusApi } from '@/lib/api/modules/task-status-api'
import { goalApi } from '@/lib/api/modules/goal-api'
import { queryKeys } from '@/lib/api/query-keys'
import {
  applyTaskCompletion,
  applyTaskReplace,
  patchProjectTaskQueries,
  restoreProjectTaskQueries,
  snapshotProjectTaskQueries,
} from '@/lib/tasks/optimistic-task-cache'
import { useProjectPermissions } from '@/lib/permissions/use-project-permissions'
import { useTaskRealtime } from '@/lib/websocket/use-domain-realtime'
import { formatDateTime } from '@/lib/utils/datetime'
import { isNotFoundError } from '@/lib/errors/is-not-found-error'
import { TaskPriorityBadge } from '@/features/tasks/task-priority-badge'
import type { Task, TaskComment, TaskPriorityType } from '@/types/domain'

function toInputDateTimeValue(dateValue: string): string {
  const date = new Date(dateValue)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function parseInputDateTimeValue(value: string): Date {
  const [datePart, timePart = '00:00'] = value.split('T')
  const [yyyy, mm, dd] = datePart.split('-').map(Number)
  const [hh, mi, ss = 0] = timePart.split(':').map(Number)
  return new Date(yyyy, mm - 1, dd, hh, mi, ss)
}

function toApiLocalDateTime(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`
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
  const openTaskDeleteConfirm = useUiStore((state) => state.openTaskDeleteConfirm)

  const queryClient = useQueryClient()

  const [newComment, setNewComment] = useState('')
  const [editTitle, setEditTitle] = useState<string | null>(null)
  const [editDescription, setEditDescription] = useState<string | null>(null)
  const [editPriority, setEditPriority] = useState<TaskPriorityType | null>(null)
  const [editGoalId, setEditGoalId] = useState<number | null>(null)
  const [editStartDateTime, setEditStartDateTime] = useState('')
  const [editEndDateTime, setEditEndDateTime] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [editingCommentContent, setEditingCommentContent] = useState('')
  const [replyParentCommentId, setReplyParentCommentId] = useState<number | null>(null)

  const hasTask = taskDrawerTaskId !== null
  const taskId = taskDrawerTaskId ?? 0

  const taskQuery = useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: () => taskApi.detail(taskId),
    enabled: hasTask,
  })

  const permissionProjectId = Number.isFinite(routeProjectId)
    ? routeProjectId
    : (taskQuery.data?.projectId ?? Number.NaN)

  const {
    currentUserId,
    isWorkspaceManager,
    canManageTask: canManageTaskByGoal,
    permissionsReady,
  } = useProjectPermissions({
    workspaceId,
    projectId: permissionProjectId,
    enabled: Number.isFinite(workspaceId) && Number.isFinite(permissionProjectId),
  })

  const realtimeWorkspaceId = Number.isFinite(workspaceId) ? workspaceId : null
  const realtimeProjectId = Number.isFinite(routeProjectId)
    ? routeProjectId
    : (taskQuery.data?.projectId ?? null)

  useTaskRealtime(realtimeWorkspaceId, realtimeProjectId, hasTask ? taskId : null)

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

  const goalsQuery = useQuery({
    queryKey: taskQuery.data?.projectId
      ? queryKeys.goals.byProject(taskQuery.data.projectId, 1, 100)
      : ['goals', 'task-drawer', taskId],
    queryFn: () => goalApi.listByProject(taskQuery.data!.projectId, { page: 1, size: 100 }),
    enabled: hasTask && Boolean(taskQuery.data?.projectId),
  })

  const statusesQuery = useQuery({
    queryKey: taskQuery.data?.projectId
      ? queryKeys.statuses.byProject(taskQuery.data.projectId)
      : ['task-statuses', 'task-drawer', taskId],
    queryFn: () => taskStatusApi.listByProject(taskQuery.data!.projectId),
    enabled: hasTask && Boolean(taskQuery.data?.projectId),
  })

  const resetTransientState = () => {
    setNewComment('')
    setEditTitle(null)
    setEditDescription(null)
    setEditPriority(null)
    setEditGoalId(null)
    setEditStartDateTime('')
    setEditEndDateTime('')
    setEditingCommentId(null)
    setEditingCommentContent('')
    setReplyParentCommentId(null)
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
      const orderedStatuses = [...(statusesQuery.data ?? [currentTask.status])].sort((left, right) => {
        if (left.position !== right.position) {
          return left.position - right.position
        }
        return left.id - right.id
      })
      const firstClosedStatus = orderedStatuses.find((status) => status.isClosed)
      const firstOpenStatus = orderedStatuses.find((status) => !status.isClosed)
      const nextStatus = nextCompleted
        ? (currentTask.status.isClosed ? currentTask.status : (firstClosedStatus ?? currentTask.status))
        : (currentTask.status.isClosed ? (firstOpenStatus ?? currentTask.status) : currentTask.status)

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
          status: nextStatus,
          isCompleted: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
        }
      })

      patchProjectTaskQueries(queryClient, currentTask.projectId, (tasks) =>
        applyTaskCompletion(tasks, {
          taskId: currentTask.id,
          isCompleted: nextCompleted,
          statuses: statusesQuery.data,
        }),
      )

      return {
        taskDetailSnapshot,
        projectTasksSnapshot,
      }
    },
    onSuccess: (updatedTask) => {
      queryClient.setQueryData<Task>(queryKeys.tasks.detail(updatedTask.id), updatedTask)
      patchProjectTaskQueries(queryClient, updatedTask.projectId, (tasks) => applyTaskReplace(tasks, updatedTask))
    },
    onError: (error: Error, _variables, context) => {
      const currentTask = taskQuery.data
      if (currentTask && context?.taskDetailSnapshot) {
        queryClient.setQueryData(queryKeys.tasks.detail(currentTask.id), context.taskDetailSnapshot)
      }
      if (context?.projectTasksSnapshot) {
        restoreProjectTaskQueries(queryClient, context.projectTasksSnapshot)
      }

      if (isNotFoundError(error)) {
        handleCloseDrawer()
        toast.success('Task đã được xóa trước đó')
        return
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
      return taskCommentApi.add(taskId, newComment.trim(), replyParentCommentId ?? undefined)
    },
    onSuccess: () => {
      setNewComment('')
      setReplyParentCommentId(null)
      void invalidateTaskData()
      toast.success('Thêm comment thành công')
    },
    onError: (error: Error) => {
      toast.error('Thêm comment thất bại', { description: error.message })
    },
  })

  const updateTaskMutation = useMutation({
    mutationFn: async () => {
      const currentTask = taskQuery.data
      if (!currentTask) {
        throw new Error('Task không tồn tại')
      }

      const nextTitle = (editTitle ?? currentTask.title).trim()
      const nextDescription = (editDescription ?? currentTask.description ?? '').trim()
      const nextPriority = editPriority ?? currentTask.priority
      const nextGoalId = editGoalId ?? null
      const currentGoalId = currentTask.goalId ?? null

      const titleChanged = nextTitle !== currentTask.title
      const descriptionChanged = nextDescription !== (currentTask.description ?? '')
      const priorityChanged = nextPriority !== currentTask.priority
      const goalChanged = nextGoalId !== currentGoalId

      const startValue = editStartDateTime.trim()
      const endValue = editEndDateTime.trim()
      const hasStartValue = startValue.length > 0
      const hasEndValue = endValue.length > 0
      if (hasStartValue !== hasEndValue) {
        throw new Error('Vui lòng nhập đầy đủ cả thời gian bắt đầu và kết thúc.')
      }

      const currentStartValue = primarySchedule ? toInputDateTimeValue(primarySchedule.scheduledStart) : ''
      const currentEndValue = primarySchedule ? toInputDateTimeValue(primarySchedule.scheduledEnd) : ''

      let scheduleAction: 'none' | 'create' | 'update' | 'delete' = 'none'
      if (hasStartValue && hasEndValue) {
        const startDate = parseInputDateTimeValue(startValue)
        const endDate = parseInputDateTimeValue(endValue)

        if (!(endDate > startDate)) {
          throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu.')
        }

        if (!primarySchedule) {
          scheduleAction = 'create'
        } else if (startValue !== currentStartValue || endValue !== currentEndValue) {
          scheduleAction = 'update'
        }
      } else if (!hasStartValue && !hasEndValue && primarySchedule) {
        scheduleAction = 'delete'
      }

      const hasTaskFieldChanges = titleChanged || descriptionChanged || priorityChanged || goalChanged
      if (!hasTaskFieldChanges && scheduleAction === 'none') {
        throw new Error('Không có thay đổi nào để lưu.')
      }

      if (hasTaskFieldChanges) {
        await taskApi.update(taskId, {
          title: nextTitle,
          description: nextDescription || undefined,
          priority: nextPriority,
          goalId: goalChanged && nextGoalId != null ? nextGoalId : undefined,
          clearGoal: goalChanged && nextGoalId == null ? true : undefined,
        })
      }

      if (scheduleAction === 'create') {
        await taskScheduleApi.create({
          taskId,
          scheduledStart: toApiLocalDateTime(parseInputDateTimeValue(startValue)),
          scheduledEnd: toApiLocalDateTime(parseInputDateTimeValue(endValue)),
        })
      }

      if (scheduleAction === 'update' && primarySchedule) {
        await taskScheduleApi.update(primarySchedule.id, {
          scheduledStart: toApiLocalDateTime(parseInputDateTimeValue(startValue)),
          scheduledEnd: toApiLocalDateTime(parseInputDateTimeValue(endValue)),
        })
      }

      if (scheduleAction === 'delete' && primarySchedule) {
        await taskScheduleApi.remove(primarySchedule.id)
      }
    },
    onSuccess: () => {
      setTaskDrawerMode('view')
      setEditTitle(null)
      setEditDescription(null)
      setEditPriority(null)
      setEditGoalId(null)
      setEditStartDateTime('')
      setEditEndDateTime('')
      void invalidateTaskData()
      toast.success('Cập nhật task thành công')
    },
    onError: (error: Error) => {
      if (isNotFoundError(error)) {
        handleCloseDrawer()
        toast.success('Task đã được xóa trước đó')
        return
      }

      toast.error('Cập nhật task thất bại', { description: error.message })
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

  const removeCommentBranch = (commentList: TaskComment[], targetCommentId: number) => {
    const toDelete = new Set<number>([targetCommentId])

    let changed = true
    while (changed) {
      changed = false
      for (const comment of commentList) {
        if (comment.parentCommentId != null && toDelete.has(comment.parentCommentId) && !toDelete.has(comment.id)) {
          toDelete.add(comment.id)
          changed = true
        }
      }
    }

    return commentList.filter((comment) => !toDelete.has(comment.id))
  }

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) => taskCommentApi.remove(commentId),
    onMutate: async (commentId: number) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.byTask(taskId) })

      const commentsSnapshot = queryClient.getQueryData<typeof commentsQuery.data>(queryKeys.comments.byTask(taskId))

      queryClient.setQueryData<typeof commentsQuery.data>(queryKeys.comments.byTask(taskId), (oldComments) => {
        if (!oldComments) return oldComments
        return removeCommentBranch(oldComments, commentId)
      })

      return {
        commentsSnapshot,
      }
    },
    onSuccess: () => {
      if (editingCommentId != null) {
        const stillExists = (queryClient.getQueryData<typeof commentsQuery.data>(queryKeys.comments.byTask(taskId)) ?? [])
          .some((comment) => comment.id === editingCommentId)
        if (!stillExists) {
          setEditingCommentId(null)
          setEditingCommentContent('')
        }
      }

      if (replyParentCommentId != null) {
        const stillExists = (queryClient.getQueryData<typeof commentsQuery.data>(queryKeys.comments.byTask(taskId)) ?? [])
          .some((comment) => comment.id === replyParentCommentId)
        if (!stillExists) {
          setReplyParentCommentId(null)
        }
      }

      toast.success('Xóa comment thành công')
    },
    onError: (error: Error, _commentId, context) => {
      if (context?.commentsSnapshot) {
        queryClient.setQueryData(queryKeys.comments.byTask(taskId), context.commentsSnapshot)
      }

      if (isNotFoundError(error)) {
        toast.success('Comment đã được xóa trước đó')
        return
      }

      toast.error('Xóa comment thất bại', { description: error.message })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments.byTask(taskId) })
    },
  })

  const comments = commentsQuery.data ?? []
  const schedules = schedulesQuery.data ?? []
  const primarySchedule = schedules[0] ?? null
  const projectGoals = goalsQuery.data?.content ?? []
  const topLevelComments = comments.filter((comment) => comment.parentCommentId == null)
  const repliesByParent = comments.reduce<Map<number, TaskComment[]>>((map, comment) => {
    if (comment.parentCommentId == null) {
      return map
    }

    const currentReplies = map.get(comment.parentCommentId) ?? []
    currentReplies.push(comment)
    map.set(comment.parentCommentId, currentReplies)
    return map
  }, new Map<number, TaskComment[]>())

  const task = taskQuery.data
  const currentGoalTitle = task?.goalId
    ? projectGoals.find((goal) => goal.id === task.goalId)?.title ?? `Goal #${task.goalId}`
    : null
  const currentScheduleStart = primarySchedule ? toInputDateTimeValue(primarySchedule.scheduledStart) : ''
  const currentScheduleEnd = primarySchedule ? toInputDateTimeValue(primarySchedule.scheduledEnd) : ''

  const draftTitle = task ? (editTitle ?? task.title).trim() : ''
  const draftDescription = task ? (editDescription ?? task.description ?? '').trim() : ''
  const draftPriority = task ? (editPriority ?? task.priority) : 'MEDIUM'
  const draftGoalId = editGoalId ?? null
  const draftScheduleStart = editStartDateTime.trim()
  const draftScheduleEnd = editEndDateTime.trim()
  const hasHalfScheduleInput = (draftScheduleStart.length > 0) !== (draftScheduleEnd.length > 0)

  const isTaskEditDirty = task
    ? (
      draftTitle !== task.title
      || draftDescription !== (task.description ?? '')
      || draftPriority !== task.priority
      || draftGoalId !== (task.goalId ?? null)
      || draftScheduleStart !== currentScheduleStart
      || draftScheduleEnd !== currentScheduleEnd
    )
    : false

  const canSubmitTaskEdit = Boolean(task)
    && draftTitle.length > 0
    && isTaskEditDirty
    && !hasHalfScheduleInput

  const canManageCurrentTask = Boolean(task && permissionsReady && canManageTaskByGoal(task.goalId))
  const isEditingTask = taskDrawerMode === 'edit' && canManageCurrentTask
  const canModifyComment = (comment: TaskComment) => Boolean(
    canManageCurrentTask
    && (
      comment.user.userId === currentUserId
      || isWorkspaceManager
    ),
  )

  const enterEditMode = () => {
    if (!task || !canManageCurrentTask) return
    setEditTitle(task.title)
    setEditDescription(task.description ?? '')
    setEditPriority(task.priority)
    setEditGoalId(task.goalId ?? null)
    setEditStartDateTime(primarySchedule ? toInputDateTimeValue(primarySchedule.scheduledStart) : '')
    setEditEndDateTime(primarySchedule ? toInputDateTimeValue(primarySchedule.scheduledEnd) : '')
    setTaskDrawerMode('edit')
  }

  const leaveEditMode = () => {
    setTaskDrawerMode('view')
    setEditTitle(null)
    setEditDescription(null)
    setEditPriority(null)
    setEditGoalId(null)
    setEditStartDateTime('')
    setEditEndDateTime('')
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

  const openNotes = () => {
    if (!task) return

    const resolvedProjectId = Number.isFinite(routeProjectId) ? routeProjectId : task.projectId
    if (!Number.isFinite(workspaceId) || !Number.isFinite(resolvedProjectId)) return

    navigate(`/workspaces/${workspaceId}/projects/${resolvedProjectId}/tasks/${task.id}/notes`, {
      state: {
        returnTo: `${location.pathname}${location.search}`,
      },
    })
    handleCloseDrawer()
  }

  return (
    <Sheet open={hasTask} onOpenChange={(open) => { if (!open) handleCloseDrawer() }}>
      <SheetContent showCloseButton={false} className="flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base">Chi tiết task</SheetTitle>
            <Badge variant="outline" className="text-[10px]">#{taskId}</Badge>

            <div className="ml-auto flex items-center gap-1">
              {task && canManageCurrentTask && !isEditingTask && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={enterEditMode}
                >
                  <Pencil className="size-3.5" />
                </Button>
              )}
              {task && canManageCurrentTask && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => openTaskDeleteConfirm(task.id)}
                >
                  <Trash2 className="size-3.5" />
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
            <ScrollArea className="min-h-0 flex-1">
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

                      <div className="space-y-1.5">
                        <Label className="text-xs">Goal hiện tại</Label>
                        <Select
                          value={editGoalId ? String(editGoalId) : '__none'}
                          onValueChange={(value) => setEditGoalId(value === '__none' ? null : Number(value))}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Không có goal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">Không có goal</SelectItem>
                            {projectGoals.map((goal) => (
                              <SelectItem key={goal.id} value={String(goal.id)}>
                                <span className="block max-w-65 truncate" title={goal.title}>{goal.title}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Bắt đầu</Label>
                          <Input
                            type="datetime-local"
                            value={editStartDateTime}
                            onChange={(event) => setEditStartDateTime(event.target.value)}
                            step={900}
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Kết thúc</Label>
                          <Input
                            type="datetime-local"
                            value={editEndDateTime}
                            onChange={(event) => setEditEndDateTime(event.target.value)}
                            step={900}
                            className="h-8"
                          />
                        </div>
                      </div>

                      {hasHalfScheduleInput && (
                        <p className="text-xs text-destructive">Vui lòng nhập đầy đủ cả giờ bắt đầu và kết thúc.</p>
                      )}
                    </div>
                  ) : (
                    <>
                      <h3 className="text-lg font-semibold">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      )}
                    </>
                  )}

                  {!isEditingTask && (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                          <p className="text-xs text-muted-foreground">Goal</p>
                          <p className="text-sm">{currentGoalTitle ?? 'Chưa gán goal'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Hạn chót</p>
                          <p className="text-sm">{task.dueDate ? formatDateTime(task.dueDate) : 'Chưa đặt'}</p>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <p className="text-xs text-muted-foreground">Lịch trình</p>
                          <p className="text-sm">
                            {primarySchedule
                              ? `${formatDateTime(primarySchedule.scheduledStart)} - ${formatDateTime(primarySchedule.scheduledEnd)}`
                              : 'Chưa lên lịch'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                          className="gap-2"
                          variant={task.isCompleted ? 'secondary' : 'default'}
                          onClick={() => {
                            if (!canManageCurrentTask) {
                              toast.error('Bạn không có quyền cập nhật task này')
                              return
                            }
                            toggleCompletionMutation.mutate()
                          }}
                          disabled={toggleCompletionMutation.isPending || !canManageCurrentTask}
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
                        <Button variant="outline" className="gap-2" onClick={openNotes}>
                          <NotebookText className="size-4" />
                          Notes
                        </Button>
                      </div>

                      {task.taskType && (
                        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Loại task</p>
                            <Badge variant="secondary" className="gap-1 text-[10px]" style={task.taskType.color ? { backgroundColor: `${task.taskType.color}20`, color: task.taskType.color } : undefined}>
                              {task.taskType.icon && <span>{task.taskType.icon}</span>}
                              {task.taskType.name}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {!isEditingTask && (
                  <>
                    <Separator />

                    {/* Comments */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="size-4 text-muted-foreground" />
                        <h4 className="text-sm font-semibold">Comments ({comments.length})</h4>
                      </div>

                      {replyParentCommentId != null && (
                        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <p className="line-clamp-1 text-primary">
                              Đang trả lời comment #{replyParentCommentId}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="size-6"
                              onClick={() => setReplyParentCommentId(null)}
                            >
                              <X className="size-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder={canManageCurrentTask
                            ? (replyParentCommentId != null ? 'Nhập nội dung trả lời...' : 'Nhập nội dung comment...')
                            : 'Bạn không có quyền bình luận task này'}
                          rows={2}
                          className="flex-1"
                          disabled={!canManageCurrentTask}
                        />
                        <Button
                          size="icon"
                          className="shrink-0 self-end"
                          onClick={() => addCommentMutation.mutate()}
                          disabled={addCommentMutation.isPending || !newComment.trim() || !canManageCurrentTask}
                        >
                          {addCommentMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        </Button>
                      </div>

                      {topLevelComments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Chưa có comment nào</p>
                      ) : (
                        <div className="space-y-2">
                          {topLevelComments.map((comment) => {
                            const replies = repliesByParent.get(comment.id) ?? []

                            return (
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
                                    {canManageCurrentTask && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button className="ml-auto rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover/comment:opacity-100">
                                            <MoreHorizontal className="size-3" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setReplyParentCommentId(comment.id)
                                              setEditingCommentId(null)
                                              setEditingCommentContent('')
                                            }}
                                          >
                                            <CornerDownRight className="mr-2 size-3" />
                                            Trả lời
                                          </DropdownMenuItem>
                                          {canModifyComment(comment) && (
                                            <>
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
                                            </>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
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

                                  {replies.length > 0 && (
                                    <div className="mt-2 space-y-2 border-l border-border/70 pl-3">
                                      {replies.map((reply) => (
                                        <div key={reply.id} className="group/reply flex gap-2">
                                          <Avatar className="mt-0.5 size-6 shrink-0">
                                            <AvatarFallback className="bg-secondary text-[9px] font-semibold text-secondary-foreground">
                                              {reply.user.firstName.charAt(0)}{reply.user.lastName.charAt(0)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="min-w-0 flex-1 rounded-md bg-muted/35 px-2.5 py-2">
                                            <div className="flex items-baseline gap-2">
                                              <p className="text-[11px] font-medium">{reply.user.firstName} {reply.user.lastName}</p>
                                              <span className="text-[10px] text-muted-foreground">{formatDateTime(reply.createdAt)}</span>
                                              {canModifyComment(reply) && (
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <button className="ml-auto rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover/reply:opacity-100">
                                                      <MoreHorizontal className="size-3" />
                                                    </button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                      onClick={() => {
                                                        setEditingCommentId(reply.id)
                                                        setEditingCommentContent(reply.content)
                                                      }}
                                                    >
                                                      <Pencil className="mr-2 size-3" />
                                                      Chỉnh sửa
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                      className="text-destructive focus:text-destructive"
                                                      onClick={() => deleteCommentMutation.mutate(reply.id)}
                                                    >
                                                      <Trash2 className="mr-2 size-3" />
                                                      Xóa
                                                    </DropdownMenuItem>
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              )}
                                            </div>

                                            {editingCommentId === reply.id ? (
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
                                              <p className="mt-0.5 text-sm text-muted-foreground">{reply.content}</p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            {isEditingTask && (
              <div className="border-t bg-background/95 px-6 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={leaveEditMode}>Hủy</Button>
                  <Button
                    size="sm"
                    onClick={() => updateTaskMutation.mutate()}
                    disabled={updateTaskMutation.isPending || !canSubmitTaskEdit}
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
