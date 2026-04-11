import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, FolderKanban, Users, Loader2, UserPlus, Trash2, Crown, Shield, User, MoreHorizontal, Pencil, Archive, CheckCircle2, RotateCcw, Link2, QrCode, Copy, UsersRound, Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { DeferredDeleteStack } from '@/components/shared/deferred-delete-stack'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { projectApi } from '@/lib/api/modules/project-api'
import { workspaceInviteApi } from '@/lib/api/modules/workspace-invite-api'
import { workspaceTeamApi } from '@/lib/api/modules/workspace-team-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useWorkspaceRealtime } from '@/lib/websocket/use-domain-realtime'
import { useAuthStore } from '@/app/store/auth-store'
import { useDeferredDelete } from '@/lib/delete/use-deferred-delete'
import type { Project, ProjectStatusType, WorkspaceMemberRoleType, WorkspaceTeamMember } from '@/types/domain'

/** Human-friendly display name for workspace member roles */
const roleDisplayName: Record<WorkspaceMemberRoleType, string> = {
  OWNER: 'Chủ sở hữu',
  ADMIN: 'Quản lý',
  MEMBER: 'Thành viên',
}

/** Short description shown in tooltip for each role */
const roleDescription: Record<WorkspaceMemberRoleType, string> = {
  OWNER: 'Tạo workspace, có toàn quyền: xóa workspace, quản lý thành viên, phân quyền mọi người.',
  ADMIN: 'Quản lý workspace ủy quyền: tạo project, tào team, thêm/xóa thành viên. Không thể xóa workspace.',
  MEMBER: 'Thành viên thường: xem project, làm việc với task được giao. Không tạo hoặc xóa project.',
}

const roleIcon: Record<WorkspaceMemberRoleType, typeof Crown> = {
  OWNER: Crown,
  ADMIN: Shield,
  MEMBER: User,
}

const roleBadgeClassName: Record<WorkspaceMemberRoleType, string> = {
  OWNER: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200',
  ADMIN: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200',
  MEMBER: 'border-border bg-muted text-muted-foreground',
}

function RoleBadge({ role }: { role: WorkspaceMemberRoleType }) {
  const Icon = roleIcon[role]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex h-6 cursor-default items-center gap-1 rounded-md border px-2 text-[11px] font-semibold ${roleBadgeClassName[role]}`}
        >
          <Icon className="size-3 shrink-0" />
          {roleDisplayName[role]}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60 text-xs">
        <p className="font-semibold">{roleDisplayName[role]}</p>
        <p className="mt-0.5 text-muted-foreground">{roleDescription[role]}</p>
      </TooltipContent>
    </Tooltip>
  )
}

const MEMBER_PAGE_SIZE = 10
const TEAM_PAGE_SIZE = 6

type WorkspaceDetailDeletePayload = {
  kind: 'project' | 'workspace' | 'team'
  id: number
  name: string
}

const TEAM_MEMBER_PREVIEW_COUNT = 5

function buildPageNumbers(current: number, total: number): Array<number | '...'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: Array<number | '...'> = []
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  pages.push(1)
  if (left > 2) pages.push('...')
  for (let p = left; p <= right; p++) pages.push(p)
  if (right < total - 1) pages.push('...')
  pages.push(total)
  return pages
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
  const [memberSearch, setMemberSearch] = useState('')
  const [memberRoleFilter, setMemberRoleFilter] = useState<WorkspaceMemberRoleType | 'ALL'>('ALL')
  const [memberSortKey, setMemberSortKey] = useState<'name' | 'role' | 'joined'>('role')
  const [memberPage, setMemberPage] = useState(1)
  const [teamPage, setTeamPage] = useState(1)
  const [teamSearch, setTeamSearch] = useState('')
  const [editWsDialogOpen, setEditWsDialogOpen] = useState(false)
  const [editWsName, setEditWsName] = useState('')
  const [editWsInitialName, setEditWsInitialName] = useState('')
  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false)
  const [editProjectId, setEditProjectId] = useState<number | null>(null)
  const [editProjectName, setEditProjectName] = useState('')
  const [editProjectDescription, setEditProjectDescription] = useState('')
  const [editProjectManagerUserId, setEditProjectManagerUserId] = useState('')
  const [editProjectManagerTeamId, setEditProjectManagerTeamId] = useState('')
  const [editProjectInitialName, setEditProjectInitialName] = useState('')
  const [editProjectInitialDescription, setEditProjectInitialDescription] = useState('')
  const [editProjectInitialManagerUserId, setEditProjectInitialManagerUserId] = useState('')
  const [editProjectInitialManagerTeamId, setEditProjectInitialManagerTeamId] = useState('')
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false)
  const [deleteProject, setDeleteProject] = useState<Project | null>(null)
  const [deleteWorkspaceDialogOpen, setDeleteWorkspaceDialogOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRoleType>('MEMBER')
  const [inviteMaxUses, setInviteMaxUses] = useState('')
  const [teamDialogOpen, setTeamDialogOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
  const [teamMemberDraftByTeamId, setTeamMemberDraftByTeamId] = useState<Record<number, string>>({})
  const [teamMemberExpanded, setTeamMemberExpanded] = useState<Record<number, boolean>>({})

  const currentUserId = useAuthStore((state) => state.currentUser?.userId ?? null)

  useWorkspaceRealtime(Number.isFinite(workspaceId) ? workspaceId : null)

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

  const {
    pendingDeletes: pendingWorkspaceDeletes,
    clockMs: workspaceDeleteClockMs,
    undoWindowMs: workspaceDeleteUndoWindowMs,
    scheduleDelete: scheduleWorkspaceDelete,
    undoDelete: undoWorkspaceDelete,
    isQueued: isWorkspaceDeleteQueued,
  } = useDeferredDelete<WorkspaceDetailDeletePayload>({
    onFinalize: async (payload) => {
      if (payload.kind === 'project') {
        await projectApi.remove(payload.id)
        return
      }

      if (payload.kind === 'workspace') {
        await workspaceApi.remove(payload.id)
        return
      }

      await workspaceTeamApi.remove(payload.id)
    },
    onFinalizeSuccess: async (payload) => {
      if (payload.kind === 'project') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) }),
        ])
        return
      }

      if (payload.kind === 'workspace') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
          queryClient.invalidateQueries({ queryKey: ['projects', 'workspace'] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.teams.byWorkspace(workspaceId) }),
        ])

        navigate('/dashboard', { replace: true })
        return
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.byWorkspace(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: ['workspace-teams', 'members-map', workspaceId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) }),
      ])
    },
    pendingMessage: (entry) => {
      const entityName = entry.payload.kind === 'project'
        ? 'Project'
        : entry.payload.kind === 'workspace'
          ? 'Workspace'
          : 'Team'
      return `${entityName} "${entry.label}" đã được lên lịch xóa. Bạn có 5 giây để hoàn tác.`
    },
    successMessage: (entry) => {
      const entityName = entry.payload.kind === 'project'
        ? 'project'
        : entry.payload.kind === 'workspace'
          ? 'workspace'
          : 'team'
      return `Đã xóa ${entityName} "${entry.label}"`
    },
    alreadyDeletedMessage: (entry) => {
      const entityName = entry.payload.kind === 'project'
        ? 'Project'
        : entry.payload.kind === 'workspace'
          ? 'Workspace'
          : 'Team'
      return `${entityName} "${entry.label}" đã được xóa trước đó`
    },
    errorTitle: 'Xóa dữ liệu thất bại',
  })

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

  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: number) => workspaceInviteApi.revoke(inviteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invites.byWorkspace(workspaceId) })
      toast.success('Thu hồi invite thành công')
    },
    onError: (error: Error) => toast.error('Thu hồi thất bại', { description: error.message }),
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

  const removeTeamMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: number; userId: string }) =>
      workspaceTeamApi.removeMember(teamId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams.byWorkspace(workspaceId) })
      void queryClient.invalidateQueries({ queryKey: ['workspace-teams', 'members-map', workspaceId] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      toast.success('Xóa thành viên khỏi team thành công')
    },
    onError: (error: Error) => toast.error('Xóa thành viên khỏi team thất bại', { description: error.message }),
  })

  const isLoading = workspaceQuery.isLoading || membersQuery.isLoading || projectsQuery.isLoading
  const workspace = workspaceQuery.data ?? null
  const members = membersQuery.data ?? []
  const projects = projectsQuery.data?.content ?? []
  const invites = invitesQuery.data ?? []
  const teams = teamsQuery.data ?? []
  const pendingProjectIds = new Set<number>()
  const pendingTeamIds = new Set<number>()
  const workspaceDeleteQueued = isWorkspaceDeleteQueued(`workspace-${workspaceId}`)

  for (const pendingEntry of pendingWorkspaceDeletes) {
    if (pendingEntry.payload.kind === 'project') {
      pendingProjectIds.add(pendingEntry.payload.id)
      continue
    }

    if (pendingEntry.payload.kind === 'team') {
      pendingTeamIds.add(pendingEntry.payload.id)
    }
  }

  const visibleProjects = projects.filter((project) => !pendingProjectIds.has(project.id))
  const visibleTeams = teams.filter((team) => !pendingTeamIds.has(team.id))

  const currentMember = members.find((member) => member.user.userId === currentUserId)
  const currentRole: WorkspaceMemberRoleType = workspace?.owner.userId === currentUserId
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

  const isWorkspaceEditDirty = editWsName.trim() !== editWsInitialName
  const isProjectEditDirty = (
    editProjectName.trim() !== editProjectInitialName
    || editProjectDescription.trim() !== editProjectInitialDescription
    || editProjectManagerUserId !== editProjectInitialManagerUserId
    || editProjectManagerTeamId !== editProjectInitialManagerTeamId
  )

  const ROLE_SORT_ORDER: Record<WorkspaceMemberRoleType, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 }

  const filteredMembers = useMemo(() => {
    let list = members.slice()
    const q = memberSearch.trim().toLowerCase()
    if (q) {
      list = list.filter((m) => {
        const fullName = `${m.user.firstName} ${m.user.lastName}`.toLowerCase()
        return fullName.includes(q) || m.user.email.toLowerCase().includes(q)
      })
    }
    if (memberRoleFilter !== 'ALL') {
      list = list.filter((m) => m.role === memberRoleFilter)
    }
    list.sort((a, b) => {
      if (memberSortKey === 'role') return ROLE_SORT_ORDER[a.role] - ROLE_SORT_ORDER[b.role]
      if (memberSortKey === 'name') return `${a.user.firstName} ${a.user.lastName}`.localeCompare(`${b.user.firstName} ${b.user.lastName}`, 'vi')
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
    })
    return list
  }, [members, memberSearch, memberRoleFilter, memberSortKey])

  const memberTotalPages = Math.max(1, Math.ceil(filteredMembers.length / MEMBER_PAGE_SIZE))
  const memberCurrentPage = Math.min(memberPage, memberTotalPages)
  const paginatedMembers = filteredMembers.slice((memberCurrentPage - 1) * MEMBER_PAGE_SIZE, memberCurrentPage * MEMBER_PAGE_SIZE)

  const filteredTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase()
    if (!q) return visibleTeams
    return visibleTeams.filter((t) => t.name.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q)))
  }, [visibleTeams, teamSearch])

  const teamTotalPages = Math.max(1, Math.ceil(filteredTeams.length / TEAM_PAGE_SIZE))
  const teamCurrentPage = Math.min(teamPage, teamTotalPages)
  const paginatedTeams = filteredTeams.slice((teamCurrentPage - 1) * TEAM_PAGE_SIZE, teamCurrentPage * TEAM_PAGE_SIZE)

  if (isLoading) {
    return <LoadingPanel />
  }

  if (!workspace) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Workspace không tồn tại.</p>
        <Link to="/workspaces" className="mt-2 text-sm text-primary hover:underline">Quay lại danh sách</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title={workspace.name}
        description={`Owner: ${workspace.owner.firstName} ${workspace.owner.lastName} · ${members.length} thành viên · ${visibleProjects.length} project · Vai trò của bạn: ${roleDisplayName[currentRole]}`}
        actions={
          canManageWorkspace ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="destructive" size="sm" onClick={() => setDeleteWorkspaceDialogOpen(true)}>
                <Trash2 className="mr-1.5 size-3.5" />
                Xóa workspace
              </Button>

              <Dialog
                open={editWsDialogOpen}
                onOpenChange={(open) => {
                  setEditWsDialogOpen(open)
                  if (!open) {
                    setEditWsInitialName('')
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditWsName(workspace.name)
                      setEditWsInitialName(workspace.name.trim())
                    }}
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
                        if (e.key === 'Enter' && editWsName.trim() && isWorkspaceEditDirty) updateWorkspaceMutation.mutate()
                      }}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditWsDialogOpen(false)}>Hủy</Button>
                    <Button onClick={() => updateWorkspaceMutation.mutate()} disabled={updateWorkspaceMutation.isPending || !editWsName.trim() || !isWorkspaceEditDirty}>
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
        <TabsList className="h-auto w-full justify-start">
          <TabsTrigger value="projects" className="shrink-0 gap-1.5">
            <FolderKanban className="size-3.5" />
            Projects ({visibleProjects.length})
          </TabsTrigger>
          <TabsTrigger value="members" className="shrink-0 gap-1.5">
            <Users className="size-3.5" />
            Thành viên ({members.length})
          </TabsTrigger>
          <TabsTrigger value="invites" className="shrink-0 gap-1.5">
            <Link2 className="size-3.5" />
            Invites ({invites.length})
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
                                  {member.user.firstName} {member.user.lastName} ({roleDisplayName[member.role]})
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
                              {visibleTeams.map((team) => (
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
                                setEditProjectInitialName(project.name.trim())
                                setEditProjectInitialDescription((project.description ?? '').trim())
                                setEditProjectInitialManagerUserId(project.managerUser?.userId ?? '')
                                setEditProjectInitialManagerTeamId(project.managerTeamId ? String(project.managerTeamId) : '')
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
                setEditProjectInitialName('')
                setEditProjectInitialDescription('')
                setEditProjectInitialManagerUserId('')
                setEditProjectInitialManagerTeamId('')
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
                              {member.user.firstName} {member.user.lastName} ({roleDisplayName[member.role]})
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
                          {visibleTeams.map((team) => (
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
                <Button onClick={() => updateProjectMutation.mutate()} disabled={updateProjectMutation.isPending || !editProjectName.trim() || !isProjectEditDirty}>
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
                  Project sẽ được xóa sau 5 giây và bạn có thể hoàn tác trong thời gian đó.
                  Sau khi hết thời gian, toàn bộ goals, tasks, lịch và comment liên quan sẽ bị xóa.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteProjectDialogOpen(false)}>Hủy</Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (!deleteProject) {
                      return
                    }

                    const queued = scheduleWorkspaceDelete({
                      key: `project-${deleteProject.id}`,
                      label: deleteProject.name,
                      payload: {
                        kind: 'project',
                        id: deleteProject.id,
                        name: deleteProject.name,
                      },
                    })

                    if (queued) {
                      setDeleteProjectDialogOpen(false)
                      setDeleteProject(null)
                    }
                  }}
                  disabled={Boolean(deleteProject && isWorkspaceDeleteQueued(`project-${deleteProject.id}`))}
                >
                  Xóa project (5s undo)
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Members tab */}
        <TabsContent value="members" className="mt-4 space-y-4">
          {/* Role legend */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(['OWNER', 'ADMIN', 'MEMBER'] as const).map((r) => {
              const Icon = roleIcon[r]
              const accentClass = {
                OWNER: 'border-l-amber-400',
                ADMIN: 'border-l-blue-400',
                MEMBER: 'border-l-slate-300 dark:border-l-slate-600',
              }[r]
              return (
                <div key={r} className={`flex flex-col gap-1.5 rounded-lg border border-l-[3px] border-border/50 bg-card px-3 py-2.5 shadow-sm ${accentClass}`}>
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${roleBadgeClassName[r]}`}>
                    <Icon className="size-3" />
                    {roleDisplayName[r]}
                  </span>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{roleDescription[r]}</p>
                </div>
              )
            })}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={memberSearch}
                onChange={(e) => { setMemberSearch(e.target.value); setMemberPage(1) }}
                placeholder="Tìm tên hoặc email..."
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Select value={memberRoleFilter} onValueChange={(v) => { setMemberRoleFilter(v as WorkspaceMemberRoleType | 'ALL'); setMemberPage(1) }}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Tất cả vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả vai trò</SelectItem>
                <SelectItem value="OWNER">
                  <span className="flex items-center gap-1.5">
                    <Crown className="size-3 text-amber-600 dark:text-amber-400" />
                    Chủ sở hữu
                  </span>
                </SelectItem>
                <SelectItem value="ADMIN">
                  <span className="flex items-center gap-1.5">
                    <Shield className="size-3 text-blue-600 dark:text-blue-400" />
                    Quản lý
                  </span>
                </SelectItem>
                <SelectItem value="MEMBER">
                  <span className="flex items-center gap-1.5">
                    <User className="size-3 text-muted-foreground" />
                    Thành viên
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={memberSortKey} onValueChange={(v) => setMemberSortKey(v as 'name' | 'role' | 'joined')}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <ArrowUpDown className="mr-1.5 size-3" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="role">Theo vai trò</SelectItem>
                <SelectItem value="name">Theo tên</SelectItem>
                <SelectItem value="joined">Theo ngày tham gia</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground">{filteredMembers.length}/{members.length} thành viên</span>
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
                            {roleDisplayName[r]}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{roleDescription[memberRole]}</p>
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

          {/* Member list */}
          {paginatedMembers.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Users className="mb-3 size-8 text-muted-foreground/30" />
                <p className="text-sm font-medium">Không tìm thấy thành viên</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="grid grid-cols-[2.5rem_1fr_auto_auto] items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span />
                <span>Thành viên</span>
                <span>Vai trò</span>
                {canManageWorkspace && <span />}
              </div>
              <div className="divide-y divide-border/40">
                {paginatedMembers.map((member) => {
                  const isOwnerMember = member.role === 'OWNER'
                  const isSelf = member.user.userId === currentUserId
                  const joinedDate = new Date(member.joinedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  return (
                    <div key={member.id} className="grid grid-cols-[2.5rem_1fr_auto_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {member.user.firstName.charAt(0)}{member.user.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium">{member.user.firstName} {member.user.lastName}</p>
                          {isSelf && <Badge variant="outline" className="h-4 px-1 text-[9px]">Bạn</Badge>}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                        <p className="text-[10px] text-muted-foreground/60">Tham gia: {joinedDate}</p>
                      </div>
                      <RoleBadge role={member.role} />
                      {canManageWorkspace && !isOwnerMember && !isSelf ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
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
                                    .catch((err: Error) => toast.error('Cập nhật vai trò thất bại', { description: err.message }))
                                }}
                              >
                                Đổi thành {roleDisplayName[r]}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                workspaceApi
                                  .removeMember(workspaceId, member.user.userId)
                                  .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) }))
                                  .catch((err: Error) => toast.error('Xóa thành viên thất bại', { description: err.message }))
                              }}
                            >
                              <Trash2 className="mr-2 size-3.5" />
                              Xóa khỏi workspace
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : <span />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Member pagination */}
          {memberTotalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                Trang {memberCurrentPage}/{memberTotalPages} · {filteredMembers.length} thành viên
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="size-7" disabled={memberCurrentPage === 1} onClick={() => setMemberPage((p) => p - 1)}>
                  <ChevronLeft className="size-3.5" />
                </Button>
                {buildPageNumbers(memberCurrentPage, memberTotalPages).map((p, idx) =>
                  p === '...' ? (
                    <span key={`dots-${idx}`} className="flex size-7 items-center justify-center text-xs text-muted-foreground">⋯</span>
                  ) : (
                    <Button key={p} variant={memberCurrentPage === p ? 'default' : 'outline'} size="icon" className="size-7 text-xs" onClick={() => setMemberPage(p as number)}>{p}</Button>
                  )
                )}
                <Button variant="outline" size="icon" className="size-7" disabled={memberCurrentPage === memberTotalPages} onClick={() => setMemberPage((p) => p + 1)}>
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
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
                            {roleDisplayName[r]}
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

          {invites.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Link2 className="mb-3 size-10 text-muted-foreground/30" />
                <p className="text-sm font-medium">Chưa có invite nào</p>
                <p className="mt-1 text-xs text-muted-foreground">Tạo invite link để mời thành viên</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {invites.map((invite) => {
                const inviteUrl = `${window.location.origin}/join?code=${invite.inviteCode}`
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
                        onClick={() => revokeInviteMutation.mutate(invite.id)}
                        disabled={revokeInviteMutation.isPending}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Teams tab */}
        <TabsContent value="teams" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={teamSearch}
                onChange={(e) => { setTeamSearch(e.target.value); setTeamPage(1) }}
                placeholder="Tìm team theo tên..."
                className="h-8 pl-8 text-xs"
              />
            </div>
            <span className="text-xs text-muted-foreground">{filteredTeams.length}/{visibleTeams.length} teams</span>
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

          {filteredTeams.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UsersRound className="mb-3 size-10 text-muted-foreground/30" />
                <p className="text-sm font-medium">{visibleTeams.length === 0 ? 'Chưa có team nào' : 'Không tìm thấy team'}</p>
                {visibleTeams.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Tạo team để nhóm thành viên</p>}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="columns-1 gap-4 sm:columns-2">
                {paginatedTeams.map((team) => {
                  const teamMembers = teamMembersByTeamId.get(team.id) ?? []
                  const teamMemberIds = new Set(teamMembers.map((member) => member.user.userId))
                  const availableWorkspaceMembers = members.filter(
                    (member) => !teamMemberIds.has(member.user.userId),
                  )
                  const selectedUserId = teamMemberDraftByTeamId[team.id] ?? ''
                  const isExpanded = teamMemberExpanded[team.id] ?? false

                  // Sort: OWNER → ADMIN → MEMBER, then a-z within each group
                  const ROLE_ORDER: Record<WorkspaceMemberRoleType, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 }
                  const sortedTeamMembers = [...teamMembers].sort((a, b) => {
                    const wsMemberA = members.find((m) => m.user.userId === a.user.userId)
                    const wsMemberB = members.find((m) => m.user.userId === b.user.userId)
                    const roleA = wsMemberA?.role ?? 'MEMBER'
                    const roleB = wsMemberB?.role ?? 'MEMBER'
                    const cmp = ROLE_ORDER[roleA] - ROLE_ORDER[roleB]
                    if (cmp !== 0) return cmp
                    return `${a.user.firstName} ${a.user.lastName}`.localeCompare(`${b.user.firstName} ${b.user.lastName}`, 'vi')
                  })

                  const displayedMembers = isExpanded ? sortedTeamMembers : sortedTeamMembers.slice(0, TEAM_MEMBER_PREVIEW_COUNT)
                  const hiddenCount = sortedTeamMembers.length - TEAM_MEMBER_PREVIEW_COUNT

                  return (
                    <Card key={team.id} className="group mb-4 flex flex-col break-inside-avoid overflow-hidden transition-all hover:border-primary/30 hover:shadow-md">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                            {team.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <CardTitle className="text-sm font-semibold leading-tight">{team.name}</CardTitle>
                                {team.description && (
                                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{team.description}</p>
                                )}
                              </div>
                              {canManageWorkspace && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 shrink-0 text-muted-foreground/50 opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
                                  onClick={() => {
                                    void scheduleWorkspaceDelete({
                                      key: `team-${team.id}`,
                                      label: team.name,
                                      payload: { kind: 'team', id: team.id, name: team.name },
                                    })
                                  }}
                                  disabled={isWorkspaceDeleteQueued(`team-${team.id}`)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>
                            <div className="mt-1.5">
                              <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
                                <Users className="size-2.5" />
                                {team.memberCount} thành viên
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col gap-3 pt-0">
                        {/* Member list */}
                        <div className="space-y-0.5">
                          {teamMembers.length === 0 ? (
                            <p className="rounded-lg bg-muted/30 px-3 py-3 text-center text-xs text-muted-foreground">
                              Chưa có thành viên trong team này.
                            </p>
                          ) : (
                            <>
                              {displayedMembers.map((teamMember) => {
                                const workspaceMember = members.find((m) => m.user.userId === teamMember.user.userId)
                                return (
                                  <div
                                    key={teamMember.id}
                                    className="flex items-center gap-2 rounded-md p-1.5 transition-colors hover:bg-muted/40"
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
                                      <p className="truncate text-[10px] text-muted-foreground">{teamMember.user.email}</p>
                                    </div>
                                    {workspaceMember && (
                                      <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold ${roleBadgeClassName[workspaceMember.role]}`}>
                                        {roleDisplayName[workspaceMember.role]}
                                      </span>
                                    )}
                                    {canManageWorkspace && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 shrink-0 text-muted-foreground/40 hover:text-destructive"
                                        onClick={() => removeTeamMemberMutation.mutate({ teamId: team.id, userId: teamMember.user.userId })}
                                        disabled={removeTeamMemberMutation.isPending}
                                      >
                                        <Trash2 className="size-3" />
                                      </Button>
                                    )}
                                  </div>
                                )
                              })}
                              {hiddenCount > 0 && (
                                <button
                                  type="button"
                                  className="w-full rounded-md py-1.5 text-center text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                                  onClick={() => setTeamMemberExpanded((prev) => ({ ...prev, [team.id]: !isExpanded }))}
                                >
                                  {isExpanded ? 'Thu gọn' : `Xem thêm ${hiddenCount} thành viên`}
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {/* Add member */}
                        {canManageWorkspace && (
                          <div className="mt-auto rounded-lg border border-border/50 bg-muted/20 p-2.5">
                            <div className="flex gap-2">
                              <Select
                                value={selectedUserId || 'none'}
                                onValueChange={(value) => {
                                  setTeamMemberDraftByTeamId((prev) => ({
                                    ...prev,
                                    [team.id]: value === 'none' ? '' : value,
                                  }))
                                }}
                              >
                                <SelectTrigger className="h-8 flex-1 text-xs">
                                  <SelectValue placeholder="Thêm thành viên vào team..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Chọn thành viên</SelectItem>
                                  {availableWorkspaceMembers.map((member) => (
                                    <SelectItem key={member.user.userId} value={member.user.userId}>
                                      {member.user.firstName} {member.user.lastName} ({roleDisplayName[member.role]})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                className="h-8 shrink-0"
                                onClick={() => {
                                  if (!selectedUserId) return
                                  addTeamMemberMutation.mutate({ teamId: team.id, userId: selectedUserId })
                                }}
                                disabled={addTeamMemberMutation.isPending || !selectedUserId}
                              >
                                {addTeamMemberMutation.isPending ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Plus className="size-3.5" />
                                )}
                              </Button>
                            </div>
                            {availableWorkspaceMembers.length === 0 && (
                              <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                                Tất cả thành viên đã thuộc team này.
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Team pagination */}
              {teamTotalPages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">
                    Trang {teamCurrentPage}/{teamTotalPages} · {filteredTeams.length} teams
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="size-7" disabled={teamCurrentPage === 1} onClick={() => setTeamPage((p) => p - 1)}>
                      <ChevronLeft className="size-3.5" />
                    </Button>
                    {buildPageNumbers(teamCurrentPage, teamTotalPages).map((p, idx) =>
                      p === '...' ? (
                        <span key={`dots-${idx}`} className="flex size-7 items-center justify-center text-xs text-muted-foreground">⋯</span>
                      ) : (
                        <Button
                          key={p}
                          variant={teamCurrentPage === p ? 'default' : 'outline'}
                          size="icon"
                          className="size-7 text-xs"
                          onClick={() => setTeamPage(p as number)}
                        >
                          {p}
                        </Button>
                      )
                    )}
                    <Button variant="outline" size="icon" className="size-7" disabled={teamCurrentPage === teamTotalPages} onClick={() => setTeamPage((p) => p + 1)}>
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {canManageWorkspace && (
        <Dialog open={deleteWorkspaceDialogOpen} onOpenChange={setDeleteWorkspaceDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xóa workspace</DialogTitle>
              <DialogDescription>
                Bạn có chắc muốn xóa workspace "{workspace.name}" không?
                    Workspace sẽ được xóa sau 5 giây và bạn có thể hoàn tác trong thời gian đó.
                  Sau khi hết thời gian, toàn bộ project, goals, tasks, comment, team và invite liên quan sẽ bị xóa.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteWorkspaceDialogOpen(false)}>Hủy</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const queued = scheduleWorkspaceDelete({
                    key: `workspace-${workspaceId}`,
                    label: workspace.name,
                    payload: {
                      kind: 'workspace',
                      id: workspaceId,
                      name: workspace.name,
                    },
                  })

                  if (queued) {
                    setDeleteWorkspaceDialogOpen(false)
                  }
                }}
                disabled={workspaceDeleteQueued}
              >
                Xóa workspace (5s undo)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <DeferredDeleteStack
        pendingDeletes={pendingWorkspaceDeletes}
        clockMs={workspaceDeleteClockMs}
        undoWindowMs={workspaceDeleteUndoWindowMs}
        onUndo={undoWorkspaceDelete}
        itemTitle={(entry) => (
          entry.payload.kind === 'project'
            ? 'Đang xóa project'
            : entry.payload.kind === 'workspace'
              ? 'Đang xóa workspace'
              : 'Đang xóa team'
        )}
      />
    </div>
  )
}
