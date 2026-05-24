import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Circle,
  MessageSquare,
  Loader2,
  Trash2,
  Pencil,
  Timer,
  X,
  NotebookText,
  Target,
  CalendarClock,
  Calendar,
  Flag,
  AlignLeft,
  User,
  Clock,
  Link2,
  ArrowUpRight,
  ShieldAlert,
  Shapes,
} from 'lucide-react'
import { useAuthStore } from '@/app/store/auth-store'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { goalApi } from '@/lib/api/modules/goal-api'
import { taskApi, type UpdateTaskPayload } from '@/lib/api/modules/task-api'
import { taskScheduleApi } from '@/lib/api/modules/task-schedule-api'
import { taskCommentApi } from '@/lib/api/modules/task-comment-api'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { queryKeys } from '@/lib/api/query-keys'
import { resolveTaskTypeIcon } from '@/lib/task-types/task-type-icons'
import { playTaskCompleteSound } from '@/lib/audio/play-task-complete-sound'
import {
  applyScheduleUpdate,
  applyTaskCompletion,
  patchProjectCalendarQueries,
  patchProjectTaskQueries,
  patchTaskScheduleQueries,
  restoreProjectCalendarQueries,
  restoreProjectTaskQueries,
  restoreTaskScheduleQueries,
  snapshotProjectCalendarQueries,
  snapshotProjectTaskQueries,
  snapshotTaskScheduleQueries,
  upsertById,
} from '@/lib/tasks/optimistic-task-cache'
import { useProjectPermissions } from '@/lib/permissions/use-project-permissions'
import { useTaskRealtime } from '@/lib/websocket/use-domain-realtime'
import { formatDateTime, toLocalDateTimePayload, isAfter } from '@/lib/utils/datetime'
import { cn } from '@/lib/utils/cn'
import { isNotFoundError } from '@/lib/errors/is-not-found-error'
import { TaskCommentsPanel } from '@/features/tasks/task-comments-panel'
import { TaskBlockerBadge } from '@/features/tasks/task-blocker-badge'
import { TaskPriorityBadge } from '@/features/tasks/task-priority-badge'
import type { Task, TaskComment, TaskDependencyTask, TaskPriorityType, TaskSchedule, TaskType } from '@/types/domain'

function areNumberArraysEqual(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  const sortedLeft = [...left].sort((a, b) => a - b)
  const sortedRight = [...right].sort((a, b) => a - b)

  return sortedLeft.every((value, index) => value === sortedRight[index])
}

function toDateTimeLocalValue(isoValue?: string): string {
  if (!isoValue) {
    return ''
  }

  const normalized = isoValue.trim()
  const localDateTimeMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  const hasExplicitTimeZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized)

  if (localDateTimeMatch && !hasExplicitTimeZone) {
    return `${localDateTimeMatch[1]}T${localDateTimeMatch[2]}`
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

  return toLocalDateTimePayload(value)
}

interface SaveTaskOptimisticContext {
  taskDetailSnapshot?: Task
  projectTasksSnapshot?: ReturnType<typeof snapshotProjectTaskQueries>
  projectCalendarSnapshot?: ReturnType<typeof snapshotProjectCalendarQueries>
  taskScheduleSnapshot?: ReturnType<typeof snapshotTaskScheduleQueries>
}

export function TaskDetailsDrawer() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const routeWorkspaceId = Number(params.workspaceId)
  const routeProjectId = Number(params.projectId)

  const taskDrawerTaskId = useUiStore((state) => state.taskDrawerTaskId)
  const taskDrawerMode = useUiStore((state) => state.taskDrawerMode)
  const closeTaskDrawer = useUiStore((state) => state.closeTaskDrawer)
  const setTaskDrawerMode = useUiStore((state) => state.setTaskDrawerMode)
  const openTaskDrawer = useUiStore((state) => state.openTaskDrawer)
  const openTaskDeleteConfirm = useUiStore((state) => state.openTaskDeleteConfirm)

  const currentUser = useAuthStore((state) => state.currentUser)

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
  const [editDependencyTaskIds, setEditDependencyTaskIds] = useState<number[]>([])
  const [editBlockerNote, setEditBlockerNote] = useState('')
  const [activeScheduleId, setActiveScheduleId] = useState<number | null>(null)
  const [activeDrawerPanel, setActiveDrawerPanel] = useState<'details' | 'comments'>('details')
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
    dependencyTaskIds: number[]
    blockerNote: string
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

  const resolvedWorkspaceId = Number.isFinite(routeWorkspaceId)
    ? routeWorkspaceId
    : (taskQuery.data?.workspaceId ?? Number.NaN)

  const permissionProjectId = Number.isFinite(routeProjectId)
    ? routeProjectId
    : (taskQuery.data?.projectId ?? Number.NaN)

  const { currentUserId, isWorkspaceManager, canManageTask, permissionsReady } = useProjectPermissions({
    workspaceId: resolvedWorkspaceId,
    projectId: permissionProjectId,
    enabled: Number.isFinite(resolvedWorkspaceId) && Number.isFinite(permissionProjectId),
  })

  const realtimeWorkspaceId = Number.isFinite(resolvedWorkspaceId) ? resolvedWorkspaceId : null
  const realtimeProjectId = Number.isFinite(routeProjectId) ? routeProjectId : (taskQuery.data?.projectId ?? null)

  useTaskRealtime(realtimeWorkspaceId, realtimeProjectId, hasTask ? taskId : null)

  const goalsQuery = useQuery({
    queryKey: Number.isFinite(permissionProjectId)
      ? queryKeys.goals.byProject(permissionProjectId, 1, 100)
      : ['goals', 'drawer', taskId],
    queryFn: () => goalApi.listByProject(permissionProjectId, { page: 1, size: 100 }),
    enabled: hasTask && Number.isFinite(permissionProjectId),
  })

  const membersQuery = useQuery({
    queryKey: Number.isFinite(resolvedWorkspaceId)
      ? queryKeys.workspaces.members(resolvedWorkspaceId)
      : ['workspaces', 'members', 'drawer'],
    queryFn: () => workspaceApi.members(resolvedWorkspaceId),
    enabled: hasTask && Number.isFinite(resolvedWorkspaceId),
  })

  const dependenciesQuery = useQuery({
    queryKey: queryKeys.tasks.dependencies(taskId),
    queryFn: () => taskApi.dependencies(taskId),
    enabled: hasTask,
  })

  const projectTasksQuery = useQuery({
    queryKey: Number.isFinite(permissionProjectId)
      ? queryKeys.tasks.byProject(permissionProjectId, 1, 500)
      : ['tasks', 'drawer', 'project', taskId],
    queryFn: () => taskApi.listByProject(permissionProjectId, { page: 1, size: 500 }),
    enabled: hasTask && Number.isFinite(permissionProjectId),
    staleTime: 15_000,
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
    setEditDependencyTaskIds([])
    setEditBlockerNote('')
    setActiveScheduleId(null)
    setActiveDrawerPanel('details')
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
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.dependencies(taskId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.byTask(taskId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTask(taskId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.myWork }),
      projectId ? queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] }) : Promise.resolve(),
      projectId ? queryClient.invalidateQueries({ queryKey: ['goals', projectId] }) : Promise.resolve(),
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
      if (!taskQuery.data) throw new Error(t('task.notFound'))
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
          statuses: queryClient.getQueryData(queryKeys.statuses.byProject(currentTask.projectId)) ?? [
            currentTask.status,
          ],
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
        toast.success(t('task.deletedBefore'))
        return
      }

      toast.error(t('task.updateFailed'), { description: error.message })
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
      if (!hasTask) throw new Error(t('task.notSelected'))
      return taskCommentApi.add(taskId, newComment.trim(), replyParentCommentId ?? undefined)
    },
    onMutate: async () => {
      if (!hasTask || !currentUser) {
        return {}
      }

      await queryClient.cancelQueries({ queryKey: queryKeys.comments.byTask(taskId) })

      const commentsSnapshot = queryClient.getQueryData<TaskComment[]>(queryKeys.comments.byTask(taskId))
      const optimisticCommentId = -Date.now()
      const nowIso = new Date().toISOString()

      queryClient.setQueryData<TaskComment[]>(queryKeys.comments.byTask(taskId), (oldComments) => [
        {
          id: optimisticCommentId,
          taskId,
          parentCommentId: replyParentCommentId ?? null,
          user: {
            userId: currentUser.userId,
            email: currentUser.email,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
          },
          content: newComment.trim(),
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        ...(oldComments ?? []),
      ])

      return {
        commentsSnapshot,
        optimisticCommentId,
      }
    },
    onSuccess: (savedComment, _variables, context) => {
      setNewComment('')
      setReplyParentCommentId(null)

      queryClient.setQueryData<TaskComment[]>(queryKeys.comments.byTask(taskId), (oldComments) => {
        const comments = oldComments ?? []
        const replacedComments = comments.map((comment) =>
          comment.id === context?.optimisticCommentId ? savedComment : comment,
        )

        return replacedComments.some((comment) => comment.id === savedComment.id)
          ? replacedComments
          : [savedComment, ...replacedComments]
      })

      toast.success(t('task.commentAddSuccess'))
    },
    onError: (error: Error, _variables, context) => {
      if (context?.commentsSnapshot) {
        queryClient.setQueryData(queryKeys.comments.byTask(taskId), context.commentsSnapshot)
      }

      toast.error(t('task.commentAddFailed'), { description: error.message })
    },
    onSettled: () => {
      void invalidateTaskData()
    },
  })

  const saveTaskMutation = useMutation<Task, Error, void, SaveTaskOptimisticContext | undefined>({
    mutationFn: async () => {
      if (!taskQuery.data) throw new Error(t('task.notFound'))

      const currentTask = taskQuery.data
      const nextTitle = (editTitle ?? currentTask.title).trim()
      const nextDescription = (editDescription ?? currentTask.description ?? '').trim() || undefined
      const nextPriority = editPriority ?? currentTask.priority
      const nextGoalId = editGoalId
      const nextAssigneeId = editAssigneeId
      const dueDateIso = toIsoDateTime(editDueDate)
      const startIso = toIsoDateTime(editScheduleStart)
      const endIso = toIsoDateTime(editScheduleEnd)
      const blockerNote = editBlockerNote.trim() || undefined

      if ((startIso && !endIso) || (!startIso && endIso)) {
        throw new Error(t('task.scheduleBothRequired'))
      }

      if (startIso && endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        throw new Error(t('task.scheduleEndAfterStart'))
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

        await taskApi.updateDependencies(duplicatedTask.id, {
          dependencyTaskIds: editDependencyTaskIds,
          blockerNote,
        })

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

      await taskApi.updateDependencies(taskId, {
        dependencyTaskIds: editDependencyTaskIds,
        blockerNote,
      })

      return updatedTask
    },
    onMutate: async () => {
      if (!taskQuery.data || taskDrawerMode === 'duplicate') {
        return undefined
      }

      const currentTask = taskQuery.data
      const nextTitle = (editTitle ?? currentTask.title).trim()
      const nextDescription = (editDescription ?? currentTask.description ?? '').trim() || undefined
      const nextPriority = editPriority ?? currentTask.priority
      const nextGoalId = editGoalId
      const nextAssigneeId = editAssigneeId
      const dueDateIso = toIsoDateTime(editDueDate)
      const startIso = toIsoDateTime(editScheduleStart)
      const endIso = toIsoDateTime(editScheduleEnd)

      if (!nextTitle) {
        return undefined
      }

      if ((startIso && !endIso) || (!startIso && endIso)) {
        return undefined
      }

      if (startIso && endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        return undefined
      }

      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.tasks.detail(currentTask.id) }),
        queryClient.cancelQueries({ queryKey: ['tasks', 'project', currentTask.projectId] }),
        queryClient.cancelQueries({ queryKey: ['task-schedules', 'calendar', 'project', currentTask.projectId] }),
        queryClient.cancelQueries({ queryKey: queryKeys.schedules.byTask(currentTask.id) }),
      ])

      const taskDetailSnapshot = queryClient.getQueryData<Task>(queryKeys.tasks.detail(currentTask.id))
      const projectTasksSnapshot = snapshotProjectTaskQueries(queryClient, currentTask.projectId)
      const projectCalendarSnapshot = snapshotProjectCalendarQueries(queryClient, currentTask.projectId)
      const taskScheduleSnapshot = snapshotTaskScheduleQueries(queryClient, currentTask.id)
      const nowIso = new Date().toISOString()
      const nextAssignee = nextAssigneeId
        ? membersQuery.data?.find((member) => member.user.userId === nextAssigneeId)?.user
        : undefined

      const optimisticTask: Task = {
        ...currentTask,
        title: nextTitle,
        description: nextDescription,
        goalId: nextGoalId ?? undefined,
        priority: nextPriority,
        assignee: nextAssignee,
        dueDate: dueDateIso,
        updatedAt: nowIso,
      }

      queryClient.setQueryData(queryKeys.tasks.detail(currentTask.id), optimisticTask)
      patchProjectTaskQueries(queryClient, currentTask.projectId, (tasks) =>
        tasks.map((task) => (task.id === currentTask.id ? optimisticTask : task)),
      )

      if (startIso && endIso) {
        if (activeScheduleId) {
          patchProjectCalendarQueries(queryClient, currentTask.projectId, (schedules) =>
            applyScheduleUpdate(schedules, {
              scheduleId: activeScheduleId,
              scheduledStart: startIso,
              scheduledEnd: endIso,
            }),
          )
          patchTaskScheduleQueries(queryClient, currentTask.id, (schedules) =>
            applyScheduleUpdate(schedules, {
              scheduleId: activeScheduleId,
              scheduledStart: startIso,
              scheduledEnd: endIso,
            }),
          )
        } else {
          const optimisticScheduleId = -Date.now()
          const createdBy = currentUser
            ? {
                userId: currentUser.userId,
                email: currentUser.email,
                firstName: currentUser.firstName,
                lastName: currentUser.lastName,
              }
            : currentTask.createdBy
          const optimisticSchedule: TaskSchedule = {
            id: optimisticScheduleId,
            taskId: currentTask.id,
            scheduledStart: startIso,
            scheduledEnd: endIso,
            scheduledDate: startIso.slice(0, 10),
            createdBy,
            createdAt: nowIso,
            updatedAt: nowIso,
          }

          patchProjectCalendarQueries(queryClient, currentTask.projectId, (schedules) =>
            upsertById(schedules, optimisticSchedule),
          )
          patchTaskScheduleQueries(queryClient, currentTask.id, (schedules) => upsertById(schedules, optimisticSchedule))
        }
      }

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

      return {
        taskDetailSnapshot,
        projectTasksSnapshot,
        projectCalendarSnapshot,
        taskScheduleSnapshot,
      }
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
        toast.success(t('task.duplicateSuccess'))
      } else {
        setTaskDrawerMode('view')
        toast.success(t('task.updateSuccess'))
      }

      void invalidateTaskData()
      if (savedTask.projectId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(savedTask.id) })
      }
    },
    onError: (error: Error, _variables, context) => {
      if (context?.taskDetailSnapshot) {
        queryClient.setQueryData(queryKeys.tasks.detail(context.taskDetailSnapshot.id), context.taskDetailSnapshot)
      }
      if (context?.projectTasksSnapshot) {
        restoreProjectTaskQueries(queryClient, context.projectTasksSnapshot)
      }
      if (context?.projectCalendarSnapshot) {
        restoreProjectCalendarQueries(queryClient, context.projectCalendarSnapshot)
      }
      if (context?.taskScheduleSnapshot) {
        restoreTaskScheduleQueries(queryClient, context.taskScheduleSnapshot)
      }

      if (isNotFoundError(error)) {
        handleCloseDrawer()
        toast.success(t('task.deletedBefore'))
        return
      }

      toast.error(taskDrawerMode === 'duplicate' ? t('task.duplicateFailed') : t('task.updateFailed'), {
        description: error.message,
      })
    },
  })

  const updateCommentMutation = useMutation({
    mutationFn: () => {
      if (!editingCommentId) throw new Error(t('task.commentNotFound'))
      return taskCommentApi.update(editingCommentId, editingCommentContent.trim())
    },
    onMutate: async () => {
      if (!editingCommentId) {
        return {}
      }

      await queryClient.cancelQueries({ queryKey: queryKeys.comments.byTask(taskId) })

      const commentsSnapshot = queryClient.getQueryData<TaskComment[]>(queryKeys.comments.byTask(taskId))
      const optimisticUpdatedAt = new Date().toISOString()

      queryClient.setQueryData<TaskComment[]>(queryKeys.comments.byTask(taskId), (oldComments) =>
        (oldComments ?? []).map((comment) =>
          comment.id === editingCommentId
            ? {
                ...comment,
                content: editingCommentContent.trim(),
                updatedAt: optimisticUpdatedAt,
              }
            : comment,
        ),
      )

      return {
        commentsSnapshot,
      }
    },
    onSuccess: (savedComment) => {
      setEditingCommentId(null)
      setEditingCommentContent('')

      queryClient.setQueryData<TaskComment[]>(queryKeys.comments.byTask(taskId), (oldComments) =>
        (oldComments ?? []).map((comment) => (comment.id === savedComment.id ? savedComment : comment)),
      )

      toast.success(t('task.commentUpdateSuccess'))
    },
    onError: (error: Error, _variables, context) => {
      if (context?.commentsSnapshot) {
        queryClient.setQueryData(queryKeys.comments.byTask(taskId), context.commentsSnapshot)
      }

      toast.error(t('task.commentUpdateFailed'), { description: error.message })
    },
    onSettled: () => {
      void invalidateTaskData()
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
        const stillExists = (
          queryClient.getQueryData<typeof commentsQuery.data>(queryKeys.comments.byTask(taskId)) ?? []
        ).some((comment) => comment.id === editingCommentId)
        if (!stillExists) {
          setEditingCommentId(null)
          setEditingCommentContent('')
        }
      }

      if (replyParentCommentId != null) {
        const stillExists = (
          queryClient.getQueryData<typeof commentsQuery.data>(queryKeys.comments.byTask(taskId)) ?? []
        ).some((comment) => comment.id === replyParentCommentId)
        if (!stillExists) {
          setReplyParentCommentId(null)
        }
      }

      toast.success(t('task.commentDeleteSuccess'))
    },
    onError: (error: Error, _commentId, context) => {
      if (context?.commentsSnapshot) {
        queryClient.setQueryData(queryKeys.comments.byTask(taskId), context.commentsSnapshot)
      }

      if (isNotFoundError(error)) {
        toast.success(t('task.commentDeletedBefore'))
        return
      }

      toast.error(t('task.commentDeleteFailed'), { description: error.message })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments.byTask(taskId) })
    },
  })

  const comments = commentsQuery.data ?? []
  const task = taskQuery.data
  const dependencyDetails = dependenciesQuery.data
  const goals = goalsQuery.data?.content ?? []
  const members = membersQuery.data ?? []
  const projectTasks = projectTasksQuery.data?.content ?? []
  const latestCommentPreview = useMemo(
    () =>
      [...comments].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )[0] ?? null,
    [comments],
  )
  const goalTitleById = useMemo(() => new Map(goals.map((goal) => [goal.id, goal.title] as const)), [goals])
  const assigneeOptions = useMemo(
    () => [
      {
        value: '__unassigned',
        label: t('task.unassigned'),
        description: t('task.unassignedDesc'),
        searchText: 'unassigned no assignee',
      },
      ...members.map((member) => ({
        value: member.user.userId,
        label: `${member.user.firstName} ${member.user.lastName}`,
        description: `${member.user.email} • ${member.role}`,
        searchText: `${member.user.email} ${member.role}`,
        prefix: (
          <Avatar className="size-6">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {member.user.firstName.charAt(0)}
              {member.user.lastName.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ),
      })),
    ],
    [members, t],
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

  const dependencyTaskLookup = useMemo(() => {
    const map = new Map<number, Task | TaskDependencyTask>()
    for (const projectTask of projectTasks) {
      map.set(projectTask.id, projectTask)
    }

    for (const dependencyTask of dependencyDetails?.blockedByTasks ?? []) {
      map.set(dependencyTask.id, dependencyTask)
    }

    return map
  }, [dependencyDetails?.blockedByTasks, projectTasks])

  const dependencyTaskOptions = useMemo(
    () =>
      projectTasks
        .filter((projectTask) => projectTask.id !== taskId)
        .filter((projectTask) => !editDependencyTaskIds.includes(projectTask.id))
        .map((projectTask) => ({
          value: String(projectTask.id),
          label: projectTask.title,
          description: `${projectTask.status.name} • ${projectTask.priority}${projectTask.goalId ? ` • ${t('task.goalShort', { id: projectTask.goalId })}` : ''}`,
          searchText: `${projectTask.description ?? ''} ${projectTask.priority} ${projectTask.status.name}`,
          statusName: projectTask.status.name,
          priority: projectTask.priority,
          goalId: projectTask.goalId,
        })),
    [projectTasks, taskId, t, editDependencyTaskIds],
  )

  const selectedDependencyTasks = useMemo(
    () =>
      editDependencyTaskIds
        .map((dependencyTaskId) => dependencyTaskLookup.get(dependencyTaskId))
        .filter((dependencyTask): dependencyTask is Task | TaskDependencyTask => Boolean(dependencyTask)),
    [dependencyTaskLookup, editDependencyTaskIds],
  )

  const canManageCurrentTask = Boolean(task && permissionsReady && canManageTask())
  const isDuplicateMode = taskDrawerMode === 'duplicate' && canManageCurrentTask
  const isEditingTask = (taskDrawerMode === 'edit' || taskDrawerMode === 'duplicate') && canManageCurrentTask
  const canModifyComment = (comment: TaskComment) =>
    Boolean(canManageCurrentTask && (comment.user.userId === currentUserId || isWorkspaceManager))

  useEffect(() => {
    if (!task || !canManageCurrentTask || !isEditingTask || !schedulesQuery.isFetched || !dependenciesQuery.isFetched) {
      return
    }

    const nextKey = `${taskDrawerMode}-${task.id}`
    if (editorInitKey === nextKey) {
      return
    }

    const initialTitle = task.title
    const initialDescription = task.description ?? ''
    const initialPriority = task.priority
    const initialGoalId = task.goalId ?? null
    const initialAssigneeId = task.assignee?.userId ?? null
    const initialDueDate = toDateTimeLocalValue(task.dueDate)
    const scheduleStart = toDateTimeLocalValue(primarySchedule?.scheduledStart ?? task.dueDate)
    const scheduleEnd = toDateTimeLocalValue(primarySchedule?.scheduledEnd ?? task.dueDate)
    const initialDependencyTaskIds =
      dependenciesQuery.data?.blockedByTasks.map((dependencyTask) => dependencyTask.id) ?? []
    const initialBlockerNote = dependenciesQuery.data?.blockerNote ?? ''

    setEditTitle(initialTitle)
    setEditDescription(initialDescription)
    setEditPriority(initialPriority)
    setEditGoalId(initialGoalId)
    setEditAssigneeId(initialAssigneeId)
    setEditDueDate(initialDueDate)
    setEditScheduleStart(scheduleStart)
    setEditScheduleEnd(scheduleEnd)
    setEditDependencyTaskIds(initialDependencyTaskIds)
    setEditBlockerNote(initialBlockerNote)
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
      dependencyTaskIds: initialDependencyTaskIds,
      blockerNote: initialBlockerNote,
    })
    setEditorInitKey(nextKey)
  }, [
    canManageCurrentTask,
    dependenciesQuery.data?.blockedByTasks,
    dependenciesQuery.data?.blockerNote,
    dependenciesQuery.isFetched,
    editorInitKey,
    isEditingTask,
    schedulesQuery.isFetched,
    primarySchedule?.id,
    primarySchedule?.scheduledEnd,
    primarySchedule?.scheduledStart,
    task,
    taskDrawerMode,
  ])

  const enterEditMode = () => {
    if (!task || !canManageCurrentTask) return
    setEditorInitKey(null)
    setActiveDrawerPanel('details')
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
    setEditDependencyTaskIds([])
    setEditBlockerNote('')
    setActiveScheduleId(null)
    setActiveDrawerPanel('details')
    setEditorSnapshot(null)
    setEditorInitKey(null)
  }

  useEffect(() => {
    setActiveDrawerPanel('details')
    setDescriptionExpanded(false)
  }, [taskId])

  const openPomodoro = () => {
    if (!task) return

    const resolvedProjectId = Number.isFinite(routeProjectId) ? routeProjectId : task.projectId
    if (!Number.isFinite(resolvedWorkspaceId) || !Number.isFinite(resolvedProjectId)) return

    navigate(`/workspaces/${resolvedWorkspaceId}/projects/${resolvedProjectId}/pomodoro/${task.id}`, {
      state: {
        returnTo: `${location.pathname}${location.search}`,
      },
    })
    handleCloseDrawer()
  }

  const openNotes = () => {
    if (!task) return

    const resolvedProjectId = Number.isFinite(routeProjectId) ? routeProjectId : task.projectId
    if (!Number.isFinite(resolvedWorkspaceId) || !Number.isFinite(resolvedProjectId)) return

    navigate(`/workspaces/${resolvedWorkspaceId}/projects/${resolvedProjectId}/tasks/${task.id}/notes`, {
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
    dependencyTaskIds: [...editDependencyTaskIds].sort((left, right) => left - right),
    blockerNote: editBlockerNote.trim(),
  }

  const hasEditorChanges = isDuplicateMode
    ? Boolean(normalizedEditorState.title)
    : Boolean(
        editorSnapshot && normalizedEditorState.title === ''
          ? false
          : editorSnapshot
            ? normalizedEditorState.title !== editorSnapshot.title ||
              normalizedEditorState.description !== editorSnapshot.description ||
              normalizedEditorState.priority !== editorSnapshot.priority ||
              normalizedEditorState.goalId !== editorSnapshot.goalId ||
              normalizedEditorState.assigneeId !== editorSnapshot.assigneeId ||
              normalizedEditorState.dueDate !== editorSnapshot.dueDate ||
              normalizedEditorState.scheduleStart !== editorSnapshot.scheduleStart ||
              normalizedEditorState.scheduleEnd !== editorSnapshot.scheduleEnd ||
              !areNumberArraysEqual(normalizedEditorState.dependencyTaskIds, editorSnapshot.dependencyTaskIds) ||
              normalizedEditorState.blockerNote !== editorSnapshot.blockerNote.trim()
            : false,
      )

  const hasLongDescription = Boolean(
    task?.description && (task.description.trim().length > 220 || task.description.includes('\n')),
  )

  return (
    <>
      <Sheet
        open={hasTask}
        onOpenChange={(open) => {
          if (!open) handleCloseDrawer()
        }}
      >
        <SheetContent
          showCloseButton={false}
          className="flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden overflow-x-hidden p-0 sm:max-w-xl task-detail-font"
        >
          <SheetHeader className="border-b px-4 sm:px-6 py-3.5 sm:py-4">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base">
                {isDuplicateMode ? t('task.duplicateTitle') : t('task.detailTitle')}
              </SheetTitle>
              <Badge variant="outline" className="text-xs">
                #{taskId}
              </Badge>

              <div className="ml-auto flex items-center gap-1">
                {task && !isEditingTask && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`size-7 ${activeDrawerPanel === 'comments' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() =>
                      setActiveDrawerPanel((currentPanel) => (currentPanel === 'comments' ? 'details' : 'comments'))
                    }
                    title={activeDrawerPanel === 'comments' ? t('task.backToDetail') : t('task.viewComments')}
                  >
                    <MessageSquare className="size-3.5" />
                  </Button>
                )}
                {task && canManageCurrentTask && !isEditingTask && (
                  <Button variant="ghost" size="icon" className="size-7" onClick={enterEditMode}>
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
            <SheetDescription className="sr-only">{t('task.detailDescription')}</SheetDescription>
          </SheetHeader>

          {taskQuery.isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : task ? (
            <>
              <div className="min-h-0 flex-1 overflow-hidden overflow-x-hidden">
                {isEditingTask ? (
                  /* ─── EDIT / DUPLICATE FORM ─── */
                  <ScrollArea className="h-full">
                    <div className="space-y-4 sm:space-y-5 px-4 sm:px-6 py-4 sm:py-5">
                      {isDuplicateMode && (
                        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 text-xs text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
                          <span className="shrink-0 rounded bg-sky-500/20 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide">
                            {t('task.draftBadge')}
                          </span>
                          {t('task.duplicateBanner')}
                        </div>
                      )}

                      {/* Tiêu đề */}
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <AlignLeft className="size-3" /> {t('task.titleLabel')}{' '}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          value={editTitle ?? task.title}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder={t('task.titlePlaceholderShort')}
                          className="text-sm font-medium"
                        />
                      </div>

                      {/* Mô tả */}
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <AlignLeft className="size-3" /> {t('task.descriptionLabel')}
                        </Label>
                        <Textarea
                          value={editDescription ?? task.description ?? ''}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder={t('task.descriptionPlaceholderShort')}
                          rows={3}
                          className="resize-none text-sm"
                        />
                      </div>

                      {/* Ưu tiên */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <Flag className="size-3" /> {t('task.priorityLabel')}
                        </Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {(
                            [
                              {
                                value: 'LOW',
                                label: t('task.priorityLow'),
                                cls: 'border-slate-300 text-slate-600 data-[active=true]:bg-slate-600 data-[active=true]:text-white data-[active=true]:border-slate-600',
                              },
                              {
                                value: 'MEDIUM',
                                label: t('task.priorityMedium'),
                                cls: 'border-sky-300 text-sky-600 data-[active=true]:bg-sky-500 data-[active=true]:text-white data-[active=true]:border-sky-500',
                              },
                              {
                                value: 'HIGH',
                                label: t('task.priorityHigh'),
                                cls: 'border-amber-300 text-amber-600 data-[active=true]:bg-amber-500 data-[active=true]:text-white data-[active=true]:border-amber-500',
                              },
                              {
                                value: 'URGENT',
                                label: t('task.priorityUrgent'),
                                cls: 'border-red-300 text-red-600 data-[active=true]:bg-red-500 data-[active=true]:text-white data-[active=true]:border-red-500',
                              },
                            ] as const
                          ).map(({ value, label, cls }) => (
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
                          <Target className="size-3" /> {t('task.goalOptional')}
                        </Label>
                        <Select
                          value={editGoalId != null ? String(editGoalId) : '__none'}
                          onValueChange={(value) => setEditGoalId(value === '__none' ? null : Number(value))}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder={t('task.goalNonePlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">
                              <span className="text-muted-foreground">{t('task.goalNoneOption')}</span>
                            </SelectItem>
                            {goals.map((goal) => (
                              <SelectItem key={goal.id} value={String(goal.id)}>
                                <span className="block max-w-70 truncate" title={goal.title}>
                                  {goal.title}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <User className="size-3" /> {t('task.assigneeLabel')}
                          </Label>
                          <SearchableSelectPopover
                            value={editAssigneeId ?? '__unassigned'}
                            options={assigneeOptions}
                            placeholder={membersQuery.isLoading ? t('task.loadingMembers') : t('task.selectAssignee')}
                            searchPlaceholder={t('task.searchAssignee')}
                            emptyLabel={t('task.noMemberFound')}
                            disabled={membersQuery.isLoading || membersQuery.isError}
                            triggerClassName="h-9"
                            onValueChange={(value) => setEditAssigneeId(value === '__unassigned' ? null : value)}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <Calendar className="size-3" /> {t('task.deadline')}
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
                          <CalendarClock className="size-3" /> {t('task.scheduleOptionalLabel')}
                        </Label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">{t('task.scheduleStartLabel')}</p>
                            <Input
                              type="datetime-local"
                              step={900}
                              value={editScheduleStart}
                              onChange={(event) => setEditScheduleStart(event.target.value)}
                              className="h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">{t('task.scheduleEndLabel')}</p>
                            <Input
                              type="datetime-local"
                              step={900}
                              value={editScheduleEnd}
                              onChange={(event) => setEditScheduleEnd(event.target.value)}
                              className="h-9 text-xs"
                            />
                          </div>
                        </div>
                        {editScheduleStart && editScheduleEnd && !isAfter(editScheduleEnd, editScheduleStart) && (
                          <p className="text-xs text-destructive">{t('task.scheduleEndValidation')}</p>
                        )}
                      </div>

                      <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/25 p-4">
                        <div className="space-y-1">
                          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <Link2 className="size-3" /> {t('task.dependenciesBlockers')}
                          </Label>
                          <p className="text-xs leading-5 text-muted-foreground">{t('task.dependenciesHelp')}</p>
                        </div>

                        <SearchableSelectPopover
                          value={undefined}
                          options={dependencyTaskOptions}
                          placeholder={
                            projectTasksQuery.isLoading ? t('task.loadingTasks') : t('task.searchDependency')
                          }
                          searchPlaceholder={t('task.searchDependencyPlaceholder')}
                          emptyLabel={t('task.noTaskFound')}
                          disabled={projectTasksQuery.isLoading || projectTasksQuery.isError}
                          triggerClassName="h-9"
                          onValueChange={(value) => {
                            const nextDependencyId = Number(value)
                            if (!Number.isFinite(nextDependencyId)) return
                            setEditDependencyTaskIds((current) =>
                              current.includes(nextDependencyId) ? current : [...current, nextDependencyId],
                            )
                          }}
                        />

                        {selectedDependencyTasks.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">
                              {t('task.dependencySelected', { count: selectedDependencyTasks.length })}
                            </p>
                            <div className="grid gap-2">
                              {selectedDependencyTasks.map((dependencyTask) => (
                                <div
                                  key={dependencyTask.id}
                                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm w-full max-w-full overflow-hidden transition-colors hover:bg-muted/30"
                                >
                                  <div className="flex flex-col gap-0.5 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-medium truncate" title={dependencyTask.title}>
                                        {dependencyTask.title}
                                      </span>
                                      <span className="text-xs text-muted-foreground/70 font-normal shrink-0 ml-auto">
                                        #{dependencyTask.id}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs mt-1 w-full">
                                      <span
                                        className={cn(
                                          'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-medium border shrink-0 w-fit',
                                          (() => {
                                            const name = (
                                              'status' in dependencyTask
                                                ? dependencyTask.status.name
                                                : dependencyTask.statusName
                                            ).toLowerCase()
                                            if (name.includes('todo') || name.includes('to do'))
                                              return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                            if (name.includes('progress') || name.includes('doing'))
                                              return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800'
                                            if (name.includes('done') || name.includes('complete'))
                                              return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800'
                                            return 'bg-background text-muted-foreground border-border/70'
                                          })(),
                                        )}
                                      >
                                        {'status' in dependencyTask
                                          ? dependencyTask.status.name
                                          : dependencyTask.statusName}
                                      </span>

                                      <span
                                        className={cn(
                                          'inline-flex items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border shrink-0 w-fit',
                                          dependencyTask.priority === 'LOW' &&
                                            'border-emerald-800/60 bg-emerald-700/30 text-emerald-950 dark:border-emerald-200/70 dark:bg-emerald-500/44 dark:text-emerald-50',
                                          dependencyTask.priority === 'MEDIUM' &&
                                            'border-blue-700/60 bg-blue-600/30 text-blue-950 dark:border-blue-300/70 dark:bg-blue-500/40 dark:text-blue-50',
                                          dependencyTask.priority === 'HIGH' &&
                                            'border-orange-700/60 bg-orange-600/30 text-orange-950 dark:border-orange-300/70 dark:bg-orange-500/40 dark:text-orange-50',
                                          dependencyTask.priority === 'URGENT' &&
                                            'border-rose-700/60 bg-rose-600/30 text-rose-950 dark:border-rose-300/70 dark:bg-rose-500/42 dark:text-rose-50',
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            'inline-block size-1 rounded-full shrink-0',
                                            dependencyTask.priority === 'LOW' && 'bg-emerald-800 dark:bg-emerald-200',
                                            dependencyTask.priority === 'MEDIUM' && 'bg-blue-700 dark:bg-blue-300',
                                            dependencyTask.priority === 'HIGH' && 'bg-orange-700 dark:bg-orange-300',
                                            dependencyTask.priority === 'URGENT' && 'bg-rose-700 dark:bg-rose-300',
                                          )}
                                        />
                                        {dependencyTask.priority}
                                      </span>

                                      {dependencyTask.goalId ? (
                                        <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 border border-violet-200/50 dark:bg-violet-900/50 dark:text-violet-300 shrink-0 w-fit">
                                          {t('task.goalShort', { id: dependencyTask.goalId })}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full shrink-0 transition-colors"
                                    onClick={() =>
                                      setEditDependencyTaskIds((current) =>
                                        current.filter((id) => id !== dependencyTask.id),
                                      )
                                    }
                                  >
                                    <X className="size-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">{t('task.noDependency')}</p>
                        )}

                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">
                            {t('task.blockerNoteLabel')}
                          </Label>
                          <Textarea
                            value={editBlockerNote}
                            onChange={(event) => setEditBlockerNote(event.target.value)}
                            placeholder={t('task.blockerNotePlaceholderLong')}
                            rows={3}
                            className="resize-none text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  /* ─── VIEW MODE ─── */
                  <div className="relative h-full overflow-hidden bg-background">
                    <AnimatePresence initial={false} mode="wait">
                      {activeDrawerPanel === 'details' ? (
                        <motion.div
                          key="details"
                          initial={{ x: -36, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: 36, opacity: 0 }}
                          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                          className="absolute inset-0"
                        >
                          <ScrollArea className="h-full">
                            <div className="divide-y divide-border/50 pb-6">
                              {/* Title + description + quick actions */}
                              <div className="px-4 sm:px-6 py-4 sm:py-5">
                                <h2
                                  className={`break-words text-xl font-semibold leading-snug ${task.isCompleted ? 'text-muted-foreground line-through' : ''}`}
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
                                        {descriptionExpanded ? t('common.showLess') : t('common.showMore')}
                                      </button>
                                    )}
                                  </div>
                                )}

                                <div className="mt-4 flex w-full flex-wrap items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant={task.isCompleted ? 'secondary' : 'default'}
                                    className="h-9 flex-1 gap-1.5 text-xs min-w-0 shrink"
                                    onClick={() => {
                                      if (!canManageCurrentTask) {
                                        toast.error(t('task.noPermission'))
                                        return
                                      }
                                      toggleCompletionMutation.mutate()
                                    }}
                                    disabled={toggleCompletionMutation.isPending || !canManageCurrentTask}
                                  >
                                    {toggleCompletionMutation.isPending ? (
                                      <Loader2 className="size-3.5 animate-spin shrink-0" />
                                    ) : task.isCompleted ? (
                                      <CheckCircle2 className="size-3.5 shrink-0" />
                                    ) : (
                                      <Circle className="size-3.5 shrink-0" />
                                    )}
                                    <span className="truncate">
                                      {task.isCompleted ? t('task.markIncomplete') : t('task.markComplete')}
                                    </span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-9 shrink-0"
                                    onClick={openPomodoro}
                                    title={t('task.pomodoroTitle')}
                                  >
                                    <Timer className="size-3.5" />
                                  </Button>

                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-9 shrink-0"
                                    onClick={openNotes}
                                    title={t('task.notesButton')}
                                  >
                                    <NotebookText className="size-3.5" />
                                  </Button>
                                </div>

                                <TaskBlockerBadge task={task} className="mt-3" />

                                <div className="mt-5 rounded-[28px] border border-border/70 bg-[linear-gradient(135deg,rgba(59,130,246,0.08),rgba(14,165,233,0.02)_58%,rgba(255,255,255,0.9))] p-4 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.24)] dark:bg-[linear-gradient(135deg,rgba(59,130,246,0.16),rgba(14,165,233,0.05)_55%,rgba(15,23,42,0.72))]">
                                  <div className="flex items-start gap-3">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner shadow-primary/10">
                                      <MessageSquare className="size-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold">{t('common.commentSection')}</p>
                                            <span className="inline-flex h-6 items-center rounded-full border border-border/70 bg-background/75 px-2.5 text-xs font-medium text-muted-foreground dark:bg-background/20">
                                              {t('common.commentCount', { count: comments.length })}
                                            </span>
                                          </div>
                                          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                                            {t('common.commentSectionDesc')}
                                          </p>
                                        </div>

                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          className="h-8 w-fit shrink-0 gap-1.5 rounded-full px-3 text-xs"
                                          onClick={() => setActiveDrawerPanel('comments')}
                                        >
                                          <MessageSquare className="size-3.5" />
                                          {comments.length > 0
                                            ? t('task.openCommentsAction')
                                            : t('task.startConversationAction')}
                                        </Button>
                                      </div>

                                      {latestCommentPreview ? (
                                        <div className="mt-3 rounded-[22px] border border-border/70 bg-background/75 px-3.5 py-3 dark:bg-background/15">
                                          <p className="text-xs font-medium text-muted-foreground">
                                            {t('task.latestCommentBy', {
                                              name: `${latestCommentPreview.user.firstName} ${latestCommentPreview.user.lastName}`,
                                            })}
                                          </p>
                                          <p
                                            className="mt-1 line-clamp-2 min-w-0 break-words text-xs leading-6 text-foreground/80"
                                            style={{ overflowWrap: 'anywhere' }}
                                          >
                                            {latestCommentPreview.content}
                                          </p>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Properties */}
                              <div className="px-4 sm:px-6 py-3.5 sm:py-4">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                                  {t('task.info')}
                                </p>
                                <div className="space-y-3">
                                  <div className="flex items-start gap-3">
                                    <Flag className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                    <div className="min-w-0 flex-1">
                                      <p className="mb-1 text-xs text-muted-foreground">{t('task.priorityLabel')}</p>
                                      <TaskPriorityBadge priority={task.priority} />
                                    </div>
                                  </div>

                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5 size-3.5 shrink-0 rounded-sm border-2 border-muted-foreground/40" />
                                    <div className="min-w-0 flex-1">
                                      <p className="mb-1 text-xs text-muted-foreground">{t('task.statusLabel')}</p>
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
                                      <p className="mb-1 text-xs text-muted-foreground">{t('task.assigneeInfo')}</p>
                                      {task.assignee ? (
                                        <div className="flex items-center gap-1.5">
                                          <Avatar className="size-5">
                                            <AvatarFallback className="bg-primary/10 text-[9px] font-bold text-primary">
                                              {task.assignee.firstName.charAt(0)}
                                              {task.assignee.lastName.charAt(0)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="text-sm">
                                            {task.assignee.firstName} {task.assignee.lastName}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-sm text-muted-foreground/50">
                                          {t('task.notAssigned')}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-start gap-3">
                                    <Calendar className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                    <div className="min-w-0 flex-1">
                                      <p className="mb-1 text-xs text-muted-foreground">{t('task.dueDate')}</p>
                                      {task.dueDate ? (
                                        <span
                                          className={`text-sm tabular-nums ${task.dueDate && !task.status.isClosed && new Date(task.dueDate) < new Date() ? 'font-semibold text-destructive' : ''}`}
                                        >
                                          {formatDateTime(task.dueDate)}
                                        </span>
                                      ) : (
                                        <span className="text-sm text-muted-foreground/50">{t('task.noDueDate')}</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-start gap-3">
                                    <Target className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                    <div className="min-w-0 flex-1">
                                      <p className="mb-1 text-xs text-muted-foreground">{t('task.goalLabel')}</p>
                                      {task.goalId ? (
                                        <span className="inline-flex max-w-full min-w-0 flex-wrap items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">
                                          <span className="min-w-0 break-words">
                                            {goalTitleById.get(task.goalId) ?? t('task.goalShort', { id: task.goalId })}
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="text-sm text-muted-foreground/50">{t('task.noGoal')}</span>
                                      )}
                                    </div>
                                  </div>

                                  {task.taskType && (
                                    <TaskTypeInfoBlock taskType={task.taskType} label={t('task.taskTypeLabel')} />
                                  )}
                                </div>
                              </div>

                              <div className="px-4 sm:px-6 py-3.5 sm:py-4">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                                  {t('task.dependenciesBlockers')}
                                </p>
                                <div className="space-y-3">
                                  {dependencyDetails?.blockerNote ? (
                                    <div className="relative overflow-hidden rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm">
                                      <div className="absolute left-0 top-0 h-full w-1 bg-destructive" />
                                      <div className="flex items-start gap-2">
                                        <ShieldAlert className="size-4 text-destructive mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-destructive">
                                            {t('task.blockerNoteLabel')}
                                          </p>
                                          <p className="mt-1 break-words text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                                            {dependencyDetails.blockerNote}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ) : null}

                                  <DependencyTaskList
                                    title={t('task.blockedBy')}
                                    emptyLabel={t('task.noBlockedBy')}
                                    tasks={dependencyDetails?.blockedByTasks ?? []}
                                    onOpenTask={(dependencyTaskId) => openTaskDrawer(dependencyTaskId, 'view')}
                                  />

                                  <DependencyTaskList
                                    title={t('task.blocking')}
                                    emptyLabel={t('task.noBlocking')}
                                    tasks={dependencyDetails?.blockingTasks ?? []}
                                    onOpenTask={(dependencyTaskId) => openTaskDrawer(dependencyTaskId, 'view')}
                                  />
                                </div>
                              </div>

                              {/* Schedule */}
                              {primarySchedule && (
                                <div className="px-4 sm:px-6 py-3.5 sm:py-4">
                                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                                    {t('task.scheduleLabel')}
                                  </p>
                                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3.5 py-2.5 text-sm">
                                    <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <Clock className="size-3 text-muted-foreground" />
                                          <span className="text-xs text-muted-foreground">
                                            {t('task.scheduleStartView')}
                                          </span>
                                          <span className="text-xs font-medium tabular-nums">
                                            {formatDateTime(primarySchedule.scheduledStart)}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <Clock className="size-3 text-muted-foreground" />
                                          <span className="text-xs text-muted-foreground">
                                            {t('task.scheduleEndView')}
                                          </span>
                                          <span className="text-xs font-medium tabular-nums">
                                            {formatDateTime(primarySchedule.scheduledEnd)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="comments"
                          initial={{ x: 36, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: -36, opacity: 0 }}
                          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                          className="absolute inset-0"
                        >
                          <ScrollArea className="h-full">
                            <TaskCommentsPanel
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
                              onBack={() => setActiveDrawerPanel('details')}
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
                          </ScrollArea>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {isEditingTask && (
                <div className="border-t bg-background/95 px-4 sm:px-6 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={leaveEditMode}>
                      {t('task.cancel')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveTaskMutation.mutate()}
                      disabled={saveTaskMutation.isPending || !hasEditorChanges}
                    >
                      {saveTaskMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                      {t('task.saveChanges')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">{t('task.notFoundPage')}</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function DependencyTaskList({
  title,
  emptyLabel,
  tasks,
  onOpenTask,
}: {
  title: string
  emptyLabel: string
  tasks: TaskDependencyTask[]
  onOpenTask: (taskId: number) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">{title}</p>
        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 min-w-5 justify-center rounded-full">
          {tasks.length}
        </Badge>
      </div>

      {tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map((dependencyTask) => (
            <button
              key={dependencyTask.id}
              type="button"
              className="flex w-full items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/50 p-3.5 text-left transition-all hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm"
              onClick={() => onOpenTask(dependencyTask.id)}
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 break-words text-sm font-medium text-foreground/90">
                    {dependencyTask.title}
                  </span>
                  <span className="text-xs text-muted-foreground/70 shrink-0">#{dependencyTask.id}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/80">
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {dependencyTask.statusName}
                  </Badge>
                  <span>{dependencyTask.priority}</span>
                  {dependencyTask.goalId ? <span>{t('task.goalShort', { id: dependencyTask.goalId })}</span> : null}
                </div>
              </div>
              <span
                className="text-primary/70 transition-colors flex items-center justify-center rounded-md p-1 hover:text-primary"
                title={t('task.openTask')}
              >
                <ArrowUpRight className="size-3.5" />
                <span className="sr-only">{t('task.openTask')}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground/70">
          <Link2 className="size-4 opacity-50" />
          <span className="min-w-0 flex-1 break-words">{emptyLabel}</span>
        </div>
      )}
    </div>
  )
}

function TaskTypeInfoBlock({ taskType, label }: { taskType: TaskType; label: string }) {
  const TaskTypeIcon = resolveTaskTypeIcon(taskType.icon)
  const color = taskType.color ?? '#3B82F6'

  return (
    <div className="flex items-start gap-3">
      <Shapes className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs text-muted-foreground">{label}</p>
        <span
          className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold"
          style={{ backgroundColor: `${color}18`, borderColor: `${color}55`, color }}
        >
          <TaskTypeIcon className="size-4 shrink-0" />
          <span className="min-w-0 break-words">{taskType.name}</span>
        </span>
      </div>
    </div>
  )
}
