import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CheckCircle2, Circle, MessageSquare, Loader2, Trash2, Pencil, Timer, X, NotebookText,
  Target, CalendarClock, Calendar, Flag, AlignLeft, User, Clock,
} from 'lucide-react'
import { useUiStore } from '@/app/store/ui-store'
import { SearchableSelectPopover } from '@/components/shared/searchable-select-popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { goalApi } from '@/lib/api/modules/goal-api'
import { taskApi, type UpdateTaskPayload } from '@/lib/api/modules/task-api'
import { taskScheduleApi } from '@/lib/api/modules/task-schedule-api'
import { taskCommentApi } from '@/lib/api/modules/task-comment-api'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { queryKeys } from '@/lib/api/query-keys'
import { playTaskCompleteSound } from '@/lib/audio/play-task-complete-sound'
import {
  applyTaskCompletion,
  patchProjectTaskQueries,
  restoreProjectTaskQueries,
  snapshotProjectTaskQueries,
} from '@/lib/tasks/optimistic-task-cache'
import { useProjectPermissions } from '@/lib/permissions/use-project-permissions'
import { useTaskRealtime } from '@/lib/websocket/use-domain-realtime'
import { formatDateTime } from '@/lib/utils/datetime'
import { isNotFoundError } from '@/lib/errors/is-not-found-error'
import { TaskCommentsDialog } from '@/features/tasks/task-comments-dialog'
import { TaskPriorityBadge } from '@/features/tasks/task-priority-badge'
import type { Task, TaskComment, TaskPriorityType } from '@/types/domain'

function toDateTimeLocalValue(isoValue?: string): string {
  if (!isoValue) {
    return ''
  }

  const parsed = new Date(isoValue)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  const offsetMs = parsed.getTimezoneOffset() * 60 * 1000
  const localTime = new Date(parsed.getTime() - offsetMs)
  return localTime.toISOString().slice(0, 16)
}

function toIsoDateTime(value: string): string | undefined {
  if (!value) {
    return undefined
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  return parsed.toISOString()
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
  const openTaskDrawer = useUiStore((state) => state.openTaskDrawer)
  const openTaskDeleteConfirm = useUiStore((state) => state.openTaskDeleteConfirm)

  const queryClient = useQueryClient()

  const [newComment, setNewComment] = useState('')
  const [editTitle, setEditTitle] = useState<string | null>(null)
  const [editDescription, setEditDescription] = useState<string | null>(null)
  const [editPriority, setEditPriority] = useState<TaskPriorityType | null>(null)
  const [editGoalId, setEditGoalId] = useState<number | null>(null)
  const [editAssigneeId, setEditAssigneeId] = useState<string | null>(null)
  const [editDueDate, setEditDueDate] = useState('')
  const [editScheduleStart, setEditScheduleStart] = useState('')
  const [editScheduleEnd, setEditScheduleEnd] = useState('')
  const [activeScheduleId, setActiveScheduleId] = useState<number | null>(null)
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [editorInitKey, setEditorInitKey] = useState<string | null>(null)
  const [editorSnapshot, setEditorSnapshot] = useState<{
    title: string
    description: string
    priority: TaskPriorityType
    goalId: number | null
    assigneeId: string | null
    dueDate: string
    scheduleStart: string
    scheduleEnd: string
  } | null>(null)
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

  const goalsQuery = useQuery({
    queryKey: Number.isFinite(permissionProjectId)
      ? queryKeys.goals.byProject(permissionProjectId, 1, 100)
      : ['goals', 'drawer', taskId],
    queryFn: () => goalApi.listByProject(permissionProjectId, { page: 1, size: 100 }),
    enabled: hasTask && Number.isFinite(permissionProjectId),
  })

  const membersQuery = useQuery({
    queryKey: Number.isFinite(workspaceId) ? queryKeys.workspaces.members(workspaceId) : ['workspaces', 'members', 'drawer'],
    queryFn: () => workspaceApi.members(workspaceId),
    enabled: hasTask && Number.isFinite(workspaceId),
  })

  const schedulesQuery = useQuery({
    queryKey: queryKeys.schedules.byTask(taskId),
    queryFn: () => taskScheduleApi.listByTask(taskId),
    enabled: hasTask,
  })

  const commentsQuery = useQuery({
    queryKey: queryKeys.comments.byTask(taskId),
    queryFn: () => taskCommentApi.listByTask(taskId),
    enabled: hasTask,
  })

  const resetTransientState = () => {
    setNewComment('')
    setEditTitle(null)
    setEditDescription(null)
    setEditPriority(null)
    setEditGoalId(null)
    setEditAssigneeId(null)
    setEditDueDate('')
    setEditScheduleStart('')
    setEditScheduleEnd('')
    setActiveScheduleId(null)
    setCommentsDialogOpen(false)
    setDescriptionExpanded(false)
    setEditorInitKey(null)
    setEditorSnapshot(null)
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
        ? queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(projectId, 1, 100) })
        : Promise.resolve(),
      projectId
        ? queryClient.invalidateQueries({ queryKey: ['task-schedules', 'calendar', 'project', projectId] })
        : Promise.resolve(),
    ])
  }

  const upsertProjectTaskCache = (savedTask: Task) => {
    queryClient.setQueryData(queryKeys.tasks.detail(savedTask.id), savedTask)
    patchProjectTaskQueries(queryClient, savedTask.projectId, (tasks) => {
      const existingTaskIndex = tasks.findIndex((item) => item.id === savedTask.id)

      if (existingTaskIndex >= 0) {
        return tasks.map((item) => (item.id === savedTask.id ? savedTask : item))
      }

      return [...tasks, savedTask]
    })
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
          statuses: queryClient.getQueryData(queryKeys.statuses.byProject(currentTask.projectId)) ?? [currentTask.status],
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

      if (isNotFoundError(error)) {
        handleCloseDrawer()
        toast.success('Task đã được xóa trước đó')
        return
      }

      toast.error('Cập nhật thất bại', { description: error.message })
    },
    onSuccess: (updatedTask) => {
      if (updatedTask.isCompleted) {
        void playTaskCompleteSound()
      }
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

  const saveTaskMutation = useMutation({
    mutationFn: async () => {
      if (!taskQuery.data) throw new Error('Task không tồn tại')

      const currentTask = taskQuery.data
      const nextTitle = (editTitle ?? currentTask.title).trim()
      const nextDescription = (editDescription ?? currentTask.description ?? '').trim() || undefined
      const nextPriority = editPriority ?? currentTask.priority
      const nextGoalId = editGoalId
      const nextAssigneeId = editAssigneeId
      const dueDateIso = toIsoDateTime(editDueDate)
      const startIso = toIsoDateTime(editScheduleStart)
      const endIso = toIsoDateTime(editScheduleEnd)

      if ((startIso && !endIso) || (!startIso && endIso)) {
        throw new Error('Vui lòng nhập đầy đủ cả thời gian bắt đầu và kết thúc')
      }

      if (startIso && endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        throw new Error('Thời gian kết thúc phải lớn hơn thời gian bắt đầu')
      }

      if (taskDrawerMode === 'duplicate') {
        const createdTask = await taskApi.create({
          projectId: currentTask.projectId,
          statusId: currentTask.status.id,
          title: nextTitle,
          description: nextDescription,
          priority: nextPriority,
          goalId: nextGoalId ?? undefined,
          dueDate: dueDateIso,
          estimatedMinutes: currentTask.estimatedMinutes,
          taskTypeId: currentTask.taskType?.id,
          sourceView: currentTask.sourceView,
        })

        let duplicatedTask = createdTask

        if (nextAssigneeId) {
          duplicatedTask = await taskApi.assign(createdTask.id, nextAssigneeId)
        }

        if (startIso && endIso) {
          await taskScheduleApi.create({
            taskId: duplicatedTask.id,
            scheduledStart: startIso,
            scheduledEnd: endIso,
          })
        }

        return duplicatedTask
      }

      const payload: UpdateTaskPayload = {
        title: nextTitle,
        description: nextDescription,
        priority: nextPriority,
        dueDate: dueDateIso,
      }

      if (nextGoalId != null) {
        payload.goalId = nextGoalId
      } else if (currentTask.goalId != null) {
        payload.clearGoal = true
      }

      let updatedTask = await taskApi.update(taskId, payload)

      if ((currentTask.assignee?.userId ?? null) !== nextAssigneeId) {
        updatedTask = await taskApi.assign(taskId, nextAssigneeId ?? undefined)
      }

      if (startIso && endIso) {
        if (activeScheduleId) {
          await taskScheduleApi.update(activeScheduleId, {
            scheduledStart: startIso,
            scheduledEnd: endIso,
          })
        } else {
          await taskScheduleApi.create({
            taskId,
            scheduledStart: startIso,
            scheduledEnd: endIso,
          })
        }
      }

      return updatedTask
    },
    onSuccess: (savedTask) => {
      upsertProjectTaskCache(savedTask)
      setEditTitle(null)
      setEditDescription(null)
      setEditPriority(null)
      setEditGoalId(null)
      setEditAssigneeId(null)
      setEditDueDate('')
      setEditScheduleStart('')
      setEditScheduleEnd('')
      setActiveScheduleId(null)
      setEditorSnapshot(null)
      setEditorInitKey(null)

      if (taskDrawerMode === 'duplicate') {
        openTaskDrawer(savedTask.id, 'view')
        toast.success('Nhân bản task thành công')
      } else {
        setTaskDrawerMode('view')
        toast.success('Cập nhật task thành công')
      }

      void invalidateTaskData()
      if (savedTask.projectId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(savedTask.id) })
      }
    },
    onError: (error: Error) => {
      if (isNotFoundError(error)) {
        handleCloseDrawer()
        toast.success('Task đã được xóa trước đó')
        return
      }

      toast.error(taskDrawerMode === 'duplicate' ? 'Nhân bản task thất bại' : 'Cập nhật task thất bại', {
        description: error.message,
      })
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
  const task = taskQuery.data
  const goals = goalsQuery.data?.content ?? []
  const members = membersQuery.data ?? []
  const goalTitleById = useMemo(
    () => new Map(goals.map((goal) => [goal.id, goal.title] as const)),
    [goals],
  )
  const assigneeOptions = useMemo(
    () => [
      {
        value: '__unassigned',
        label: 'Không giao cho ai',
        description: 'Task này hiện chưa có người nhận',
        searchText: 'unassigned no assignee',
      },
      ...members.map((member) => ({
        value: member.user.userId,
        label: `${member.user.firstName} ${member.user.lastName}`,
        description: `${member.user.email} • ${member.role}`,
        searchText: `${member.user.email} ${member.role}`,
        prefix: (
          <Avatar className="size-6">
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
              {member.user.firstName.charAt(0)}{member.user.lastName.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ),
      })),
    ],
    [members],
  )
  const primarySchedule = useMemo(() => {
    const schedules = schedulesQuery.data ?? []
    if (schedules.length === 0) {
      return null
    }

    return [...schedules].sort(
      (left, right) => new Date(left.scheduledStart).getTime() - new Date(right.scheduledStart).getTime(),
    )[0]
  }, [schedulesQuery.data])

  const canManageCurrentTask = Boolean(task && permissionsReady && canManageTaskByGoal(task.goalId))
  const isDuplicateMode = taskDrawerMode === 'duplicate' && canManageCurrentTask
  const isEditingTask = (taskDrawerMode === 'edit' || taskDrawerMode === 'duplicate') && canManageCurrentTask
  const canModifyComment = (comment: TaskComment) => Boolean(
    canManageCurrentTask
    && (
      comment.user.userId === currentUserId
      || isWorkspaceManager
    ),
  )

  useEffect(() => {
    if (!task || !canManageCurrentTask || !isEditingTask) {
      return
    }

    const nextKey = `${taskDrawerMode}-${task.id}`
    if (editorInitKey === nextKey) {
      return
    }

    const initialTitle = taskDrawerMode === 'duplicate' ? `${task.title} (Copy)` : task.title
    const initialDescription = task.description ?? ''
    const initialPriority = task.priority
    const initialGoalId = task.goalId ?? null
    const initialAssigneeId = task.assignee?.userId ?? null
    const initialDueDate = toDateTimeLocalValue(task.dueDate)
    const scheduleStart = toDateTimeLocalValue(primarySchedule?.scheduledStart ?? task.dueDate)
    const scheduleEnd = toDateTimeLocalValue(primarySchedule?.scheduledEnd ?? task.dueDate)

    setEditTitle(initialTitle)
    setEditDescription(initialDescription)
    setEditPriority(initialPriority)
    setEditGoalId(initialGoalId)
    setEditAssigneeId(initialAssigneeId)
    setEditDueDate(initialDueDate)
    setEditScheduleStart(scheduleStart)
    setEditScheduleEnd(scheduleEnd)
    setActiveScheduleId(primarySchedule?.id ?? null)
    setEditorSnapshot({
      title: initialTitle,
      description: initialDescription,
      priority: initialPriority,
      goalId: initialGoalId,
      assigneeId: initialAssigneeId,
      dueDate: initialDueDate,
      scheduleStart,
      scheduleEnd,
    })
    setEditorInitKey(nextKey)
  }, [
    canManageCurrentTask,
    editorInitKey,
    isEditingTask,
    primarySchedule?.id,
    primarySchedule?.scheduledEnd,
    primarySchedule?.scheduledStart,
    task,
    taskDrawerMode,
  ])

  const enterEditMode = () => {
    if (!task || !canManageCurrentTask) return
    setEditorInitKey(null)
    setTaskDrawerMode('edit')
  }

  const leaveEditMode = () => {
    setTaskDrawerMode('view')
    setEditTitle(null)
    setEditDescription(null)
    setEditPriority(null)
    setEditGoalId(null)
    setEditAssigneeId(null)
    setEditDueDate('')
    setEditScheduleStart('')
    setEditScheduleEnd('')
    setActiveScheduleId(null)
    setEditorSnapshot(null)
    setEditorInitKey(null)
  }

  useEffect(() => {
    setCommentsDialogOpen(false)
    setDescriptionExpanded(false)
  }, [taskId])

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

  const normalizedEditorState = {
    title: (editTitle ?? '').trim(),
    description: (editDescription ?? '').trim(),
    priority: editPriority,
    goalId: editGoalId,
    assigneeId: editAssigneeId,
    dueDate: editDueDate,
    scheduleStart: editScheduleStart,
    scheduleEnd: editScheduleEnd,
  }

  const hasEditorChanges = isDuplicateMode
    ? Boolean(normalizedEditorState.title)
    : Boolean(
      editorSnapshot
      && normalizedEditorState.title === ''
        ? false
        : editorSnapshot
          ? (
            normalizedEditorState.title !== editorSnapshot.title
            || normalizedEditorState.description !== editorSnapshot.description
            || normalizedEditorState.priority !== editorSnapshot.priority
            || normalizedEditorState.goalId !== editorSnapshot.goalId
            || normalizedEditorState.assigneeId !== editorSnapshot.assigneeId
            || normalizedEditorState.dueDate !== editorSnapshot.dueDate
            || normalizedEditorState.scheduleStart !== editorSnapshot.scheduleStart
            || normalizedEditorState.scheduleEnd !== editorSnapshot.scheduleEnd
          )
          : false,
    )

  const hasLongDescription = Boolean(
    task?.description && (task.description.trim().length > 220 || task.description.includes('\n')),
  )

  return (
    <>
      <Sheet open={hasTask} onOpenChange={(open) => { if (!open) handleCloseDrawer() }}>
      <SheetContent showCloseButton={false} className="flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base">{isDuplicateMode ? 'Nhân bản task' : 'Chi tiết task'}</SheetTitle>
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
              {isEditingTask ? (
                /* ─── EDIT / DUPLICATE FORM ─── */
                <div className="space-y-5 px-6 py-5">
                  {isDuplicateMode && (
                    <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 text-xs text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
                      <span className="shrink-0 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">Draft</span>
                      Nhân bản — chỉnh sửa nội dung rồi bấm <strong className="ml-0.5">Save Duplicate</strong> để tạo.
                    </div>
                  )}

                  {/* Tiêu đề */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <AlignLeft className="size-3" /> Tiêu đề <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={editTitle ?? task.title}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Tiêu đề task..."
                      className="text-sm font-medium"
                    />
                  </div>

                  {/* Mô tả */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <AlignLeft className="size-3" /> Mô tả
                    </Label>
                    <Textarea
                      value={editDescription ?? task.description ?? ''}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Mô tả chi tiết task..."
                      rows={3}
                      className="resize-none text-sm"
                    />
                  </div>

                  {/* Ưu tiên */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Flag className="size-3" /> Mức ưu tiên
                    </Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {([
                        { value: 'LOW', label: 'Thấp', cls: 'border-slate-300 text-slate-600 data-[active=true]:bg-slate-600 data-[active=true]:text-white data-[active=true]:border-slate-600' },
                        { value: 'MEDIUM', label: 'Vừa', cls: 'border-sky-300 text-sky-600 data-[active=true]:bg-sky-500 data-[active=true]:text-white data-[active=true]:border-sky-500' },
                        { value: 'HIGH', label: 'Cao', cls: 'border-amber-300 text-amber-600 data-[active=true]:bg-amber-500 data-[active=true]:text-white data-[active=true]:border-amber-500' },
                        { value: 'URGENT', label: 'Khẩn', cls: 'border-red-300 text-red-600 data-[active=true]:bg-red-500 data-[active=true]:text-white data-[active=true]:border-red-500' },
                      ] as const).map(({ value, label, cls }) => (
                        <button
                          key={value}
                          type="button"
                          data-active={(editPriority ?? task.priority) === value}
                          className={`h-8 rounded-md border text-xs font-semibold transition-colors ${cls}`}
                          onClick={() => setEditPriority(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Goal */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Target className="size-3" /> Goal (tùy chọn)
                    </Label>
                    <Select
                      value={editGoalId != null ? String(editGoalId) : '__none'}
                      onValueChange={(value) => setEditGoalId(value === '__none' ? null : Number(value))}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Không gán goal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">
                          <span className="text-muted-foreground">Không có goal</span>
                        </SelectItem>
                        {goals.map((goal) => (
                          <SelectItem key={goal.id} value={String(goal.id)}>
                            <span className="block max-w-70 truncate" title={goal.title}>{goal.title}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <User className="size-3" /> Người nhận
                      </Label>
                      <SearchableSelectPopover
                        value={editAssigneeId ?? '__unassigned'}
                        options={assigneeOptions}
                        placeholder={membersQuery.isLoading ? 'Đang tải thành viên...' : 'Chọn người nhận'}
                        searchPlaceholder="Tìm theo tên, email hoặc vai trò..."
                        emptyLabel="Không tìm thấy thành viên phù hợp"
                        disabled={membersQuery.isLoading || membersQuery.isError}
                        triggerClassName="h-9"
                        onValueChange={(value) => setEditAssigneeId(value === '__unassigned' ? null : value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Calendar className="size-3" /> Deadline
                      </Label>
                      <Input
                        type="datetime-local"
                        step={900}
                        value={editDueDate}
                        onChange={(event) => setEditDueDate(event.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  {/* Lịch hẹn */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <CalendarClock className="size-3" /> Lịch hẹn (tùy chọn)
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">Bắt đầu</p>
                        <Input
                          type="datetime-local"
                          step={900}
                          value={editScheduleStart}
                          onChange={(event) => setEditScheduleStart(event.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">Kết thúc</p>
                        <Input
                          type="datetime-local"
                          step={900}
                          value={editScheduleEnd}
                          onChange={(event) => setEditScheduleEnd(event.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                    {editScheduleStart && editScheduleEnd && (
                      <p className="text-[11px] text-muted-foreground">
                        Thời gian kết thúc phải lớn hơn thời gian bắt đầu.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* ─── VIEW MODE ─── */
                <div className="divide-y divide-border/50">
                  {/* Title + description + quick actions */}
                  <div className="px-6 py-5">
                    <h2
                      className={`text-lg font-semibold leading-snug ${task.isCompleted ? 'text-muted-foreground line-through' : ''}`}
                      style={{ overflowWrap: 'anywhere' }}
                    >
                      {task.title}
                    </h2>
                    {task.description && (
                      <div className="mt-2">
                        <p
                          className={`whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground ${hasLongDescription && !descriptionExpanded ? 'line-clamp-4' : ''}`}
                          style={{ overflowWrap: 'anywhere' }}
                        >
                          {task.description}
                        </p>
                        {hasLongDescription && (
                          <button
                            type="button"
                            className="mt-2 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                            onClick={() => setDescriptionExpanded((value) => !value)}
                          >
                            {descriptionExpanded ? 'Thu gọn mô tả' : 'Xem thêm mô tả'}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant={task.isCompleted ? 'secondary' : 'default'}
                        className="h-8 gap-1.5 text-xs"
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
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : task.isCompleted ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : (
                          <Circle className="size-3.5" />
                        )}
                        {task.isCompleted ? 'Bỏ hoàn thành' : 'Đánh dấu hoàn thành'}
                      </Button>
                      <Button variant="outline" size="icon" className="size-8" onClick={openPomodoro} title="Pomodoro">
                        <Timer className="size-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="size-8" onClick={openNotes} title="Ghi chú">
                        <NotebookText className="size-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => setCommentsDialogOpen(true)}
                      >
                        <MessageSquare className="size-3.5" />
                        Bình luận ({comments.length})
                      </Button>
                    </div>
                  </div>

                  {/* Properties */}
                  <div className="px-6 py-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Thông tin</p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Flag className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 text-[11px] text-muted-foreground">Mức ưu tiên</p>
                          <TaskPriorityBadge priority={task.priority} />
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 size-3.5 shrink-0 rounded-sm border-2 border-muted-foreground/40" />
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 text-[11px] text-muted-foreground">Trạng thái</p>
                          <Badge
                            variant={task.status.isClosed ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {task.status.name}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <User className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 text-[11px] text-muted-foreground">Người nhận</p>
                          {task.assignee ? (
                            <div className="flex items-center gap-1.5">
                              <Avatar className="size-5">
                                <AvatarFallback className="bg-primary/10 text-[9px] font-bold text-primary">
                                  {task.assignee.firstName.charAt(0)}{task.assignee.lastName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{task.assignee.firstName} {task.assignee.lastName}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground/50">Chưa giao</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Calendar className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 text-[11px] text-muted-foreground">Hạn chót</p>
                          {task.dueDate ? (
                            <span className={`text-sm tabular-nums ${task.dueDate && !task.status.isClosed && new Date(task.dueDate) < new Date() ? 'font-semibold text-destructive' : ''}`}>
                              {formatDateTime(task.dueDate)}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground/50">Chưa đặt</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Target className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 text-[11px] text-muted-foreground">Goal</p>
                          {task.goalId ? (
                            <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">
                              <Target className="size-3 shrink-0" />
                              <span className="truncate">{goalTitleById.get(task.goalId) ?? `Goal #${task.goalId}`}</span>
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground/50">Chưa gán</span>
                          )}
                        </div>
                      </div>

                      {task.taskType && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 size-3.5 shrink-0 rounded-full border border-muted-foreground/40" />
                          <div className="min-w-0 flex-1">
                            <p className="mb-1 text-[11px] text-muted-foreground">Loại task</p>
                            <Badge
                              variant="secondary"
                              className="gap-1 text-[11px]"
                              style={task.taskType.color ? { backgroundColor: `${task.taskType.color}20`, color: task.taskType.color } : undefined}
                            >
                              {task.taskType.icon && <span>{task.taskType.icon}</span>}
                              {task.taskType.name}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Schedule */}
                  {primarySchedule && (
                    <div className="px-6 py-4">
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Lịch hẹn</p>
                      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3.5 py-2.5 text-sm">
                        <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <div className="flex items-center gap-1.5">
                              <Clock className="size-3 text-muted-foreground" />
                              <span className="text-[11px] text-muted-foreground">Bắt đầu:</span>
                              <span className="text-xs font-medium tabular-nums">{formatDateTime(primarySchedule.scheduledStart)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="size-3 text-muted-foreground" />
                              <span className="text-[11px] text-muted-foreground">Kết thúc:</span>
                              <span className="text-xs font-medium tabular-nums">{formatDateTime(primarySchedule.scheduledEnd)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  <div className="px-6 py-4">
                    <div className="rounded-2xl border bg-muted/20 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="size-4 text-primary" />
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                              Bình luận
                            </p>
                          </div>
                          <p className="mt-2 text-sm font-medium text-foreground">
                            {comments.length === 0 ? 'Chưa có trao đổi nào cho task này.' : `${comments.length} bình luận đang được thảo luận.`}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Mở cửa sổ bình luận để trả lời theo cây, chỉnh sửa nội dung dài và thu gọn hoặc mở rộng từng nhánh trao đổi.
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 shrink-0 gap-1.5 text-xs"
                          onClick={() => setCommentsDialogOpen(true)}
                        >
                          <MessageSquare className="size-3.5" />
                          Mở bình luận
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>

            {isEditingTask && (
              <div className="border-t bg-background/95 px-6 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={leaveEditMode}>Hủy</Button>
                  <Button
                    size="sm"
                    onClick={() => saveTaskMutation.mutate()}
                    disabled={saveTaskMutation.isPending || !hasEditorChanges}
                  >
                    {saveTaskMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                    {isDuplicateMode ? 'Save Duplicate' : 'Lưu thay đổi'}
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

      {task ? (
        <TaskCommentsDialog
          open={commentsDialogOpen}
          taskTitle={task.title}
          comments={comments}
          canManageCurrentTask={canManageCurrentTask}
          canModifyComment={canModifyComment}
          newComment={newComment}
          replyParentCommentId={replyParentCommentId}
          editingCommentId={editingCommentId}
          editingCommentContent={editingCommentContent}
          addCommentPending={addCommentMutation.isPending}
          updateCommentPending={updateCommentMutation.isPending}
          onOpenChange={setCommentsDialogOpen}
          onNewCommentChange={setNewComment}
          onReplyParentCommentChange={setReplyParentCommentId}
          onEditingCommentContentChange={setEditingCommentContent}
          onStartEditing={(comment) => {
            setEditingCommentId(comment.id)
            setEditingCommentContent(comment.content)
          }}
          onCancelEditing={() => {
            setEditingCommentId(null)
            setEditingCommentContent('')
          }}
          onAddComment={() => addCommentMutation.mutate()}
          onUpdateComment={() => updateCommentMutation.mutate()}
          onDeleteComment={(commentId) => deleteCommentMutation.mutate(commentId)}
        />
      ) : null}
    </>
  )
}
