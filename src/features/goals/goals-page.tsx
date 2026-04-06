import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  ArrowLeft,
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
import { DeleteUndoStack } from '@/components/shared/delete-undo-stack'
import { goalApi } from '@/lib/api/modules/goal-api'
import { projectApi } from '@/lib/api/modules/project-api'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { workspaceTeamApi } from '@/lib/api/modules/workspace-team-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
import { isNotFoundError } from '@/lib/errors/is-not-found-error'
import { useAuthStore } from '@/app/store/auth-store'
import type { Goal, GoalStatusType, GoalType, WorkspaceMemberRoleType } from '@/types/domain'

const goalTypeConfig: Record<GoalType, { label: string; icon: typeof Timer; color: string }> = {
  SHORT_TERM: { label: 'Ngắn hạn', icon: Timer, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  MEDIUM_TERM: { label: 'Trung hạn', icon: Clock, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  LONG_TERM: { label: 'Dài hạn', icon: Milestone, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
}

const goalStatusConfig: Record<GoalStatusType, {
  label: string
  variant: 'default' | 'secondary' | 'outline' | 'destructive'
  icon: typeof CircleDashed
  badgeClassName: string
}> = {
  NOT_STARTED: {
    label: 'Chưa bắt đầu',
    variant: 'outline',
    icon: CircleDashed,
    badgeClassName: 'border-slate-300/90 bg-slate-100/70 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200',
  },
  IN_PROGRESS: {
    label: 'Đang thực hiện',
    variant: 'outline',
    icon: PlayCircle,
    badgeClassName: 'border-sky-300/90 bg-sky-100/80 text-sky-700 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200',
  },
  ON_HOLD: {
    label: 'Tạm dừng',
    variant: 'outline',
    icon: PauseCircle,
    badgeClassName: 'border-amber-300/90 bg-amber-100/80 text-amber-700 dark:border-amber-700 dark:bg-amber-950/45 dark:text-amber-200',
  },
  COMPLETED: {
    label: 'Hoàn thành',
    variant: 'outline',
    icon: CheckCircle2,
    badgeClassName: 'border-emerald-300/90 bg-emerald-100/80 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-200',
  },
}

const GOAL_DELETE_UNDO_WINDOW_MS = 5000

interface PendingGoalDelete {
  goalId: number
  goalTitle: string
  expiresAt: number
  status: 'pending' | 'finalizing'
}

export function GoalsPage() {
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

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteGoalId, setDeleteGoalId] = useState<number | null>(null)
  const [pendingGoalDeletes, setPendingGoalDeletes] = useState<PendingGoalDelete[]>([])
  const [clockMs, setClockMs] = useState(() => Date.now())
  const pendingGoalDeletesRef = useRef<PendingGoalDelete[]>([])
  const finalizingGoalIdsRef = useRef(new Set<number>())

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

  const members = membersQuery.data ?? []
  const teams = teamsQuery.data ?? []
  const project = projectQuery.data ?? null
  const currentMember = members.find((member) => member.user.userId === currentUserId)
  const currentRole: WorkspaceMemberRoleType = workspaceQuery.data?.owner.userId === currentUserId
    ? 'OWNER'
    : currentMember?.role ?? 'MEMBER'
  const isOwner = currentRole === 'OWNER'
  const isWorkspaceManager = isOwner || currentRole === 'ADMIN'
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

  useEffect(() => {
    pendingGoalDeletesRef.current = pendingGoalDeletes
  }, [pendingGoalDeletes])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockMs(Date.now())
    }, 250)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

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
    onSuccess: () => {
      setTitle('')
      setGoalType('SHORT_TERM')
      setStatus('NOT_STARTED')
      setManagerUserId('')
      setManagerTeamId('')
      setDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(projectId, 1, 50) })
      toast.success('Tạo goal thành công')
    },
    onError: (error: Error) => {
      toast.error('Tạo goal thất bại', { description: error.message })
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editGoal) throw new Error('Goal không tồn tại')
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
    onSuccess: () => {
      setEditDialogOpen(false)
      setEditGoal(null)
      setEditManagerUserId('')
      setEditManagerTeamId('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(projectId, 1, 50) })
      toast.success('Cập nhật goal thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật goal thất bại', { description: error.message })
    },
  })

  const goals = goalsQuery.data?.content ?? []

  const removePendingGoalDelete = useCallback((goalId: number) => {
    finalizingGoalIdsRef.current.delete(goalId)
    setPendingGoalDeletes((previous) => previous.filter((item) => item.goalId !== goalId))
  }, [])

  const undoPendingGoalDelete = (goalId: number) => {
    const pendingDelete = pendingGoalDeletesRef.current.find((item) => item.goalId === goalId)
    if (!pendingDelete || pendingDelete.status !== 'pending') {
      return
    }

    removePendingGoalDelete(goalId)
    toast.success(`Đã hoàn tác xóa goal "${pendingDelete.goalTitle}"`)
  }

  const finalizePendingGoalDelete = useCallback(async (goalId: number) => {
    const pendingDelete = pendingGoalDeletesRef.current.find((item) => item.goalId === goalId)
    if (!pendingDelete || pendingDelete.status !== 'pending') {
      return
    }

    if (finalizingGoalIdsRef.current.has(goalId)) {
      return
    }

    finalizingGoalIdsRef.current.add(goalId)
    setPendingGoalDeletes((previous) => previous.map((item) =>
      item.goalId === goalId ? { ...item, status: 'finalizing' } : item,
    ))

    try {
      await goalApi.remove(goalId)
      toast.success(`Đã xóa goal "${pendingDelete.goalTitle}"`)
    } catch (error) {
      if (error instanceof Error && isNotFoundError(error)) {
        toast.success(`Goal "${pendingDelete.goalTitle}" đã được xóa trước đó`)
      } else {
        const description = error instanceof Error
          ? error.message
          : 'Đã xảy ra lỗi không xác định'
        toast.error('Xóa goal thất bại', { description })
      }
    }

    removePendingGoalDelete(goalId)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['goals', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] }),
    ])
  }, [projectId, queryClient, removePendingGoalDelete])

  useEffect(() => {
    if (pendingGoalDeletes.length === 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      const now = Date.now()
      setClockMs(now)

      const expiredGoalIds = pendingGoalDeletesRef.current
        .filter((item) => item.status === 'pending' && item.expiresAt <= now)
        .map((item) => item.goalId)

      for (const goalId of expiredGoalIds) {
        void finalizePendingGoalDelete(goalId)
      }
    }, 100)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [finalizePendingGoalDelete, pendingGoalDeletes.length])

  const scheduleGoalDelete = () => {
    if (!deleteGoalId) {
      return
    }

    const existingPendingDelete = pendingGoalDeletesRef.current.find((item) => item.goalId === deleteGoalId)
    if (existingPendingDelete) {
      toast.error('Goal này đang chờ xóa. Bạn có thể hoàn tác hoặc đợi hoàn tất.')
      return
    }

    const targetGoal = goals.find((goal) => goal.id === deleteGoalId)
    const goalTitle = targetGoal?.title ?? `Goal #${deleteGoalId}`
    const createdAt = clockMs

    setPendingGoalDeletes((previous) => [
      ...previous,
      {
        goalId: deleteGoalId,
        goalTitle,
        expiresAt: createdAt + GOAL_DELETE_UNDO_WINDOW_MS,
        status: 'pending',
      },
    ])

    setDeleteDialogOpen(false)
    setDeleteGoalId(null)
    toast.success('Goal đã được lên lịch xóa. Bạn có 5 giây để hoàn tác.')
  }

  if (goalsQuery.isLoading || projectQuery.isLoading || membersQuery.isLoading || teamsQuery.isLoading || workspaceQuery.isLoading || teamMembershipQuery.isLoading) {
    return <LoadingPanel />
  }

  const pendingGoalDeleteIdSet = new Set(pendingGoalDeletes.map((item) => item.goalId))
  const visibleGoals = goals.filter((goal) => !pendingGoalDeleteIdSet.has(goal.id))
  const selectedGoalPendingDelete = deleteGoalId !== null
    && pendingGoalDeletes.some((item) => item.goalId === deleteGoalId)
  const normalizedEditTitle = editTitle.trim()
  const currentManagerUserId = editGoal?.managerUser?.userId ?? ''
  const currentManagerTeamId = editGoal?.managerTeamId ? String(editGoal.managerTeamId) : ''
  const managerAssignmentChanged = isOwner && (
    editManagerUserId !== currentManagerUserId
    || editManagerTeamId !== currentManagerTeamId
  )
  const canSubmitGoalEdit = Boolean(
    editGoal
    && normalizedEditTitle.length > 0
    && (
      normalizedEditTitle !== editGoal.title.trim()
      || editGoalType !== editGoal.goalType
      || editStatus !== editGoal.status
      || managerAssignmentChanged
    )
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goals"
        description={`Mục tiêu ngắn hạn và dài hạn trong project · Vai trò của bạn: ${currentRole}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/workspaces/${workspaceId}`}>
                <ArrowLeft className="mr-1.5 size-3.5" />
                Quay lại workspace
              </Link>
            </Button>

            {canManageProject ? (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1.5 size-3.5" />
                    Tạo goal
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tạo goal mới</DialogTitle>
                    <DialogDescription>
                      {isOwner
                        ? 'Đặt mục tiêu cho project và phân công manager nếu cần.'
                        : 'Đặt mục tiêu cho project của bạn.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="goal-title">Tiêu đề</Label>
                      <Input
                        id="goal-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ví dụ: Hoàn thành MVP"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Loại mục tiêu</Label>
                      <div className="flex gap-2">
                        {(Object.keys(goalTypeConfig) as GoalType[]).map((t) => (
                          <Button
                            key={t}
                            type="button"
                            variant={goalType === t ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setGoalType(t)}
                          >
                            {goalTypeConfig[t].label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Trạng thái ban đầu</Label>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(goalStatusConfig) as GoalStatusType[]).map((s) => (
                          <Button
                            key={s}
                            type="button"
                            variant={status === s ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatus(s)}
                          >
                            {goalStatusConfig[s].label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {isOwner && (
                      <>
                        <div className="space-y-2">
                          <Label>Manager user (tùy chọn)</Label>
                          <Select value={managerUserId || 'none'} onValueChange={(value) => setManagerUserId(value === 'none' ? '' : value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Không gán manager user" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Không gán</SelectItem>
                              {members.map((member) => (
                                <SelectItem key={member.user.userId} value={member.user.userId}>
                                  {member.user.firstName} {member.user.lastName} ({member.role})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Manager team (tùy chọn)</Label>
                          <Select value={managerTeamId || 'none'} onValueChange={(value) => setManagerTeamId(value === 'none' ? '' : value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Không gán manager team" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Không gán</SelectItem>
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
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
                    <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !title.trim()}>
                      {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Tạo
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <Badge variant="outline">Read-only: chỉ manager mới có quyền tạo/sửa goal</Badge>
            )}
          </div>
        }
      />

      {visibleGoals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">Chưa có goal nào</p>
            <p className="mt-1 text-xs text-muted-foreground">Tạo goal đầu tiên để theo dõi tiến độ</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleGoals.map((goal) => {
            const typeConfig = goalTypeConfig[goal.goalType]
            const statusConfig = goalStatusConfig[goal.status]
            const TypeIcon = typeConfig.icon
            const StatusIcon = statusConfig.icon
            const canManageCurrentGoal = canManageGoal(goal)
            return (
              <Card key={goal.id} className="transition-all hover:shadow-sm">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className={`flex size-8 items-center justify-center rounded-lg ${typeConfig.color}`}>
                      <TypeIcon className="size-4" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusConfig.variant} className={`gap-1 text-[10px] font-semibold ${statusConfig.badgeClassName}`}>
                        <StatusIcon className="size-3" />
                        {statusConfig.label}
                      </Badge>
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
                                setEditDialogOpen(true)
                              }}
                            >
                              <Pencil className="mr-2 size-3.5" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                setDeleteGoalId(goal.id)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="mr-2 size-3.5" />
                              Xóa goal
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  <h4 className="line-clamp-2 font-medium">{goal.title}</h4>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Tiến độ</span>
                      <span className="text-xs font-semibold">{goal.progressPercent}%</span>
                    </div>
                    <Progress value={goal.progressPercent} className="h-1.5" />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{typeConfig.label}</span>
                    <span>{goal.createdBy.firstName} {goal.createdBy.lastName}</span>
                  </div>
                  {(goal.managerUser || goal.managerTeamName) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {goal.managerUser && (
                        <Badge variant="secondary" className="text-[10px]">
                          Manager user: {goal.managerUser.firstName} {goal.managerUser.lastName}
                        </Badge>
                      )}
                      {goal.managerTeamName && (
                        <Badge variant="outline" className="text-[10px]">
                          Manager team: {goal.managerTeamName}
                        </Badge>
                      )}
                    </div>
                  )}
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
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa goal</DialogTitle>
            <DialogDescription>
              {isOwner
                ? 'Cập nhật thông tin mục tiêu và manager scope.'
                : 'Cập nhật thông tin mục tiêu. Chỉ owner mới được chỉnh manager user/team.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tiêu đề</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Tiêu đề goal" />
            </div>
            <div className="space-y-2">
              <Label>Loại mục tiêu</Label>
              <div className="flex gap-2">
                {(Object.keys(goalTypeConfig) as GoalType[]).map((t) => (
                  <Button key={t} type="button" variant={editGoalType === t ? 'default' : 'outline'} size="sm" onClick={() => setEditGoalType(t)}>
                    {goalTypeConfig[t].label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(goalStatusConfig) as GoalStatusType[]).map((s) => (
                  <Button key={s} type="button" variant={editStatus === s ? 'default' : 'outline'} size="sm" onClick={() => setEditStatus(s)}>
                    {goalStatusConfig[s].label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tiến độ (tự động tính theo tasks hoàn thành)</Label>
              <div className="flex items-center gap-2">
                <Progress value={editGoal?.progressPercent ?? 0} className="h-2 flex-1" />
                <span className="text-sm font-semibold">{editGoal?.progressPercent ?? 0}%</span>
              </div>
            </div>
            {isOwner && (
              <>
                <div className="space-y-2">
                  <Label>Manager user</Label>
                  <Select value={editManagerUserId || 'none'} onValueChange={(value) => setEditManagerUserId(value === 'none' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Không gán manager user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Không gán</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.user.userId} value={member.user.userId}>
                          {member.user.firstName} {member.user.lastName} ({member.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Manager team</Label>
                  <Select value={editManagerTeamId || 'none'} onValueChange={(value) => setEditManagerTeamId(value === 'none' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Không gán manager team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Không gán</SelectItem>
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
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Hủy</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !canSubmitGoalEdit}>
              {updateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete confirmation dialog ─── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa goal</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa goal này không? Goal chỉ xóa được khi không còn task liên kết.
              Sau khi xác nhận, bạn có 5 giây để hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Hủy</Button>
            <Button
              variant="destructive"
              onClick={scheduleGoalDelete}
              disabled={selectedGoalPendingDelete}
            >
              {selectedGoalPendingDelete && <Loader2 className="mr-2 size-4 animate-spin" />}
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteUndoStack
        items={pendingGoalDeletes.map((pendingDelete) => ({
          id: pendingDelete.goalId,
          entityLabel: 'goal',
          title: pendingDelete.goalTitle,
          expiresAt: pendingDelete.expiresAt,
          windowMs: GOAL_DELETE_UNDO_WINDOW_MS,
          status: pendingDelete.status,
        }))}
        clockMs={clockMs}
        onUndo={(itemId) => undoPendingGoalDelete(Number(itemId))}
      />
    </div>
  )
}
