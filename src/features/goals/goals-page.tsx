import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Plus,
  Target,
  Loader2,
  Timer,
  Clock,
  Milestone,
  MoreHorizontal,
  Pencil,
  Trash2,
  CircleDashed,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  ListTodo,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { DeferredDeleteStack } from '@/components/shared/deferred-delete-stack'
import { goalApi } from '@/lib/api/modules/goal-api'
import { projectApi } from '@/lib/api/modules/project-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { workspaceTeamApi } from '@/lib/api/modules/workspace-team-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
import { useAuthStore } from '@/app/store/auth-store'
import { useDeferredDelete } from '@/lib/delete/use-deferred-delete'
import type { Goal, GoalStatusType, GoalType, Task, WorkspaceMemberRoleType } from '@/types/domain'
import type { PageResult } from '@/types/domain'

const goalTypeConfig: Record<GoalType, { icon: typeof Timer; color: string }> = {
  SHORT_TERM: { icon: Timer, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  MEDIUM_TERM: { icon: Clock, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  LONG_TERM: { icon: Milestone, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
}

const goalStatusConfig: Record<GoalStatusType, { icon: typeof CircleDashed; className: string }> = {
  NOT_STARTED: {
    icon: CircleDashed,
    className: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-100',
  },
  IN_PROGRESS: {
    icon: PlayCircle,
    className: 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-100',
  },
  ON_HOLD: {
    icon: PauseCircle,
    className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-100',
  },
  COMPLETED: {
    icon: CheckCircle2,
    className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-100',
  },
}

function GoalStatusBadge({ status }: { status: GoalStatusType }) {
  const { t } = useTranslation()
  const config = goalStatusConfig[status]
  const Icon = config.icon
  const label = t(`goals.status.${status}`)

  return (
    <span
      className={`inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[10px] font-semibold ${config.className}`}
      title={label}
    >
      <Icon className="size-3" />
      {label}
    </span>
  )
}

function compareGoalTasks(left: Task, right: Task): number {
  if (left.status.position !== right.status.position) {
    return left.status.position - right.status.position
  }

  if (left.boardPosition !== right.boardPosition) {
    return left.boardPosition - right.boardPosition
  }

  const leftCreatedAt = new Date(left.createdAt).getTime()
  const rightCreatedAt = new Date(right.createdAt).getTime()
  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt
  }

  return left.id - right.id
}

export function GoalsPage() {
  const { t } = useTranslation()
  const params = useParams()
  const projectId = Number(params.projectId)
  const workspaceId = Number(params.workspaceId)
  const queryClient = useQueryClient()
  const currentUserId = useAuthStore((state) => state.currentUser?.userId ?? null)

  useProjectRealtime(Number.isFinite(workspaceId) ? workspaceId : null, Number.isFinite(projectId) ? projectId : null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [goalType, setGoalType] = useState<GoalType>('SHORT_TERM')
  const [status, setStatus] = useState<GoalStatusType>('NOT_STARTED')
  const [managerUserId, setManagerUserId] = useState('')
  const [managerTeamId, setManagerTeamId] = useState('')

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editGoal, setEditGoal] = useState<Goal | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editGoalType, setEditGoalType] = useState<GoalType>('SHORT_TERM')
  const [editStatus, setEditStatus] = useState<GoalStatusType>('NOT_STARTED')
  const [editManagerUserId, setEditManagerUserId] = useState('')
  const [editManagerTeamId, setEditManagerTeamId] = useState('')
  const [editInitialTitle, setEditInitialTitle] = useState('')
  const [editInitialGoalType, setEditInitialGoalType] = useState<GoalType>('SHORT_TERM')
  const [editInitialStatus, setEditInitialStatus] = useState<GoalStatusType>('NOT_STARTED')
  const [editInitialManagerUserId, setEditInitialManagerUserId] = useState('')
  const [editInitialManagerTeamId, setEditInitialManagerTeamId] = useState('')

  const [deleteGoalTarget, setDeleteGoalTarget] = useState<{ id: number; title: string } | null>(null)

  const projectQuery = useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => projectApi.detail(projectId),
    enabled: Number.isFinite(projectId),
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId),
    queryFn: () => workspaceApi.members(workspaceId),
    enabled: Number.isFinite(workspaceId),
  })

  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId),
    queryFn: () => workspaceApi.detail(workspaceId),
    enabled: Number.isFinite(workspaceId),
  })

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams.byWorkspace(workspaceId),
    queryFn: () => workspaceTeamApi.listByWorkspace(workspaceId),
    enabled: Number.isFinite(workspaceId),
  })

  const teamMembershipQuery = useQuery({
    queryKey: ['workspace-teams', 'membership-map', workspaceId, (teamsQuery.data ?? []).map((team) => team.id).join(',')],
    queryFn: async () => {
      const entries = await Promise.all(
        (teamsQuery.data ?? []).map(async (team) => {
          try {
            const teamMembers = await workspaceTeamApi.listMembers(team.id)
            return [team.id, new Set(teamMembers.map((member) => member.user.userId))] as const
          } catch {
            return [team.id, new Set<string>()] as const
          }
        }),
      )

      return new Map<number, Set<string>>(entries)
    },
    enabled: Number.isFinite(workspaceId) && Boolean(currentUserId) && (teamsQuery.data?.length ?? 0) > 0,
  })

  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.byProject(projectId, 1, 50),
    queryFn: () => goalApi.listByProject(projectId, { page: 1, size: 50 }),
    enabled: Number.isFinite(projectId),
  })

  const goalTasksQuery = useQuery({
    queryKey: queryKeys.tasks.byProject(projectId, 1, 500),
    queryFn: () => taskApi.listByProject(projectId, { page: 1, size: 500 }),
    enabled: Number.isFinite(projectId),
  })

  const members = membersQuery.data ?? []
  const teams = teamsQuery.data ?? []
  const project = projectQuery.data ?? null
  const currentMember = members.find((member) => member.user.userId === currentUserId)
  const currentRole: WorkspaceMemberRoleType = workspaceQuery.data?.owner.userId === currentUserId
    ? 'OWNER'
    : currentMember?.role ?? 'MEMBER'
  const isOwner = currentRole === 'OWNER'
  const isWorkspaceManager = isOwner
  const teamMembershipMap = teamMembershipQuery.data ?? new Map<number, Set<string>>()
  const isCurrentUserInManagerTeam = (teamId?: number) => Boolean(
    teamId
    && currentUserId
    && teamMembershipMap.get(teamId)?.has(currentUserId),
  )
  const canManageProject = isWorkspaceManager
    || project?.managerUser?.userId === currentUserId
    || isCurrentUserInManagerTeam(project?.managerTeamId)
  const canManageGoal = (goal: Goal) => canManageProject
    || goal.managerUser?.userId === currentUserId
    || isCurrentUserInManagerTeam(goal.managerTeamId)
  const currentRoleLabel = t(`workspace.role.${currentRole.toLowerCase()}`)
  const getMemberRoleLabel = (role: WorkspaceMemberRoleType) => t(`workspace.role.${role.toLowerCase()}`)

  const createMutation = useMutation({
    mutationFn: () => {
      const payload: {
        projectId: number
        title: string
        goalType: GoalType
        status: GoalStatusType
        progressPercent: number
        managerUserId?: string
        managerTeamId?: number
      } = {
        projectId,
        title: title.trim(),
        goalType,
        status,
        progressPercent: 0,
      }

      if (isOwner) {
        payload.managerUserId = managerUserId || undefined
        payload.managerTeamId = managerTeamId ? Number(managerTeamId) : undefined
      }

      return goalApi.create(payload)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.goals.byProject(projectId, 1, 50) })
      const snapshot = queryClient.getQueryData<PageResult<Goal>>(queryKeys.goals.byProject(projectId, 1, 50))
      const user = useAuthStore.getState().currentUser
      const optimisticGoal: Goal = {
        id: -Date.now(),
        projectId,
        title: title.trim(),
        goalType,
        status,
        progressPercent: 0,
        createdBy: { userId: user?.userId ?? '', email: user?.email ?? '', firstName: user?.firstName ?? '', lastName: user?.lastName ?? '' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      queryClient.setQueryData<PageResult<Goal>>(queryKeys.goals.byProject(projectId, 1, 50), (old) => {
        if (!old) return old
        return { ...old, content: [...old.content, optimisticGoal], meta: { ...old.meta, totalElements: old.meta.totalElements + 1 } }
      })
      return { snapshot }
    },
    onSuccess: () => {
      setTitle('')
      setGoalType('SHORT_TERM')
      setStatus('NOT_STARTED')
      setManagerUserId('')
      setManagerTeamId('')
      setDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(projectId, 1, 50) })
      toast.success(t('goals.toast.createSuccess'))
    },
    onError: (error: Error, _variables, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(queryKeys.goals.byProject(projectId, 1, 50), context.snapshot)
      }
      toast.error(t('goals.toast.createFailed'), { description: error.message })
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editGoal) throw new Error(t('goals.error.notFound'))
      const payload: {
        title: string
        goalType: GoalType
        status: GoalStatusType
        managerUserId?: string
        managerTeamId?: number
      } = {
        title: editTitle.trim(),
        goalType: editGoalType,
        status: editStatus,
      }

      if (isOwner) {
        payload.managerUserId = editManagerUserId
        payload.managerTeamId = editManagerTeamId ? Number(editManagerTeamId) : 0
      }

      return goalApi.update(editGoal.id, payload)
    },
    onMutate: async () => {
      if (!editGoal) return
      await queryClient.cancelQueries({ queryKey: queryKeys.goals.byProject(projectId, 1, 50) })
      const snapshot = queryClient.getQueryData<PageResult<Goal>>(queryKeys.goals.byProject(projectId, 1, 50))
      queryClient.setQueryData<PageResult<Goal>>(queryKeys.goals.byProject(projectId, 1, 50), (old) => {
        if (!old) return old
        return {
          ...old,
          content: old.content.map((g) =>
            g.id === editGoal.id
              ? { ...g, title: editTitle.trim(), goalType: editGoalType, status: editStatus, updatedAt: new Date().toISOString() }
              : g,
          ),
        }
      })
      return { snapshot }
    },
    onSuccess: () => {
      setEditDialogOpen(false)
      setEditGoal(null)
      setEditManagerUserId('')
      setEditManagerTeamId('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(projectId, 1, 50) })
      toast.success(t('goals.toast.updateSuccess'))
    },
    onError: (error: Error, _variables, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(queryKeys.goals.byProject(projectId, 1, 50), context.snapshot)
      }
      toast.error(t('goals.toast.updateFailed'), { description: error.message })
    },
  })

  const {
    pendingDeletes: pendingGoalDeletes,
    clockMs: goalDeleteClockMs,
    undoWindowMs: goalDeleteUndoWindowMs,
    scheduleDelete: scheduleGoalDelete,
    undoDelete: undoGoalDelete,
    isQueued: isGoalDeleteQueued,
  } = useDeferredDelete<{ id: number; title: string }>({
    onFinalize: async (payload) => {
      await goalApi.remove(payload.id)
    },
    onFinalizeSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(projectId, 1, 50) }),
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] }),
      ])
    },
    pendingMessage: (entry) => t('goals.toast.deleteScheduled', { name: entry.label }),
    successMessage: (entry) => t('goals.toast.deleteSuccess', { name: entry.label }),
    alreadyDeletedMessage: (entry) => t('goals.toast.alreadyDeleted', { name: entry.label }),
    errorTitle: t('goals.toast.deleteFailed'),
  })

  if (goalsQuery.isLoading || goalTasksQuery.isLoading || projectQuery.isLoading || membersQuery.isLoading || teamsQuery.isLoading || workspaceQuery.isLoading || teamMembershipQuery.isLoading) {
    return <LoadingPanel />
  }

  const goals = goalsQuery.data?.content ?? []
  const tasks = goalTasksQuery.data?.content ?? []
  const pendingGoalIds = new Set(pendingGoalDeletes.map((entry) => entry.payload.id))
  const visibleGoals = goals.filter((goal) => !pendingGoalIds.has(goal.id))
  const tasksByGoal = new Map<number, Task[]>()

  for (const task of tasks) {
    if (!task.goalId || pendingGoalIds.has(task.goalId)) {
      continue
    }

    const currentTasks = tasksByGoal.get(task.goalId) ?? []
    currentTasks.push(task)
    tasksByGoal.set(task.goalId, currentTasks)
  }

  for (const goalTasks of tasksByGoal.values()) {
    goalTasks.sort(compareGoalTasks)
  }

  const isGoalUpdateDirty = Boolean(
    editGoal
    && (
      editTitle.trim() !== editInitialTitle
      || editGoalType !== editInitialGoalType
      || editStatus !== editInitialStatus
      || editManagerUserId !== editInitialManagerUserId
      || editManagerTeamId !== editInitialManagerTeamId
    ),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('goals.title')}
        description={t('goals.pageDescription', { role: currentRoleLabel })}
        actions={
          canManageProject ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 size-3.5" />
                  {t('goals.createAction')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('goals.create')}</DialogTitle>
                  <DialogDescription>
                    {isOwner
                      ? t('goals.createOwnerDescription')
                      : t('goals.createMemberDescription')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="goal-title">{t('goals.titleLabel')}</Label>
                    <Input
                      id="goal-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t('goals.titlePlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('goals.typeLabel')}</Label>
                    <div className="flex gap-2">
                      {(Object.keys(goalTypeConfig) as GoalType[]).map((goalTypeOption) => (
                        <Button
                          key={goalTypeOption}
                          type="button"
                          variant={goalType === goalTypeOption ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setGoalType(goalTypeOption)}
                        >
                          {t(`goals.type.${goalTypeOption}`)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('goals.initialStatusLabel')}</Label>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(goalStatusConfig) as GoalStatusType[]).map((s) => (
                        <Button
                          key={s}
                          type="button"
                          variant={status === s ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setStatus(s)}
                        >
                          {t('goals.status.' + s)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {isOwner && (
                    <>
                      <div className="space-y-2">
                        <Label>{t('goals.managerUserOptionalLabel')}</Label>
                        <Select value={managerUserId || 'none'} onValueChange={(value) => setManagerUserId(value === 'none' ? '' : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder={t('goals.managerUserPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('goals.unassignedManager')}</SelectItem>
                            {members.map((member) => (
                              <SelectItem key={member.user.userId} value={member.user.userId}>
                                {member.user.firstName} {member.user.lastName} ({getMemberRoleLabel(member.role)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('goals.managerTeamOptionalLabel')}</Label>
                        <Select value={managerTeamId || 'none'} onValueChange={(value) => setManagerTeamId(value === 'none' ? '' : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder={t('goals.managerTeamPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('goals.unassignedManager')}</SelectItem>
                            {teams.map((team) => (
                              <SelectItem key={team.id} value={String(team.id)}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
                  <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !title.trim()}>
                    {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {t('common.create')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Badge variant="outline">{t('goals.readOnlyBadge')}</Badge>
          )
        }
      />

      {visibleGoals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">{t('goals.emptyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('goals.emptyDescription')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleGoals.map((goal) => {
            const typeConfig = goalTypeConfig[goal.goalType]
            const TypeIcon = typeConfig.icon
            const canManageCurrentGoal = canManageGoal(goal)
            const orderedGoalTasks = tasksByGoal.get(goal.id) ?? []
            return (
              <Card key={goal.id} className="transition-all hover:shadow-sm">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className={`flex size-8 items-center justify-center rounded-lg ${typeConfig.color}`}>
                      <TypeIcon className="size-4" />
                    </div>
                    <div className="flex items-center gap-2">
                      <GoalStatusBadge status={goal.status} />
                      {canManageCurrentGoal && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditGoal(goal)
                                setEditTitle(goal.title)
                                setEditGoalType(goal.goalType)
                                setEditStatus(goal.status)
                                setEditManagerUserId(goal.managerUser?.userId ?? '')
                                setEditManagerTeamId(goal.managerTeamId ? String(goal.managerTeamId) : '')
                                setEditInitialTitle(goal.title.trim())
                                setEditInitialGoalType(goal.goalType)
                                setEditInitialStatus(goal.status)
                                setEditInitialManagerUserId(goal.managerUser?.userId ?? '')
                                setEditInitialManagerTeamId(goal.managerTeamId ? String(goal.managerTeamId) : '')
                                setEditDialogOpen(true)
                              }}
                            >
                              <Pencil className="mr-2 size-3.5" />
                              {t('common.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                setDeleteGoalTarget({ id: goal.id, title: goal.title })
                              }}
                            >
                              <Trash2 className="mr-2 size-3.5" />
                              {t('goals.deleteTitle')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  <h4 className="line-clamp-2 font-medium">{goal.title}</h4>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('goals.progress')}</span>
                      <span className="text-xs font-semibold">{goal.progressPercent}%</span>
                    </div>
                    <Progress value={goal.progressPercent} className="h-1.5" />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t(`goals.type.${goal.goalType}`)}</span>
                    <span>{goal.createdBy.firstName} {goal.createdBy.lastName}</span>
                  </div>
                  {(goal.managerUser || goal.managerTeamName) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {goal.managerUser && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t('goals.managerUserBadge', { name: `${goal.managerUser.firstName} ${goal.managerUser.lastName}` })}
                        </Badge>
                      )}
                      {goal.managerTeamName && (
                        <Badge variant="outline" className="text-[10px]">
                          {t('goals.managerTeamBadge', { name: goal.managerTeamName })}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ListTodo className="size-3.5" />
                      <span>
                        {orderedGoalTasks.length === 0
                          ? t('goals.taskCountZero')
                          : t('goals.taskCount', { count: orderedGoalTasks.length })}
                      </span>
                    </div>
                    <Link
                      to={`/workspaces/${workspaceId}/projects/${projectId}/goals/${goal.id}/tasks`}
                      className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('goals.viewTasks')}
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ─── Edit goal dialog ─── */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setEditGoal(null)
            setEditManagerUserId('')
            setEditManagerTeamId('')
            setEditInitialTitle('')
            setEditInitialGoalType('SHORT_TERM')
            setEditInitialStatus('NOT_STARTED')
            setEditInitialManagerUserId('')
            setEditInitialManagerTeamId('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('goals.editTitle')}</DialogTitle>
            <DialogDescription>
              {isOwner
                ? t('goals.editOwnerDescription')
                : t('goals.editMemberDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('goals.titleLabel')}</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder={t('goals.editTitlePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('goals.typeLabel')}</Label>
              <div className="flex gap-2">
                {(Object.keys(goalTypeConfig) as GoalType[]).map((goalTypeOption) => (
                  <Button key={goalTypeOption} type="button" variant={editGoalType === goalTypeOption ? 'default' : 'outline'} size="sm" onClick={() => setEditGoalType(goalTypeOption)}>
                    {t(`goals.type.${goalTypeOption}`)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('task.status')}</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(goalStatusConfig) as GoalStatusType[]).map((s) => (
                  <Button key={s} type="button" variant={editStatus === s ? 'default' : 'outline'} size="sm" onClick={() => setEditStatus(s)}>
                    {t('goals.status.' + s)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('goals.progressAutoLabel')}</Label>
              <div className="flex items-center gap-2">
                <Progress value={editGoal?.progressPercent ?? 0} className="h-2 flex-1" />
                <span className="text-sm font-semibold">{editGoal?.progressPercent ?? 0}%</span>
              </div>
            </div>
            {isOwner && (
              <>
                <div className="space-y-2">
                  <Label>{t('goals.managerUserLabel')}</Label>
                  <Select value={editManagerUserId || 'none'} onValueChange={(value) => setEditManagerUserId(value === 'none' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('goals.managerUserPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('goals.unassignedManager')}</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.user.userId} value={member.user.userId}>
                          {member.user.firstName} {member.user.lastName} ({getMemberRoleLabel(member.role)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('goals.managerTeamLabel')}</Label>
                  <Select value={editManagerTeamId || 'none'} onValueChange={(value) => setEditManagerTeamId(value === 'none' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('goals.managerTeamPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('goals.unassignedManager')}</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={String(team.id)}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !editTitle.trim() || !isGoalUpdateDirty}>
              {updateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete confirmation dialog ─── */}
      <Dialog
        open={Boolean(deleteGoalTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteGoalTarget(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('goals.deleteTitle')}</DialogTitle>
            <DialogDescription className="space-y-3 text-left leading-relaxed text-muted-foreground">
              <p>
                {deleteGoalTarget
                  ? t('goals.deleteConfirm', { name: deleteGoalTarget.title })
                  : t('goals.deleteConfirmGeneric')}
              </p>
              <div className="rounded-2xl border border-destructive/12 bg-destructive/5 px-3 py-3 text-sm text-foreground/80">
                {t('goals.deleteWarning')}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGoalTarget(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteGoalTarget) {
                  return
                }

                const queued = scheduleGoalDelete({
                  key: `goal-${deleteGoalTarget.id}`,
                  label: deleteGoalTarget.title,
                  payload: deleteGoalTarget,
                })

                if (queued) {
                  setDeleteGoalTarget(null)
                }
              }}
              disabled={Boolean(deleteGoalTarget && isGoalDeleteQueued(`goal-${deleteGoalTarget.id}`))}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeferredDeleteStack
        pendingDeletes={pendingGoalDeletes}
        clockMs={goalDeleteClockMs}
        undoWindowMs={goalDeleteUndoWindowMs}
        onUndo={undoGoalDelete}
        itemTitle={() => t('goals.toast.deleting')}
      />
    </div>
  )
}
