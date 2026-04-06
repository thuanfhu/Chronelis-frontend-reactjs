import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, FolderKanban, Users, Loader2, UserPlus, Trash2, Crown, Shield, User, MoreHorizontal, Pencil, Archive, CheckCircle2, RotateCcw, Link2, QrCode, Copy, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { DeleteUndoStack } from '@/components/shared/delete-undo-stack'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { projectApi } from '@/lib/api/modules/project-api'
import { workspaceInviteApi } from '@/lib/api/modules/workspace-invite-api'
import { workspaceTeamApi } from '@/lib/api/modules/workspace-team-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useWorkspaceRealtime } from '@/lib/websocket/use-domain-realtime'
import { isNotFoundError } from '@/lib/errors/is-not-found-error'
import { useAuthStore } from '@/app/store/auth-store'
import type {
  Project,
  ProjectStatusType,
  WorkspaceMemberRoleType,
  WorkspaceTeamMember,
} from '@/types/domain'

const roleIcon = {
  OWNER: Crown,
  ADMIN: Shield,
  MEMBER: User,
}

const roleBadgeVariant = {
  OWNER: 'default' as const,
  ADMIN: 'secondary' as const,
  MEMBER: 'outline' as const,
}

const DELETE_UNDO_WINDOW_MS = 5000

type PendingDeleteEntityType = 'project' | 'workspace' | 'member' | 'invite' | 'team' | 'team-member'

interface QuickDeleteIntent {
  key: string
  entityType: Exclude<PendingDeleteEntityType, 'project' | 'workspace'>
  entityId: number
  title: string
  userId?: string
  teamId?: number
}

interface PendingDeleteItem {
  key: string
  entityType: PendingDeleteEntityType
  entityId: number
  title: string
  userId?: string
  teamId?: number
  expiresAt: number
  status: 'pending' | 'finalizing'
}

const PENDING_ENTITY_LABEL: Record<PendingDeleteEntityType, string> = {
  project: 'project',
  workspace: 'workspace',
  member: 'thành viên',
  invite: 'invite',
  team: 'team',
  'team-member': 'thành viên team',
}

const PENDING_ENTITY_ACTION: Record<PendingDeleteEntityType, string> = {
  project: 'xóa',
  workspace: 'xóa',
  member: 'xóa',
  invite: 'thu hồi',
  team: 'xóa',
  'team-member': 'xóa',
}

export function WorkspaceDetailPage() {
  const navigate = useNavigate()
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const queryClient = useQueryClient()

  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectManagerUserId, setProjectManagerUserId] = useState('')
  const [projectManagerTeamId, setProjectManagerTeamId] = useState('')
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [memberUserId, setMemberUserId] = useState('')
  const [memberRole, setMemberRole] = useState<WorkspaceMemberRoleType>('MEMBER')
  const [editWsDialogOpen, setEditWsDialogOpen] = useState(false)
  const [editWsName, setEditWsName] = useState('')
  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false)
  const [editProjectId, setEditProjectId] = useState<number | null>(null)
  const [editProjectName, setEditProjectName] = useState('')
  const [editProjectDescription, setEditProjectDescription] = useState('')
  const [editProjectManagerUserId, setEditProjectManagerUserId] = useState('')
  const [editProjectManagerTeamId, setEditProjectManagerTeamId] = useState('')
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false)
  const [deleteProject, setDeleteProject] = useState<Project | null>(null)
  const [deleteWorkspaceDialogOpen, setDeleteWorkspaceDialogOpen] = useState(false)
  const [pendingDeletes, setPendingDeletes] = useState<PendingDeleteItem[]>([])
  const [clockMs, setClockMs] = useState(() => Date.now())
  const pendingDeletesRef = useRef<PendingDeleteItem[]>([])
  const finalizingDeleteKeysRef = useRef(new Set<string>())
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRoleType>('MEMBER')
  const [inviteMaxUses, setInviteMaxUses] = useState('')
  const [teamDialogOpen, setTeamDialogOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
  const [teamMemberDraftByTeamId, setTeamMemberDraftByTeamId] = useState<Record<number, string>>({})
  const [quickDeleteDialogOpen, setQuickDeleteDialogOpen] = useState(false)
  const [quickDeleteIntent, setQuickDeleteIntent] = useState<QuickDeleteIntent | null>(null)

  const currentUserId = useAuthStore((state) => state.currentUser?.userId ?? null)

  useWorkspaceRealtime(Number.isFinite(workspaceId) ? workspaceId : null)

  useEffect(() => {
    pendingDeletesRef.current = pendingDeletes
  }, [pendingDeletes])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockMs(Date.now())
    }, 250)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId),
    queryFn: () => workspaceApi.detail(workspaceId),
    enabled: Number.isFinite(workspaceId),
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId),
    queryFn: () => workspaceApi.members(workspaceId),
    enabled: Number.isFinite(workspaceId),
  })

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50),
    queryFn: () => projectApi.listByWorkspace(workspaceId, { page: 1, size: 50 }),
    enabled: Number.isFinite(workspaceId),
  })

  const invitesQuery = useQuery({
    queryKey: queryKeys.invites.byWorkspace(workspaceId),
    queryFn: () => workspaceInviteApi.listActive(workspaceId),
    enabled: Number.isFinite(workspaceId),
  })

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams.byWorkspace(workspaceId),
    queryFn: () => workspaceTeamApi.listByWorkspace(workspaceId),
    enabled: Number.isFinite(workspaceId),
  })

  const teamMembershipQuery = useQuery({
    queryKey: ['workspace-teams', 'members-map', workspaceId, (teamsQuery.data ?? []).map((team) => team.id).join(',')],
    queryFn: async () => {
      const entries = await Promise.all(
        (teamsQuery.data ?? []).map(async (team) => {
          try {
            const teamMembers = await workspaceTeamApi.listMembers(team.id)
            return [team.id, teamMembers] as const
          } catch {
            return [team.id, [] as WorkspaceTeamMember[]] as const
          }
        }),
      )

      return new Map<number, WorkspaceTeamMember[]>(entries)
    },
    enabled: Number.isFinite(workspaceId) && (teamsQuery.data?.length ?? 0) > 0,
  })

  const createProjectMutation = useMutation({
    mutationFn: () => {
      const payload: {
        workspaceId: number
        name: string
        description?: string
        managerUserId?: string
        managerTeamId?: number
      } = {
        workspaceId,
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
      }

      if (workspaceQuery.data?.owner.userId === currentUserId) {
        payload.managerUserId = projectManagerUserId || undefined
        payload.managerTeamId = projectManagerTeamId ? Number(projectManagerTeamId) : undefined
      }

      return projectApi.create(payload)
    },
    onSuccess: () => {
      setProjectName('')
      setProjectDescription('')
      setProjectManagerUserId('')
      setProjectManagerTeamId('')
      setProjectDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      toast.success('Tạo project thành công')
    },
    onError: (error: Error) => {
      toast.error('Tạo project thất bại', { description: error.message })
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: () => workspaceApi.addMember(workspaceId, { userId: memberUserId.trim(), role: memberRole }),
    onSuccess: () => {
      setMemberUserId('')
      setMemberRole('MEMBER')
      setMemberDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) })
      toast.success('Thêm thành viên thành công')
    },
    onError: (error: Error) => {
      toast.error('Thêm thành viên thất bại', { description: error.message })
    },
  })

  const updateWorkspaceMutation = useMutation({
    mutationFn: () => workspaceApi.update(workspaceId, { name: editWsName.trim() }),
    onSuccess: () => {
      setEditWsDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      toast.success('Cập nhật workspace thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật workspace thất bại', { description: error.message })
    },
  })

  const updateProjectMutation = useMutation({
    mutationFn: () => {
      if (!editProjectId) throw new Error('Project không tồn tại')
      const payload: {
        name: string
        description?: string
        managerUserId?: string
        managerTeamId?: number
      } = {
        name: editProjectName.trim(),
        description: editProjectDescription.trim() || undefined,
      }

      if (workspaceQuery.data?.owner.userId === currentUserId) {
        payload.managerUserId = editProjectManagerUserId
        payload.managerTeamId = editProjectManagerTeamId ? Number(editProjectManagerTeamId) : 0
      }

      return projectApi.update(editProjectId, payload)
    },
    onSuccess: () => {
      setEditProjectDialogOpen(false)
      setEditProjectId(null)
      setEditProjectManagerUserId('')
      setEditProjectManagerTeamId('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      toast.success('Cập nhật project thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật project thất bại', { description: error.message })
    },
  })

  const updateProjectStatusMutation = useMutation({
    mutationFn: ({ projectId, status }: { projectId: number; status: ProjectStatusType }) =>
      projectApi.updateStatus(projectId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      toast.success('Cập nhật trạng thái project thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật trạng thái thất bại', { description: error.message })
    },
  })

  const removePendingDelete = useCallback((itemKey: string) => {
    finalizingDeleteKeysRef.current.delete(itemKey)
    setPendingDeletes((previous) => previous.filter((item) => item.key !== itemKey))
  }, [])

  const undoPendingDelete = (itemKey: string) => {
    const pendingDelete = pendingDeletesRef.current.find((item) => item.key === itemKey)
    if (!pendingDelete || pendingDelete.status !== 'pending') {
      return
    }

    removePendingDelete(itemKey)
    toast.success(`Đã hoàn tác ${PENDING_ENTITY_ACTION[pendingDelete.entityType]} ${PENDING_ENTITY_LABEL[pendingDelete.entityType]} "${pendingDelete.title}"`)
  }

  const finalizePendingDelete = useCallback(async (itemKey: string) => {
    const pendingDelete = pendingDeletesRef.current.find((item) => item.key === itemKey)
    if (!pendingDelete || pendingDelete.status !== 'pending') {
      return
    }

    if (finalizingDeleteKeysRef.current.has(itemKey)) {
      return
    }

    finalizingDeleteKeysRef.current.add(itemKey)
    setPendingDeletes((previous) => previous.map((item) =>
      item.key === itemKey ? { ...item, status: 'finalizing' } : item,
    ))

    let shouldNavigateToDashboard = false

    try {
      switch (pendingDelete.entityType) {
        case 'project':
          await projectApi.remove(pendingDelete.entityId)
          toast.success(`Đã xóa project "${pendingDelete.title}"`)
          break
        case 'workspace':
          await workspaceApi.remove(pendingDelete.entityId)
          toast.success(`Đã xóa workspace "${pendingDelete.title}"`)
          shouldNavigateToDashboard = true
          break
        case 'member':
          if (!pendingDelete.userId) {
            throw new Error('Không tìm thấy user của thành viên cần xóa')
          }
          await workspaceApi.removeMember(workspaceId, pendingDelete.userId)
          toast.success(`Đã xóa thành viên "${pendingDelete.title}"`)
          break
        case 'invite':
          await workspaceInviteApi.revoke(pendingDelete.entityId)
          toast.success(`Đã thu hồi invite "${pendingDelete.title}"`)
          break
        case 'team':
          await workspaceTeamApi.remove(pendingDelete.entityId)
          toast.success(`Đã xóa team "${pendingDelete.title}"`)
          break
        case 'team-member':
          if (!pendingDelete.teamId || !pendingDelete.userId) {
            throw new Error('Không tìm thấy thông tin thành viên team cần xóa')
          }
          await workspaceTeamApi.removeMember(pendingDelete.teamId, pendingDelete.userId)
          toast.success(`Đã xóa thành viên team "${pendingDelete.title}"`)
          break
        default:
          break
      }
    } catch (error) {
      if (error instanceof Error && isNotFoundError(error)) {
        toast.success(`${PENDING_ENTITY_LABEL[pendingDelete.entityType]} "${pendingDelete.title}" đã được xử lý trước đó`)
        if (pendingDelete.entityType === 'workspace') {
          shouldNavigateToDashboard = true
        }
      } else {
        const description = error instanceof Error
          ? error.message
          : 'Đã xảy ra lỗi không xác định'
        const failureTitle = pendingDelete.entityType === 'invite'
          ? 'Thu hồi invite thất bại'
          : `Xóa ${PENDING_ENTITY_LABEL[pendingDelete.entityType]} thất bại`
        toast.error(
          failureTitle,
          { description },
        )
      }
    }

    removePendingDelete(itemKey)

    switch (pendingDelete.entityType) {
      case 'project':
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(pendingDelete.entityId) }),
        ])
        break
      case 'workspace':
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
          queryClient.invalidateQueries({ queryKey: ['projects', 'workspace', pendingDelete.entityId] }),
        ])
        if (shouldNavigateToDashboard) {
          navigate('/dashboard', { replace: true })
        }
        break
      case 'member':
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.teams.byWorkspace(workspaceId) }),
          queryClient.invalidateQueries({ queryKey: ['workspace-teams', 'members-map', workspaceId] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) }),
        ])
        break
      case 'invite':
        await queryClient.invalidateQueries({ queryKey: queryKeys.invites.byWorkspace(workspaceId) })
        break
      case 'team':
      case 'team-member':
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.teams.byWorkspace(workspaceId) }),
          queryClient.invalidateQueries({ queryKey: ['workspace-teams', 'members-map', workspaceId] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) }),
        ])
        break
      default:
        break
    }
  }, [navigate, queryClient, removePendingDelete, workspaceId])

  useEffect(() => {
    if (pendingDeletes.length === 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      const now = Date.now()
      setClockMs(now)

      const expiredKeys = pendingDeletesRef.current
        .filter((item) => item.status === 'pending' && item.expiresAt <= now)
        .map((item) => item.key)

      for (const itemKey of expiredKeys) {
        void finalizePendingDelete(itemKey)
      }
    }, 100)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [finalizePendingDelete, pendingDeletes.length])

  const scheduleProjectDelete = () => {
    if (!deleteProject) {
      return
    }

    const itemKey = `project-${deleteProject.id}`
    if (pendingDeletesRef.current.some((item) => item.key === itemKey)) {
      toast.error('Project này đang chờ xóa. Bạn có thể hoàn tác hoặc đợi hoàn tất.')
      return
    }

    const createdAt = clockMs
    setPendingDeletes((previous) => [
      ...previous,
      {
        key: itemKey,
        entityType: 'project',
        entityId: deleteProject.id,
        title: deleteProject.name,
        expiresAt: createdAt + DELETE_UNDO_WINDOW_MS,
        status: 'pending',
      },
    ])

    setDeleteProjectDialogOpen(false)
    setDeleteProject(null)
    toast.success('Project đã được lên lịch xóa. Bạn có 5 giây để hoàn tác.')
  }

  const scheduleWorkspaceDelete = () => {
    const workspace = workspaceQuery.data
    if (!workspace) {
      return
    }

    const itemKey = `workspace-${workspace.id}`
    if (pendingDeletesRef.current.some((item) => item.key === itemKey)) {
      toast.error('Workspace này đang chờ xóa. Bạn có thể hoàn tác hoặc đợi hoàn tất.')
      return
    }

    const createdAt = clockMs
    setPendingDeletes((previous) => [
      ...previous,
      {
        key: itemKey,
        entityType: 'workspace',
        entityId: workspace.id,
        title: workspace.name,
        expiresAt: createdAt + DELETE_UNDO_WINDOW_MS,
        status: 'pending',
      },
    ])

    setDeleteWorkspaceDialogOpen(false)
    toast.success('Workspace đã được lên lịch xóa. Bạn có 5 giây để hoàn tác.')
  }

  const openQuickDeleteConfirm = (intent: QuickDeleteIntent) => {
    if (pendingDeletesRef.current.some((item) => item.key === intent.key)) {
      toast.error('Mục này đang chờ xử lý. Bạn có thể hoàn tác hoặc đợi hoàn tất.')
      return
    }

    setQuickDeleteIntent(intent)
    setQuickDeleteDialogOpen(true)
  }

  const scheduleQuickDeleteFromIntent = () => {
    if (!quickDeleteIntent) {
      return
    }

    if (pendingDeletesRef.current.some((item) => item.key === quickDeleteIntent.key)) {
      toast.error('Mục này đang chờ xử lý. Bạn có thể hoàn tác hoặc đợi hoàn tất.')
      return
    }

    const createdAt = clockMs
    setPendingDeletes((previous) => [
      ...previous,
      {
        key: quickDeleteIntent.key,
        entityType: quickDeleteIntent.entityType,
        entityId: quickDeleteIntent.entityId,
        title: quickDeleteIntent.title,
        userId: quickDeleteIntent.userId,
        teamId: quickDeleteIntent.teamId,
        expiresAt: createdAt + DELETE_UNDO_WINDOW_MS,
        status: 'pending',
      },
    ])

    setQuickDeleteDialogOpen(false)
    setQuickDeleteIntent(null)
    toast.success(
      `${PENDING_ENTITY_LABEL[quickDeleteIntent.entityType]} đã được lên lịch ${PENDING_ENTITY_ACTION[quickDeleteIntent.entityType]}. Bạn có 5 giây để hoàn tác.`,
    )
  }

  const createInviteMutation = useMutation({
    mutationFn: () => workspaceInviteApi.create({
      workspaceId,
      roleToAssign: inviteRole,
      maxUses: inviteMaxUses ? Number(inviteMaxUses) : undefined,
    }),
    onSuccess: () => {
      setInviteDialogOpen(false)
      setInviteMaxUses('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.invites.byWorkspace(workspaceId) })
      toast.success('Tạo invite link thành công')
    },
    onError: (error: Error) => toast.error('Tạo invite thất bại', { description: error.message }),
  })

  const createTeamMutation = useMutation({
    mutationFn: () => workspaceTeamApi.create({
      workspaceId,
      name: teamName.trim(),
      description: teamDescription.trim() || undefined,
    }),
    onSuccess: () => {
      setTeamDialogOpen(false)
      setTeamName('')
      setTeamDescription('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams.byWorkspace(workspaceId) })
      void queryClient.invalidateQueries({ queryKey: ['workspace-teams', 'members-map', workspaceId] })
      toast.success('Tạo team thành công')
    },
    onError: (error: Error) => toast.error('Tạo team thất bại', { description: error.message }),
  })

  const addTeamMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: number; userId: string }) =>
      workspaceTeamApi.addMember(teamId, { userId }),
    onSuccess: (_, variables) => {
      setTeamMemberDraftByTeamId((prev) => ({
        ...prev,
        [variables.teamId]: '',
      }))
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams.byWorkspace(workspaceId) })
      void queryClient.invalidateQueries({ queryKey: ['workspace-teams', 'members-map', workspaceId] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      toast.success('Thêm thành viên vào team thành công')
    },
    onError: (error: Error) => toast.error('Thêm thành viên vào team thất bại', { description: error.message }),
  })

  const isLoading = workspaceQuery.isLoading || membersQuery.isLoading || projectsQuery.isLoading

  if (isLoading) {
    return <LoadingPanel />
  }

  if (!workspaceQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Workspace không tồn tại.</p>
        <Link to="/workspaces" className="mt-2 text-sm text-primary hover:underline">Quay lại danh sách</Link>
      </div>
    )
  }

  const members = membersQuery.data ?? []
  const projects = projectsQuery.data?.content ?? []
  const invites = invitesQuery.data ?? []
  const teams = teamsQuery.data ?? []

  const pendingDeleteByKey = new Map(pendingDeletes.map((item) => [item.key, item]))
  const pendingProjectIdSet = new Set(
    pendingDeletes
      .filter((item) => item.entityType === 'project')
      .map((item) => item.entityId),
  )
  const pendingMemberUserIdSet = new Set(
    pendingDeletes
      .filter((item) => item.entityType === 'member' && Boolean(item.userId))
      .map((item) => item.userId as string),
  )
  const pendingInviteIdSet = new Set(
    pendingDeletes
      .filter((item) => item.entityType === 'invite')
      .map((item) => item.entityId),
  )
  const pendingTeamIdSet = new Set(
    pendingDeletes
      .filter((item) => item.entityType === 'team')
      .map((item) => item.entityId),
  )
  const pendingTeamMemberKeySet = new Set(
    pendingDeletes
      .filter((item) => item.entityType === 'team-member' && Boolean(item.teamId) && Boolean(item.userId))
      .map((item) => `${item.teamId}-${item.userId}`),
  )

  const visibleMembers = members.filter((member) => !pendingMemberUserIdSet.has(member.user.userId))
  const visibleInvites = invites.filter((invite) => !pendingInviteIdSet.has(invite.id))
  const visibleTeams = teams.filter((team) => !pendingTeamIdSet.has(team.id))
  const visibleProjects = projects.filter((project) => !pendingProjectIdSet.has(project.id))
  const workspacePendingDelete = pendingDeletes.some(
    (item) => item.entityType === 'workspace' && item.entityId === workspaceQuery.data.id,
  )
  const selectedProjectPendingDelete = deleteProject !== null
    && pendingDeletes.some((item) => item.entityType === 'project' && item.entityId === deleteProject.id)
  const selectedQuickDeletePending = quickDeleteIntent !== null
    && pendingDeletes.some((item) => item.key === quickDeleteIntent.key)
  const canSubmitEditWorkspace = editWsName.trim().length > 0
    && editWsName.trim() !== workspaceQuery.data.name.trim()

  const editingProject = editProjectId !== null
    ? projects.find((project) => project.id === editProjectId) ?? null
    : null
  const normalizedEditProjectName = editProjectName.trim()
  const normalizedEditProjectDescription = editProjectDescription.trim()
  const normalizedCurrentProjectDescription = (editingProject?.description ?? '').trim()
  const currentManagerUserId = editingProject?.managerUser?.userId ?? ''
  const currentManagerTeamId = editingProject?.managerTeamId ?? 0
  const normalizedEditManagerTeamId = editProjectManagerTeamId ? Number(editProjectManagerTeamId) : 0
  const managerAssignmentChanged = workspaceQuery.data.owner.userId === currentUserId && (
    editProjectManagerUserId !== currentManagerUserId
    || normalizedEditManagerTeamId !== currentManagerTeamId
  )
  const canSubmitEditProject = Boolean(
    editingProject
    && normalizedEditProjectName.length > 0
    && (
      normalizedEditProjectName !== editingProject.name.trim()
      || normalizedEditProjectDescription !== normalizedCurrentProjectDescription
      || managerAssignmentChanged
    )
  )

  const currentMember = members.find((member) => member.user.userId === currentUserId)
  const currentRole: WorkspaceMemberRoleType = workspaceQuery.data.owner.userId === currentUserId
    ? 'OWNER'
    : currentMember?.role ?? 'MEMBER'
  const isOwner = currentRole === 'OWNER'
  const isWorkspaceManager = isOwner || currentRole === 'ADMIN'
  const canManageWorkspace = isOwner
  const canCreateProject = isWorkspaceManager
  const teamMembersByTeamId = teamMembershipQuery.data ?? new Map<number, WorkspaceTeamMember[]>()
  const teamMembershipMap = new Map<number, Set<string>>()
  teamMembersByTeamId.forEach((teamMembers, teamId) => {
    teamMembershipMap.set(teamId, new Set(teamMembers.map((member) => member.user.userId)))
  })
  const canManageProject = (project: Project) => {
    const isProjectManagerByUser = project.managerUser?.userId === currentUserId
    const isProjectManagerByTeam = Boolean(
      project.managerTeamId
      && currentUserId
      && teamMembershipMap.get(project.managerTeamId)?.has(currentUserId),
    )

    return isWorkspaceManager || isProjectManagerByUser || isProjectManagerByTeam
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={workspaceQuery.data.name}
        description={`Owner: ${workspaceQuery.data.owner.firstName} ${workspaceQuery.data.owner.lastName} · ${visibleMembers.length} thành viên · ${visibleProjects.length} project · Vai trò của bạn: ${currentRole}`}
        actions={
          canManageWorkspace ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="destructive" size="sm" onClick={() => setDeleteWorkspaceDialogOpen(true)} disabled={workspacePendingDelete}>
                <Trash2 className="mr-1.5 size-3.5" />
                Xóa workspace
              </Button>

              <Dialog open={editWsDialogOpen} onOpenChange={setEditWsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditWsName(workspaceQuery.data!.name)}
                  >
                    <Pencil className="mr-1.5 size-3.5" />
                    Chỉnh sửa
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Chỉnh sửa workspace</DialogTitle>
                    <DialogDescription>Đổi tên workspace.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label>Tên workspace</Label>
                    <Input
                      value={editWsName}
                      onChange={(e) => setEditWsName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canSubmitEditWorkspace) updateWorkspaceMutation.mutate()
                      }}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditWsDialogOpen(false)}>Hủy</Button>
                    <Button onClick={() => updateWorkspaceMutation.mutate()} disabled={updateWorkspaceMutation.isPending || !canSubmitEditWorkspace}>
                      {updateWorkspaceMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Lưu
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <Badge variant="outline" className="gap-1">
              <User className="size-3" />
              MEMBER chỉ có quyền đọc trừ project được giao manager
            </Badge>
          )
        }
      />

      <Tabs defaultValue="projects">
        <TabsList className="h-auto w-full justify-start overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="projects" className="shrink-0 gap-1.5">
            <FolderKanban className="size-3.5" />
            Projects ({visibleProjects.length})
          </TabsTrigger>
          <TabsTrigger value="members" className="shrink-0 gap-1.5">
            <Users className="size-3.5" />
            Thành viên ({visibleMembers.length})
          </TabsTrigger>
          <TabsTrigger value="invites" className="shrink-0 gap-1.5">
            <Link2 className="size-3.5" />
            Invites ({visibleInvites.length})
          </TabsTrigger>
          <TabsTrigger value="teams" className="shrink-0 gap-1.5">
            <UsersRound className="size-3.5" />
            Teams ({visibleTeams.length})
          </TabsTrigger>
        </TabsList>

        {/* Projects tab */}
        <TabsContent value="projects" className="mt-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Danh sách project trong workspace</p>
              {!canCreateProject && (
                <p className="text-xs text-muted-foreground">Bạn đang ở chế độ read-only. Chỉ owner/admin hoặc manager được phân scope mới có thể chỉnh sửa project.</p>
              )}
            </div>
            {canCreateProject && (
              <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1.5 size-3.5" />
                    Tạo project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tạo project mới</DialogTitle>
                    <DialogDescription>Project sẽ tự động tạo 3 cột trạng thái: To do, In Progress, Done.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="proj-name">Tên project</Label>
                      <Input
                        id="proj-name"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="Ví dụ: Sprint 1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proj-desc">Mô tả (tùy chọn)</Label>
                      <Textarea
                        id="proj-desc"
                        value={projectDescription}
                        onChange={(e) => setProjectDescription(e.target.value)}
                        placeholder="Mô tả ngắn về project..."
                        rows={3}
                      />
                    </div>
                    {isOwner && (
                      <>
                        <div className="space-y-2">
                          <Label>Manager user (tùy chọn)</Label>
                          <Select
                            value={projectManagerUserId || 'none'}
                            onValueChange={(value) => setProjectManagerUserId(value === 'none' ? '' : value)}
                          >
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
                          <Select
                            value={projectManagerTeamId || 'none'}
                            onValueChange={(value) => setProjectManagerTeamId(value === 'none' ? '' : value)}
                          >
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
                    <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>Hủy</Button>
                    <Button onClick={() => createProjectMutation.mutate()} disabled={createProjectMutation.isPending || !projectName.trim()}>
                      {createProjectMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Tạo
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {visibleProjects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderKanban className="mb-3 size-10 text-muted-foreground/30" />
                <p className="text-sm font-medium">Chưa có project nào</p>
                <p className="mt-1 text-xs text-muted-foreground">Tạo project đầu tiên để bắt đầu</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {visibleProjects.map((project) => {
                const canManageCurrentProject = canManageProject(project)

                return (
                  <Card key={project.id} className="group h-full transition-all hover:border-primary/30 hover:shadow-sm">
                    <CardContent className="flex items-start gap-3 p-4">
                      <Link to={`/workspaces/${workspaceId}/projects/${project.id}`} className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-sm font-bold text-accent-foreground">
                          {project.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{project.name}</p>
                          {project.description && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{project.description}</p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant={project.status === 'ACTIVE' ? 'default' : project.status === 'COMPLETED' ? 'secondary' : 'outline'} className="text-[10px]">
                              {project.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {project.createdBy.firstName} {project.createdBy.lastName}
                            </span>
                          </div>
                          {(project.managerUser || project.managerTeamName) && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {project.managerUser && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Manager user: {project.managerUser.firstName} {project.managerUser.lastName}
                                </Badge>
                              )}
                              {project.managerTeamName && (
                                <Badge variant="outline" className="text-[10px]">
                                  Manager team: {project.managerTeamName}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </Link>
                      {canManageCurrentProject && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditProjectId(project.id)
                                setEditProjectName(project.name)
                                setEditProjectDescription(project.description ?? '')
                                setEditProjectManagerUserId(project.managerUser?.userId ?? '')
                                setEditProjectManagerTeamId(project.managerTeamId ? String(project.managerTeamId) : '')
                                setEditProjectDialogOpen(true)
                              }}
                            >
                              <Pencil className="mr-2 size-3.5" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {project.status !== 'ACTIVE' && (
                              <DropdownMenuItem onClick={() => updateProjectStatusMutation.mutate({ projectId: project.id, status: 'ACTIVE' })}>
                                <RotateCcw className="mr-2 size-3.5" />
                                Kích hoạt lại
                              </DropdownMenuItem>
                            )}
                            {project.status !== 'COMPLETED' && (
                              <DropdownMenuItem onClick={() => updateProjectStatusMutation.mutate({ projectId: project.id, status: 'COMPLETED' })}>
                                <CheckCircle2 className="mr-2 size-3.5" />
                                Hoàn thành
                              </DropdownMenuItem>
                            )}
                            {project.status !== 'ARCHIVED' && (
                              <DropdownMenuItem onClick={() => updateProjectStatusMutation.mutate({ projectId: project.id, status: 'ARCHIVED' })}>
                                <Archive className="mr-2 size-3.5" />
                                Lưu trữ
                              </DropdownMenuItem>
                            )}
                            {isWorkspaceManager && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    setDeleteProject(project)
                                    setDeleteProjectDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="mr-2 size-3.5" />
                                  Xóa project
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Edit project dialog */}
          <Dialog
            open={editProjectDialogOpen}
            onOpenChange={(open) => {
              setEditProjectDialogOpen(open)
              if (!open) {
                setEditProjectId(null)
                setEditProjectManagerUserId('')
                setEditProjectManagerTeamId('')
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Chỉnh sửa project</DialogTitle>
                <DialogDescription>
                  {isOwner
                    ? 'Cập nhật thông tin và phân công manager cho project.'
                    : 'Cập nhật thông tin project. Chỉ owner mới được chỉnh manager user/team.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Tên project</Label>
                  <Input value={editProjectName} onChange={(e) => setEditProjectName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Mô tả</Label>
                  <Textarea value={editProjectDescription} onChange={(e) => setEditProjectDescription(e.target.value)} rows={3} />
                </div>
                {isOwner && (
                  <>
                    <div className="space-y-2">
                      <Label>Manager user</Label>
                      <Select
                        value={editProjectManagerUserId || 'none'}
                        onValueChange={(value) => setEditProjectManagerUserId(value === 'none' ? '' : value)}
                      >
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
                      <Select
                        value={editProjectManagerTeamId || 'none'}
                        onValueChange={(value) => setEditProjectManagerTeamId(value === 'none' ? '' : value)}
                      >
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
                <Button variant="outline" onClick={() => setEditProjectDialogOpen(false)}>Hủy</Button>
                <Button onClick={() => updateProjectMutation.mutate()} disabled={updateProjectMutation.isPending || !canSubmitEditProject}>
                  {updateProjectMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Lưu
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={deleteProjectDialogOpen}
            onOpenChange={(open) => {
              setDeleteProjectDialogOpen(open)
              if (!open) {
                setDeleteProject(null)
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Xóa project</DialogTitle>
                <DialogDescription>
                  Bạn có chắc muốn xóa project {deleteProject ? `"${deleteProject.name}"` : 'này'} không?
                  Hành động này sẽ xóa toàn bộ goals, tasks, lịch và comment liên quan.
                  Sau khi xác nhận, bạn có 5 giây để hoàn tác.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteProjectDialogOpen(false)}>Hủy</Button>
                <Button
                  variant="destructive"
                  onClick={scheduleProjectDelete}
                  disabled={selectedProjectPendingDelete || !deleteProject}
                >
                  {selectedProjectPendingDelete && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Xác nhận xóa
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Members tab */}
        <TabsContent value="members" className="mt-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Quản lý thành viên và phân quyền</p>
              {!canManageWorkspace && (
                <p className="text-xs text-muted-foreground">Chỉ owner có quyền thêm/xóa thành viên và đổi role.</p>
              )}
            </div>
            {canManageWorkspace && (
              <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="mr-1.5 size-3.5" />
                    Thêm thành viên
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Thêm thành viên</DialogTitle>
                    <DialogDescription>Nhập User ID hoặc email và chọn vai trò cho thành viên mới.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="member-id">User ID hoặc email</Label>
                      <Input
                        id="member-id"
                        value={memberUserId}
                        onChange={(e) => setMemberUserId(e.target.value)}
                        placeholder="Ví dụ: 4f8... hoặc user@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Vai trò</Label>
                      <div className="flex gap-2">
                        {(['ADMIN', 'MEMBER'] as const).map((r) => (
                          <Button
                            key={r}
                            type="button"
                            variant={memberRole === r ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setMemberRole(r)}
                          >
                            {r}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>Hủy</Button>
                    <Button onClick={() => addMemberMutation.mutate()} disabled={addMemberMutation.isPending || !memberUserId.trim()}>
                      {addMemberMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Thêm
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="space-y-2">
            {visibleMembers.map((member) => {
              const RoleIcon = roleIcon[member.role]
              const memberDeleteKey = `member-${member.user.userId}`
              const memberPendingDelete = pendingDeleteByKey.get(memberDeleteKey)
              return (
                <div key={member.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30 sm:flex-nowrap">
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {member.user.firstName.charAt(0)}{member.user.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{member.user.firstName} {member.user.lastName}</p>
                    <p className="text-xs text-muted-foreground">{member.user.email}</p>
                  </div>
                  <Badge variant={roleBadgeVariant[member.role]} className="gap-1">
                    <RoleIcon className="size-3" />
                    {member.role}
                  </Badge>
                  {canManageWorkspace && member.role !== 'OWNER' && member.user.userId !== currentUserId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="size-8 p-0">···</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(['ADMIN', 'MEMBER'] as const).map((r) => (
                          <DropdownMenuItem
                            key={r}
                            disabled={member.role === r}
                            onClick={() => {
                              workspaceApi
                                .updateMemberRole(workspaceId, member.user.userId, r)
                                .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) }))
                                .catch((err: Error) => toast.error('Cập nhật role thất bại', { description: err.message }))
                            }}
                          >
                            Đổi thành {r}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={Boolean(memberPendingDelete)}
                          onClick={() => {
                            openQuickDeleteConfirm({
                              key: memberDeleteKey,
                              entityType: 'member',
                              entityId: member.id,
                              title: `${member.user.firstName} ${member.user.lastName}`,
                              userId: member.user.userId,
                            })
                          }}
                        >
                          <Trash2 className="mr-2 size-3.5" />
                          {memberPendingDelete ? 'Đang chờ xóa...' : 'Xóa khỏi workspace'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )
            })}
          </div>
        </TabsContent>

        {/* Invites tab */}
        <TabsContent value="invites" className="mt-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Quản lý invite link cho workspace</p>
              {!canManageWorkspace && (
                <p className="text-xs text-muted-foreground">Chỉ owner có quyền tạo hoặc thu hồi invite.</p>
              )}
            </div>
            {canManageWorkspace && (
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1.5 size-3.5" />
                    Tạo invite
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tạo invite link</DialogTitle>
                    <DialogDescription>Chia sẻ link hoặc QR code để mời thành viên tham gia workspace.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Vai trò được gán</Label>
                      <div className="flex gap-2">
                        {(['ADMIN', 'MEMBER'] as const).map((r) => (
                          <Button key={r} type="button" variant={inviteRole === r ? 'default' : 'outline'} size="sm" onClick={() => setInviteRole(r)}>
                            {r}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Giới hạn lượt dùng (tùy chọn)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(e.target.value)}
                        placeholder="Không giới hạn"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Hủy</Button>
                    <Button onClick={() => createInviteMutation.mutate()} disabled={createInviteMutation.isPending}>
                      {createInviteMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Tạo
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {visibleInvites.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Link2 className="mb-3 size-10 text-muted-foreground/30" />
                <p className="text-sm font-medium">Chưa có invite nào</p>
                <p className="mt-1 text-xs text-muted-foreground">Tạo invite link để mời thành viên</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {visibleInvites.map((invite) => {
                const inviteUrl = `${window.location.origin}/join?code=${invite.inviteCode}`
                const inviteDeleteKey = `invite-${invite.id}`
                const invitePendingDelete = pendingDeleteByKey.get(inviteDeleteKey)
                return (
                  <div key={invite.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30 sm:flex-nowrap">
                    <QrCode className="size-8 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono">{invite.inviteCode}</code>
                        <Badge variant="outline" className="text-[10px]">{invite.roleToAssign}</Badge>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {invite.usedCount}{invite.maxUses ? `/${invite.maxUses}` : ''} lượt dùng
                        {invite.expiresAt ? ` · Hết hạn: ${invite.expiresAt}` : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => {
                        void navigator.clipboard.writeText(inviteUrl)
                        toast.success('Đã copy invite link')
                      }}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    {canManageWorkspace && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          openQuickDeleteConfirm({
                            key: inviteDeleteKey,
                            entityType: 'invite',
                            entityId: invite.id,
                            title: invite.inviteCode,
                          })
                        }}
                        disabled={Boolean(invitePendingDelete)}
                      >
                        {invitePendingDelete?.status === 'finalizing'
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : <Trash2 className="size-3.5" />}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Teams tab */}
        <TabsContent value="teams" className="mt-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Quản lý team trong workspace</p>
              {!canManageWorkspace && (
                <p className="text-xs text-muted-foreground">Chỉ owner có quyền tạo hoặc xóa team.</p>
              )}
            </div>
            {canManageWorkspace && (
              <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1.5 size-3.5" />
                    Tạo team
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tạo team mới</DialogTitle>
                    <DialogDescription>Nhóm thành viên lại để phân công hiệu quả hơn.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Tên team</Label>
                      <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Ví dụ: Frontend Team" />
                    </div>
                    <div className="space-y-2">
                      <Label>Mô tả (tùy chọn)</Label>
                      <Textarea value={teamDescription} onChange={(e) => setTeamDescription(e.target.value)} rows={3} placeholder="Mô tả ngắn về team..." />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setTeamDialogOpen(false)}>Hủy</Button>
                    <Button onClick={() => createTeamMutation.mutate()} disabled={createTeamMutation.isPending || !teamName.trim()}>
                      {createTeamMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Tạo
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {visibleTeams.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UsersRound className="mb-3 size-10 text-muted-foreground/30" />
                <p className="text-sm font-medium">Chưa có team nào</p>
                <p className="mt-1 text-xs text-muted-foreground">Tạo team để nhóm thành viên</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {visibleTeams.map((team) => {
                const teamMembers = teamMembersByTeamId.get(team.id) ?? []
                const teamMemberIds = new Set(teamMembers.map((member) => member.user.userId))
                const visibleTeamMembers = teamMembers.filter(
                  (teamMember) => !pendingTeamMemberKeySet.has(`${team.id}-${teamMember.user.userId}`),
                )
                const availableWorkspaceMembers = visibleMembers.filter(
                  (member) => !teamMemberIds.has(member.user.userId),
                )
                const selectedUserId = teamMemberDraftByTeamId[team.id] ?? ''
                const teamDeleteKey = `team-${team.id}`
                const teamPendingDelete = pendingDeleteByKey.get(teamDeleteKey)

                return (
                  <Card key={team.id} className="group transition-all hover:border-primary/30 hover:shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-sm font-semibold">{team.name}</CardTitle>
                        {canManageWorkspace && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-destructive opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            onClick={() => {
                              openQuickDeleteConfirm({
                                key: teamDeleteKey,
                                entityType: 'team',
                                entityId: team.id,
                                title: team.name,
                              })
                            }}
                            disabled={Boolean(teamPendingDelete)}
                          >
                            {teamPendingDelete?.status === 'finalizing'
                              ? <Loader2 className="size-3.5 animate-spin" />
                              : <Trash2 className="size-3.5" />}
                          </Button>
                        )}
                      </div>
                      {team.description && <p className="text-xs text-muted-foreground">{team.description}</p>}
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="size-3" />
                        <span>{visibleTeamMembers.length} thành viên</span>
                      </div>

                      <div className="space-y-1.5">
                        {visibleTeamMembers.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Chưa có thành viên trong team này.</p>
                        ) : (
                          visibleTeamMembers.map((teamMember) => (
                            <div
                              key={teamMember.id}
                              className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/25 px-2 py-1.5"
                            >
                              <Avatar className="size-7 shrink-0">
                                <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                                  {teamMember.user.firstName.charAt(0)}{teamMember.user.lastName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">
                                  {teamMember.user.firstName} {teamMember.user.lastName}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">{teamMember.user.email}</p>
                              </div>
                              {canManageWorkspace && (
                                (() => {
                                  const teamMemberDeleteKey = `team-member-${team.id}-${teamMember.user.userId}`
                                  const teamMemberPendingDelete = pendingDeleteByKey.get(teamMemberDeleteKey)

                                  return (
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => {
                                        openQuickDeleteConfirm({
                                          key: teamMemberDeleteKey,
                                          entityType: 'team-member',
                                          entityId: teamMember.id,
                                          title: `${teamMember.user.firstName} ${teamMember.user.lastName}`,
                                          userId: teamMember.user.userId,
                                          teamId: team.id,
                                        })
                                      }}
                                      disabled={Boolean(teamMemberPendingDelete)}
                                    >
                                      {teamMemberPendingDelete?.status === 'finalizing'
                                        ? <Loader2 className="size-3 animate-spin" />
                                        : <Trash2 className="size-3" />}
                                    </Button>
                                  )
                                })()
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {canManageWorkspace && (
                        <div className="rounded-md border border-border/70 bg-muted/35 p-2.5">
                          <p className="mb-2 text-[11px] font-medium text-muted-foreground">Thêm thành viên vào team</p>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Select
                              value={selectedUserId || 'none'}
                              onValueChange={(value) => {
                                setTeamMemberDraftByTeamId((prev) => ({
                                  ...prev,
                                  [team.id]: value === 'none' ? '' : value,
                                }))
                              }}
                            >
                              <SelectTrigger className="sm:flex-1">
                                <SelectValue placeholder="Chọn thành viên workspace" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Chọn thành viên</SelectItem>
                                {availableWorkspaceMembers.map((member) => (
                                  <SelectItem key={member.user.userId} value={member.user.userId}>
                                    {member.user.firstName} {member.user.lastName} ({member.role})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => {
                                if (!selectedUserId) {
                                  return
                                }
                                addTeamMemberMutation.mutate({ teamId: team.id, userId: selectedUserId })
                              }}
                              disabled={addTeamMemberMutation.isPending || !selectedUserId}
                            >
                              {addTeamMemberMutation.isPending && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                              Thêm
                            </Button>
                          </div>
                          {availableWorkspaceMembers.length === 0 && (
                            <p className="mt-2 text-[11px] text-muted-foreground">Tất cả thành viên workspace đã thuộc team này.</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {canManageWorkspace && (
        <Dialog open={deleteWorkspaceDialogOpen} onOpenChange={setDeleteWorkspaceDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xóa workspace</DialogTitle>
              <DialogDescription>
                Bạn có chắc muốn xóa workspace "{workspaceQuery.data.name}" không?
                Hành động này sẽ xóa toàn bộ project, goals, tasks, comment, team và invite liên quan.
                Sau khi xác nhận, bạn có 5 giây để hoàn tác.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteWorkspaceDialogOpen(false)}>Hủy</Button>
              <Button
                variant="destructive"
                onClick={scheduleWorkspaceDelete}
                disabled={workspacePendingDelete}
              >
                {workspacePendingDelete && <Loader2 className="mr-2 size-4 animate-spin" />}
                Xác nhận xóa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canManageWorkspace && (
        <Dialog
          open={quickDeleteDialogOpen}
          onOpenChange={(open) => {
            setQuickDeleteDialogOpen(open)
            if (!open) {
              setQuickDeleteIntent(null)
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{quickDeleteIntent?.entityType === 'invite' ? 'Thu hồi invite' : 'Xác nhận xóa'}</DialogTitle>
              <DialogDescription>
                {quickDeleteIntent
                  ? `Bạn có chắc muốn ${PENDING_ENTITY_ACTION[quickDeleteIntent.entityType]} ${PENDING_ENTITY_LABEL[quickDeleteIntent.entityType]} "${quickDeleteIntent.title}" không? Sau khi xác nhận, bạn có 5 giây để hoàn tác.`
                  : 'Xác nhận thao tác xóa.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setQuickDeleteDialogOpen(false)}>Hủy</Button>
              <Button
                variant="destructive"
                onClick={scheduleQuickDeleteFromIntent}
                disabled={!quickDeleteIntent || selectedQuickDeletePending}
              >
                {selectedQuickDeletePending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Xác nhận
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <DeleteUndoStack
        items={pendingDeletes.map((pendingDelete) => ({
          id: pendingDelete.key,
          entityLabel: PENDING_ENTITY_LABEL[pendingDelete.entityType],
          title: pendingDelete.title,
          expiresAt: pendingDelete.expiresAt,
          windowMs: DELETE_UNDO_WINDOW_MS,
          status: pendingDelete.status,
        }))}
        clockMs={clockMs}
        onUndo={(itemId) => undoPendingDelete(String(itemId))}
      />
    </div>
  )
}
