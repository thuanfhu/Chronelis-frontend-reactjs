import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bot, CalendarClock, CheckCircle2, Circle, MessageSquare, NotebookText, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useUiStore } from '@/app/store/ui-store'
import { taskApi } from '@/lib/api/modules/task-api'
import { taskCommentApi } from '@/lib/api/modules/task-comment-api'
import { taskScheduleApi } from '@/lib/api/modules/task-schedule-api'
import { queryKeys } from '@/lib/api/query-keys'
import { formatDateTime } from '@/lib/utils/datetime'
import { useTaskRealtime } from '@/lib/websocket/use-domain-realtime'
import { TaskBlockerBadge } from '@/features/tasks/task-blocker-badge'
import { TaskPriorityBadge } from '@/features/tasks/task-priority-badge'

export function TaskFocusPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const location = useLocation()
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)
  const taskId = Number(params.taskId)
  const openTaskDrawer = useUiStore((state) => state.openTaskDrawer)
  const openAIAssistant = useUiStore((state) => state.openAIAssistant)
  const queryClient = useQueryClient()

  useTaskRealtime(
    Number.isFinite(workspaceId) ? workspaceId : null,
    Number.isFinite(projectId) ? projectId : null,
    Number.isFinite(taskId) ? taskId : null,
  )

  const taskQuery = useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: () => taskApi.detail(taskId),
    enabled: Number.isFinite(taskId),
  })

  const dependenciesQuery = useQuery({
    queryKey: queryKeys.tasks.dependencies(taskId),
    queryFn: () => taskApi.dependencies(taskId),
    enabled: Number.isFinite(taskId),
  })

  const commentsQuery = useQuery({
    queryKey: queryKeys.comments.byTask(taskId),
    queryFn: () => taskCommentApi.listByTask(taskId),
    enabled: Number.isFinite(taskId),
  })

  const schedulesQuery = useQuery({
    queryKey: queryKeys.schedules.byTask(taskId),
    queryFn: () => taskScheduleApi.listByTask(taskId),
    enabled: Number.isFinite(taskId),
  })

  const toggleCompletionMutation = useMutation({
    mutationFn: () => {
      if (!taskQuery.data) {
        throw new Error(t('task.notFound'))
      }

      return taskApi.updateCompletion(taskQuery.data.id, !taskQuery.data.isCompleted)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.dependencies(taskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.myWork }),
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] }),
      ])
    },
    onError: (error: Error) => {
      toast.error(t('task.focusUpdateStatusFailed'), { description: error.message })
    },
  })

  const task = taskQuery.data
  const latestComments = useMemo(() => (commentsQuery.data ?? []).slice(0, 4), [commentsQuery.data])
  const primarySchedule = useMemo(
    () => (schedulesQuery.data ?? []).slice().sort((left, right) => left.scheduledStart.localeCompare(right.scheduledStart))[0] ?? null,
    [schedulesQuery.data],
  )
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo

  const openPomodoro = () => {
    if (!task) {
      return
    }

    navigate(`/workspaces/${task.workspaceId}/projects/${task.projectId}/pomodoro/${task.id}`, {
      state: { returnTo: location.pathname },
    })
  }

  const openNotes = () => {
    if (!task) {
      return
    }

    navigate(`/workspaces/${task.workspaceId}/projects/${task.projectId}/tasks/${task.id}/notes`, {
      state: { returnTo: location.pathname },
    })
  }

  const openPlanning = () => {
    if (!task) {
      return
    }

    openAIAssistant({
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      prompt: t('task.focusPlanningPrompt', { title: task.title }),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('task.focusPageTitle')}
        description={t('task.focusPageDescription')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => navigate(returnTo ?? `/workspaces/${workspaceId}/projects/${projectId}`)}>
              <ArrowLeft className="size-4" />
              {t('task.backButton')}
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => openTaskDrawer(taskId, 'view')}>
              <MessageSquare className="size-4" />
              {t('task.openDrawerButton')}
            </Button>
          </div>
        }
      />

      {taskQuery.isLoading ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.95fr)]">
          <Skeleton className="h-104 rounded-4xl" />
          <Skeleton className="h-104 rounded-4xl" />
        </div>
      ) : task ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.95fr)]"
        >
          <Card className="overflow-hidden border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_34%),linear-gradient(160deg,rgba(255,255,255,0.96),rgba(254,249,195,0.88)_55%,rgba(191,219,254,0.55))] shadow-[0_40px_120px_-72px_rgba(15,23,42,0.48)] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_34%),linear-gradient(160deg,rgba(15,23,42,0.96),rgba(113,63,18,0.34)_55%,rgba(30,64,175,0.22))]">
            <CardContent className="space-y-6 p-6 md:p-7">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">#{task.id}</Badge>
                  <TaskPriorityBadge priority={task.priority} />
                  <Badge variant={task.status.isClosed ? 'secondary' : 'outline'}>{task.status.name}</Badge>
                </div>
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight">{task.title}</h2>
                  {task.description ? <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{task.description}</p> : null}
                </div>
                <TaskBlockerBadge task={task} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FocusInfoCard label={t('task.dueDate')} value={task.dueDate ? formatDateTime(task.dueDate) : t('task.noDueDate')} />
                <FocusInfoCard label={t('task.assigneeInfo')} value={task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : t('task.notAssigned')} />
                <FocusInfoCard label={t('task.goalLabel')} value={task.goalId ? t('task.goalShort', { id: task.goalId }) : t('task.noGoal')} />
                <FocusInfoCard label={t('task.createdAtLabel')} value={formatDateTime(task.createdAt)} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button className="gap-1.5" onClick={openPomodoro}>
                  <Timer className="size-4" />
                  {t('task.startPomodoro')}
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={openNotes}>
                  <NotebookText className="size-4" />
                  {t('task.openNotesButton')}
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={openPlanning}>
                  <Bot className="size-4" />
                  {t('task.aiBreakdownButton')}
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={() => toggleCompletionMutation.mutate()}>
                  {task.isCompleted ? <Circle className="size-4" /> : <CheckCircle2 className="size-4" />}
                  {task.isCompleted ? t('task.markIncomplete') : t('task.markComplete')}
                </Button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-border/70 bg-background/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">{t('task.focusBlockersDependencies')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {dependenciesQuery.data?.blockerNote ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-rose-900 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-100">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{t('task.blockerNoteLabel')}</p>
                        <p className="mt-1 whitespace-pre-wrap leading-6">{dependenciesQuery.data.blockerNote}</p>
                      </div>
                    ) : null}

                    <FocusDependencyList
                      title={t('task.blockedBy')}
                      tasks={dependenciesQuery.data?.blockedByTasks ?? []}
                      emptyLabel={t('task.noBlockedBy')}
                      onOpenTask={(dependencyTaskId) => openTaskDrawer(dependencyTaskId, 'view')}
                    />

                    <FocusDependencyList
                      title={t('task.blocking')}
                      tasks={dependenciesQuery.data?.blockingTasks ?? []}
                      emptyLabel={t('task.noBlocking')}
                      onOpenTask={(dependencyTaskId) => openTaskDrawer(dependencyTaskId, 'view')}
                    />
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-background/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">{t('task.focusExecutionContext')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('task.focusLatestSchedule')}</p>
                      {primarySchedule ? (
                        <div className="mt-2 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3">
                          <p className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <CalendarClock className="size-4" />
                            {formatDateTime(primarySchedule.scheduledStart)} - {formatDateTime(primarySchedule.scheduledEnd)}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-muted-foreground">{t('task.focusNoSchedule')}</p>
                      )}
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('task.focusRecentComments')}</p>
                      {latestComments.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {latestComments.map((comment) => (
                            <div key={comment.id} className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3">
                              <p className="text-[11px] font-medium text-muted-foreground">
                                {comment.user.firstName} {comment.user.lastName}
                              </p>
                              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-6">{comment.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-muted-foreground">{t('task.noComments')}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{t('task.focusChecklistTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ChecklistRow
                title={t('task.focusChecklistConfirmBlockerTitle')}
                description={task.blocked ? task.blockedReason ?? t('task.focusChecklistBlockedDescription') : t('task.focusChecklistReadyDescription')}
                done={!task.blocked}
              />
              <ChecklistRow
                title={t('task.focusChecklistOpenNotesTitle')}
                description={t('task.focusChecklistOpenNotesDescription')}
                done={Boolean(task.notesHtml?.trim())}
              />
              <ChecklistRow
                title={t('task.focusChecklistStartSessionTitle')}
                description={t('task.focusChecklistStartSessionDescription')}
                done={Boolean(primarySchedule)}
              />
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t('task.focusNotFound')}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function FocusInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background/75 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium leading-6">{value}</p>
    </div>
  )
}

function FocusDependencyList({
  title,
  tasks,
  emptyLabel,
  onOpenTask,
}: {
  title: string
  tasks: Array<{ id: number; title: string; statusName: string; priority: string }>
  emptyLabel: string
  onOpenTask: (taskId: number) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      {tasks.length > 0 ? tasks.map((dependencyTask) => (
        <button
          key={dependencyTask.id}
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 px-3.5 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
          onClick={() => onOpenTask(dependencyTask.id)}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{dependencyTask.title}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{dependencyTask.statusName} • {dependencyTask.priority}</p>
          </div>
          <span className="text-[11px] font-medium text-primary">{t('task.openTask')}</span>
        </button>
      )) : (
        <p className="text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  )
}

function ChecklistRow({ title, description, done }: { title: string; description: string; done: boolean }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-muted/20 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-full p-1 ${done ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200'}`}>
          {done ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}