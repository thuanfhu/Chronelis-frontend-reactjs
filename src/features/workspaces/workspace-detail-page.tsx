import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, FolderKanban, Users, Loader2, UserPlus, Trash2, Crown, User, MoreHorizontal, Pencil, Archive, CheckCircle2, RotateCcw, Link2, QrCode, Copy, UsersRound, Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { DeferredDeleteStack } from '@/components/shared/deferred-delete-stack'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { highlightMatch } from '@/lib/utils/highlight-match'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ProjectFormFields } from '@/components/shared/project-form-fields'
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
import { ProjectStatusDonut } from '@/components/charts/project-status-donut'
import { GrowthComposedChart } from '@/components/charts/growth-composed-chart'
import { CompletionLineChart } from '@/components/charts/completion-line-chart'
import type { GrowthPoint } from '@/components/charts/growth-composed-chart'
import { workspaceInviteApi } from '@/lib/api/modules/workspace-invite-api'
import { workspaceTeamApi } from '@/lib/api/modules/workspace-team-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useWorkspaceRealtime } from '@/lib/websocket/use-domain-realtime'
import { useAuthStore } from '@/app/store/auth-store'
import { useDeferredDelete } from '@/lib/delete/use-deferred-delete'
import type { Project, ProjectStatusType, Workspace, WorkspaceMemberRoleType, WorkspaceTeamMember } from '@/types/domain'
import type { PageResult } from '@/types/domain'

/** i18n key suffix for each workspace member role */
const roleI18nKey: Record<WorkspaceMemberRoleType, string> = {
  OWNER: 'owner',
  MEMBER: 'member',
}

const roleIcon: Record<WorkspaceMemberRoleType, typeof Crown> = {
  OWNER: Crown,
  MEMBER: User,
}

const roleBadgeClassName: Record<WorkspaceMemberRoleType, string> = {
  OWNER: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200',
  MEMBER: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/30 dark:bg-blue-900/20 dark:text-blue-300',
}

function RoleBadge({ role }: { role: WorkspaceMemberRoleType }) {
  const { t } = useTranslation()
  const Icon = roleIcon[role]
  const key = roleI18nKey[role]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex h-6 w-24 cursor-default items-center justify-center gap-1 rounded-md border text-[11px] font-semibold ${roleBadgeClassName[role]}`}
        >
          <Icon className="size-3 shrink-0" />
          {t(`workspace.role.${key}`)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60 text-xs">
        <p className="font-semibold">{t(`workspace.role.${key}`)}</p>
        <p className="mt-0.5 text-muted-foreground">{t(`workspace.roleDesc.${key}`)}</p>
      </TooltipContent>
    </Tooltip>
  )
}

const MEMBER_PAGE_SIZE = 10
const TEAM_PAGE_SIZE = 6
const PROJECT_PAGE_SIZE = 6

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
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const queryClient = useQueryClient()

  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectVisibility, setProjectVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
  const [projectManagerUserId, setProjectManagerUserId] = useState('')
  const [projectManagerTeamId, setProjectManagerTeamId] = useState('')
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [memberUserId, setMemberUserId] = useState('')
  const [memberRole, setMemberRole] = useState<WorkspaceMemberRoleType>('MEMBER')
  const [memberSearch, setMemberSearch] = useState('')
  const [memberRoleFilter, setMemberRoleFilter] = useState<WorkspaceMemberRoleType | 'ALL'>('ALL')
  const [memberSortKey, setMemberSortKey] = useState<'name' | 'role' | 'joined'>('role')
  const [memberPage, setMemberPage] = useState(1)
  const [projectPage, setProjectPage] = useState(1)
  const [teamPage, setTeamPage] = useState(1)
  const [teamSearch, setTeamSearch] = useState('')
  const [editWsDialogOpen, setEditWsDialogOpen] = useState(false)
  const [editWsName, setEditWsName] = useState('')
  const [editWsInitialName, setEditWsInitialName] = useState('')
  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false)
  const [editProjectId, setEditProjectId] = useState<number | null>(null)
  const [editProjectName, setEditProjectName] = useState('')
  const [editProjectDescription, setEditProjectDescription] = useState('')
  const [editProjectVisibility, setEditProjectVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
  const [editProjectManagerUserId, setEditProjectManagerUserId] = useState('')
  const [editProjectManagerTeamId, setEditProjectManagerTeamId] = useState('')
  const [editProjectInitialName, setEditProjectInitialName] = useState('')
  const [editProjectInitialDescription, setEditProjectInitialDescription] = useState('')
  const [editProjectInitialVisibility, setEditProjectInitialVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
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
        visibility: 'PUBLIC' | 'PRIVATE'
        managerUserId?: string
        managerTeamId?: number
      } = {
        workspaceId,
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
        visibility: projectVisibility,
      }

      if (workspaceQuery.data?.owner.userId === currentUserId) {
        payload.managerUserId = projectManagerUserId || undefined
        payload.managerTeamId = projectManagerTeamId ? Number(projectManagerTeamId) : undefined
      }

      return projectApi.create(payload)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      const snapshot = queryClient.getQueryData<PageResult<Project>>(queryKeys.projects.byWorkspace(workspaceId, 1, 50))
      const user = useAuthStore.getState().currentUser
      const optimistic: Project = {
        id: -Date.now(),
        workspaceId,
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
        status: 'ACTIVE',
        visibility: 'PUBLIC',
        createdBy: { userId: user?.userId ?? '', email: user?.email ?? '', firstName: user?.firstName ?? '', lastName: user?.lastName ?? '' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      queryClient.setQueryData<PageResult<Project>>(queryKeys.projects.byWorkspace(workspaceId, 1, 50), (old) => {
        if (!old) return old
        return { ...old, content: [...old.content, optimistic], meta: { ...old.meta, totalElements: old.meta.totalElements + 1 } }
      })
      return { snapshot }
    },
    onSuccess: () => {
      setProjectName('')
      setProjectDescription('')
      setProjectVisibility('PUBLIC')
      setProjectManagerUserId('')
      setProjectManagerTeamId('')
      setProjectDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      toast.success(t('workspace.toast.projectCreated'))
    },
    onError: (error: Error, _variables, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(queryKeys.projects.byWorkspace(workspaceId, 1, 50), context.snapshot)
      }
      toast.error(t('workspace.toast.projectCreateFailed'), { description: error.message })
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: () => workspaceApi.addMember(workspaceId, { userId: memberUserId.trim(), role: memberRole }),
    onSuccess: () => {
      setMemberUserId('')
      setMemberRole('MEMBER')
      setMemberDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) })
      toast.success(t('workspace.toast.memberAdded'))
    },
    onError: (error: Error) => {
      toast.error(t('workspace.toast.memberAddFailed'), { description: error.message })
    },
  })

  const updateWorkspaceMutation = useMutation({
    mutationFn: () => workspaceApi.update(workspaceId, { name: editWsName.trim() }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['workspaces', 'list'] })
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) })

      const workspaceListSnapshot = queryClient.getQueriesData<PageResult<Workspace>>({ queryKey: ['workspaces', 'list'] })
      const workspaceDetailSnapshot = queryClient.getQueryData<Workspace>(queryKeys.workspaces.detail(workspaceId))
      const optimisticUpdatedAt = new Date().toISOString()

      queryClient.setQueriesData<PageResult<Workspace>>(
        { queryKey: ['workspaces', 'list'] },
        (oldData) => {
          if (!oldData) {
            return oldData
          }

          return {
            ...oldData,
            content: oldData.content.map((workspace) => (
              workspace.id === workspaceId
                ? {
                  ...workspace,
                  name: editWsName.trim(),
                  updatedAt: optimisticUpdatedAt,
                }
                : workspace
            )),
          }
        },
      )

      if (workspaceDetailSnapshot) {
        queryClient.setQueryData<Workspace>(queryKeys.workspaces.detail(workspaceId), {
          ...workspaceDetailSnapshot,
          name: editWsName.trim(),
          updatedAt: optimisticUpdatedAt,
        })
      }

      return {
        workspaceListSnapshot,
        workspaceDetailSnapshot,
      }
    },
    onSuccess: (savedWorkspace) => {
      setEditWsDialogOpen(false)
      queryClient.setQueryData(queryKeys.workspaces.detail(workspaceId), savedWorkspace)
      queryClient.setQueriesData<PageResult<Workspace>>(
        { queryKey: ['workspaces', 'list'] },
        (oldData) => {
          if (!oldData) {
            return oldData
          }

          return {
            ...oldData,
            content: oldData.content.map((workspace) => (
              workspace.id === savedWorkspace.id ? savedWorkspace : workspace
            )),
          }
        },
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      toast.success(t('workspace.toast.workspaceUpdated'))
    },
    onError: (error: Error, _variables, context) => {
      if (context?.workspaceListSnapshot) {
        for (const [queryKey, data] of context.workspaceListSnapshot) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      if (context?.workspaceDetailSnapshot) {
        queryClient.setQueryData(queryKeys.workspaces.detail(workspaceId), context.workspaceDetailSnapshot)
      }

      toast.error(t('workspace.toast.workspaceUpdateFailed'), { description: error.message })
    },
  })

  const updateProjectMutation = useMutation({
    mutationFn: () => {
      if (!editProjectId) throw new Error(t('workspace.error.projectNotFound'))
      const payload: {
        name: string
        description?: string
        visibility?: 'PUBLIC' | 'PRIVATE'
        managerUserId?: string
        managerTeamId?: number
      } = {
        name: editProjectName.trim(),
        description: editProjectDescription.trim() || undefined,
      }

      if (isOwner) {
        payload.visibility = editProjectVisibility
        payload.managerUserId = editProjectManagerUserId || undefined
        payload.managerTeamId = editProjectManagerTeamId ? Number(editProjectManagerTeamId) : undefined
      }

      return projectApi.update(editProjectId, payload)
    },
    onMutate: async () => {
      if (!editProjectId) return
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      const snapshot = queryClient.getQueryData<PageResult<Project>>(queryKeys.projects.byWorkspace(workspaceId, 1, 50))
      queryClient.setQueryData<PageResult<Project>>(queryKeys.projects.byWorkspace(workspaceId, 1, 50), (old) => {
        if (!old) return old
        return {
          ...old,
          content: old.content.map((p) =>
            p.id === editProjectId
              ? { ...p, name: editProjectName.trim(), description: editProjectDescription.trim() || undefined, updatedAt: new Date().toISOString() }
              : p,
          ),
        }
      })
      return { snapshot }
    },
    onSuccess: () => {
      setEditProjectDialogOpen(false)
      setEditProjectId(null)
      setEditProjectManagerUserId('')
      setEditProjectManagerTeamId('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      toast.success(t('workspace.toast.projectUpdated'))
    },
    onError: (error: Error, _variables, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(queryKeys.projects.byWorkspace(workspaceId, 1, 50), context.snapshot)
      }
      toast.error(t('workspace.toast.projectUpdateFailed'), { description: error.message })
    },
  })

  const updateProjectStatusMutation = useMutation({
    mutationFn: ({ projectId, status }: { projectId: number; status: ProjectStatusType }) =>
      projectApi.updateStatus(projectId, status),
    onMutate: async ({ projectId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      const snapshot = queryClient.getQueryData<PageResult<Project>>(queryKeys.projects.byWorkspace(workspaceId, 1, 50))
      queryClient.setQueryData<PageResult<Project>>(queryKeys.projects.byWorkspace(workspaceId, 1, 50), (old) => {
        if (!old) return old
        return { ...old, content: old.content.map((p) => p.id === projectId ? { ...p, status } : p) }
      })
      return { snapshot }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      toast.success(t('workspace.toast.projectStatusUpdated'))
    },
    onError: (error: Error, _variables, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(queryKeys.projects.byWorkspace(workspaceId, 1, 50), context.snapshot)
      }
      toast.error(t('workspace.toast.projectStatusUpdateFailed'), { description: error.message })
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
        ? t('workspace.entity.project')
        : entry.payload.kind === 'workspace'
          ? t('workspace.entity.workspace')
          : t('workspace.entity.team')
      return t('workspace.toast.deleteScheduled', { entity: entityName, name: entry.label })
    },
    successMessage: (entry) => {
      const entityName = entry.payload.kind === 'project'
        ? t('workspace.entity.project')
        : entry.payload.kind === 'workspace'
          ? t('workspace.entity.workspace')
          : t('workspace.entity.team')
      return t('workspace.toast.deleteSuccess', { entity: entityName, name: entry.label })
    },
    alreadyDeletedMessage: (entry) => {
      const entityName = entry.payload.kind === 'project'
        ? t('workspace.entity.project')
        : entry.payload.kind === 'workspace'
          ? t('workspace.entity.workspace')
          : t('workspace.entity.team')
      return t('workspace.toast.alreadyDeleted', { entity: entityName, name: entry.label })
    },
    errorTitle: t('workspace.toast.deleteFailed'),
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
      toast.success(t('workspace.toast.inviteCreated'))
    },
    onError: (error: Error) => toast.error(t('workspace.toast.inviteCreateFailed'), { description: error.message }),
  })

  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: number) => workspaceInviteApi.revoke(inviteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invites.byWorkspace(workspaceId) })
      toast.success(t('workspace.toast.inviteRevoked'))
    },
    onError: (error: Error) => toast.error(t('workspace.toast.inviteRevokeFailed'), { description: error.message }),
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
      toast.success(t('workspace.toast.teamCreated'))
    },
    onError: (error: Error) => toast.error(t('workspace.toast.teamCreateFailed'), { description: error.message }),
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
      toast.success(t('workspace.toast.teamMemberAdded'))
    },
    onError: (error: Error) => toast.error(t('workspace.toast.teamMemberAddFailed'), { description: error.message }),
  })

  const removeTeamMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: number; userId: string }) =>
      workspaceTeamApi.removeMember(teamId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams.byWorkspace(workspaceId) })
      void queryClient.invalidateQueries({ queryKey: ['workspace-teams', 'members-map', workspaceId] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      toast.success(t('workspace.toast.teamMemberRemoved'))
    },
    onError: (error: Error) => toast.error(t('workspace.toast.teamMemberRemoveFailed'), { description: error.message }),
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

  const projectTotalPages = Math.max(1, Math.ceil(visibleProjects.length / PROJECT_PAGE_SIZE))
  const projectCurrentPage = Math.min(projectPage, projectTotalPages)
  const paginatedProjects = visibleProjects.slice((projectCurrentPage - 1) * PROJECT_PAGE_SIZE, projectCurrentPage * PROJECT_PAGE_SIZE)

  const currentMember = members.find((member) => member.user.userId === currentUserId)
  const currentRole: WorkspaceMemberRoleType = workspace?.owner.userId === currentUserId
    ? 'OWNER'
    : currentMember?.role ?? 'MEMBER'
  const localeTag = i18n.language === 'vi' ? 'vi-VN' : 'en-US'
  const roleDisplayName = useMemo<Record<WorkspaceMemberRoleType, string>>(() => ({
    OWNER: t('workspace.role.owner'),
    MEMBER: t('workspace.role.member'),
  }), [t])
  const roleDescription = useMemo<Record<WorkspaceMemberRoleType, string>>(() => ({
    OWNER: t('workspace.roleDesc.owner'),
    MEMBER: t('workspace.roleDesc.member'),
  }), [t])
  const isOwner = currentRole === 'OWNER'
  const canManageWorkspace = isOwner
  const canCreateProject = isOwner
  const teamMembersByTeamId = teamMembershipQuery.data ?? new Map<number, WorkspaceTeamMember[]>()
  const canManageProject = (project: Project) => {
    void project
    return isOwner
  }

  const isWorkspaceEditDirty = editWsName.trim() !== editWsInitialName
  const isProjectEditDirty = (
    editProjectName.trim() !== editProjectInitialName
    || editProjectDescription.trim() !== editProjectInitialDescription
    || (isOwner && editProjectVisibility !== editProjectInitialVisibility)
    || editProjectManagerUserId !== editProjectInitialManagerUserId
    || editProjectManagerTeamId !== editProjectInitialManagerTeamId
  )

  const ROLE_SORT_ORDER: Record<WorkspaceMemberRoleType, number> = { OWNER: 0, MEMBER: 1 }

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
      if (memberSortKey === 'name') return `${a.user.firstName} ${a.user.lastName}`.localeCompare(`${b.user.firstName} ${b.user.lastName}`, localeTag)
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
    })
    return list
  }, [localeTag, memberRoleFilter, memberSearch, memberSortKey, members])

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
        <p className="text-sm text-muted-foreground">{t('workspace.notFound')}</p>
        <Link to="/workspaces" className="mt-2 text-sm text-primary hover:underline">{t('workspace.backToList')}</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title={workspace.name}
        description={
          <span className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {t('workspace.headerDesc', {
              owner: `${workspace.owner.firstName} ${workspace.owner.lastName}`,
              memberCount: members.length,
              projectCount: visibleProjects.length,
              role: roleDisplayName[currentRole],
            }).split('·').map((part, index) => (
              <span key={index} className="inline-flex items-center rounded-full bg-muted/80 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {part.trim()}
              </span>
            ))}
          </span>
        }
        actions={
          canManageWorkspace ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="destructive" size="sm" onClick={() => setDeleteWorkspaceDialogOpen(true)}>
                <Trash2 className="mr-1.5 size-3.5" />
                {t('workspace.action.delete')}
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
                    {t('common.edit')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('workspace.dialog.editTitle')}</DialogTitle>
                    <DialogDescription>{t('workspace.dialog.editDescription')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label>{t('workspace.field.name')}</Label>
                    <Input
                      value={editWsName}
                      onChange={(e) => setEditWsName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editWsName.trim() && isWorkspaceEditDirty) updateWorkspaceMutation.mutate()
                      }}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditWsDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={() => updateWorkspaceMutation.mutate()} disabled={updateWorkspaceMutation.isPending || !editWsName.trim() || !isWorkspaceEditDirty}>
                      {updateWorkspaceMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {t('common.save')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <Badge variant="outline" className="gap-1">
              <User className="size-3" />
              {t('workspace.badge.memberReadOnly')}
            </Badge>
          )
        }
      />

      {/* Workspace analytics — 5 chart types */}
      {visibleProjects.length > 0 && (
        <WorkspaceChartsSection
          projects={visibleProjects}
          members={members}
          teamsCount={visibleTeams.length}
        />
      )}

      <Tabs defaultValue="projects">
        <TabsList className="h-auto w-full justify-start">
          <TabsTrigger value="projects" className="shrink-0 gap-1.5">
            <FolderKanban className="size-3.5" />
            {t('workspace.tab.projects')} ({visibleProjects.length})
          </TabsTrigger>
          <TabsTrigger value="members" className="shrink-0 gap-1.5">
            <Users className="size-3.5" />
            {t('workspace.tab.members')} ({members.length})
          </TabsTrigger>
          <TabsTrigger value="invites" className="shrink-0 gap-1.5">
            <Link2 className="size-3.5" />
            {t('workspace.tab.invites')} ({invites.length})
          </TabsTrigger>
          <TabsTrigger value="teams" className="shrink-0 gap-1.5">
            <UsersRound className="size-3.5" />
            {t('workspace.tab.teams')} ({visibleTeams.length})
          </TabsTrigger>
        </TabsList>

        {/* Projects tab */}
        <TabsContent value="projects" className="mt-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{t('workspace.projects.description')}</p>
              {!canCreateProject && (
                <p className="text-xs text-muted-foreground">{t('workspace.projects.readOnlyNotice')}</p>
              )}
            </div>
            {canCreateProject && (
              <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1.5 size-3.5" />
                    {t('workspace.action.createProject')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('workspace.dialog.createProjectTitle')}</DialogTitle>
                    <DialogDescription>{t('workspace.dialog.createProjectDescription')}</DialogDescription>
                  </DialogHeader>
                  <ProjectFormFields
                    name={projectName}
                    description={projectDescription}
                    visibility={projectVisibility}
                    managerUserId={projectManagerUserId}
                    managerTeamId={projectManagerTeamId}
                    onNameChange={setProjectName}
                    onDescriptionChange={setProjectDescription}
                    onVisibilityChange={setProjectVisibility}
                    onManagerUserChange={setProjectManagerUserId}
                    onManagerTeamChange={setProjectManagerTeamId}
                    members={members}
                    teams={visibleTeams}
                    isOwner={isOwner}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={() => createProjectMutation.mutate()} disabled={createProjectMutation.isPending || !projectName.trim()}>
                      {createProjectMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {t('common.create')}
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
                <p className="text-sm font-medium">{t('workspace.projects.empty')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('workspace.projects.emptyHint')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {paginatedProjects.map((project) => {
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
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant={project.status === 'ACTIVE' ? 'default' : project.status === 'COMPLETED' ? 'secondary' : 'outline'} className="text-[10px]">
                              {t(`project.status.${project.status}`)}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {t(`project.visibility.${(project.visibility ?? 'PUBLIC').toLowerCase()}`)}
                            </Badge>
                            {project.managerUser && (
                              <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/50">
                                {t('workspace.badge.managerUser', { name: `${project.managerUser.firstName} ${project.managerUser.lastName}` })}
                              </Badge>
                            )}
                            {project.managerTeamName && (
                              <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-700 dark:border-indigo-800/50 dark:text-indigo-300">
                                {t('workspace.badge.managerTeam', { name: project.managerTeamName })}
                              </Badge>
                            )}
                          </div>
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
                                setEditProjectVisibility(project.visibility ?? 'PUBLIC')
                                setEditProjectManagerUserId(project.managerUser?.userId ?? '')
                                setEditProjectManagerTeamId(project.managerTeamId ? String(project.managerTeamId) : '')
                                setEditProjectInitialName(project.name.trim())
                                setEditProjectInitialDescription((project.description ?? '').trim())
                                setEditProjectInitialVisibility(project.visibility ?? 'PUBLIC')
                                setEditProjectInitialManagerUserId(project.managerUser?.userId ?? '')
                                setEditProjectInitialManagerTeamId(project.managerTeamId ? String(project.managerTeamId) : '')
                                setEditProjectDialogOpen(true)
                              }}
                            >
                              <Pencil className="mr-2 size-3.5" />
                              {t('common.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {project.status !== 'ACTIVE' && (
                              <DropdownMenuItem onClick={() => updateProjectStatusMutation.mutate({ projectId: project.id, status: 'ACTIVE' })}>
                                <RotateCcw className="mr-2 size-3.5" />
                                {t('workspace.action.reactivate')}
                              </DropdownMenuItem>
                            )}
                            {project.status !== 'COMPLETED' && (
                              <DropdownMenuItem onClick={() => updateProjectStatusMutation.mutate({ projectId: project.id, status: 'COMPLETED' })}>
                                <CheckCircle2 className="mr-2 size-3.5" />
                                {t('workspace.action.complete')}
                              </DropdownMenuItem>
                            )}
                            {project.status !== 'ARCHIVED' && (
                              <DropdownMenuItem onClick={() => updateProjectStatusMutation.mutate({ projectId: project.id, status: 'ARCHIVED' })}>
                                <Archive className="mr-2 size-3.5" />
                                {t('workspace.action.archive')}
                              </DropdownMenuItem>
                            )}
                            {isOwner && (
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
                                  {t('workspace.action.deleteProject')}
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

          {/* Project pagination */}
          {projectTotalPages > 1 && (
            <div className="mt-6 flex flex-col items-center gap-2 pb-4">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={projectCurrentPage === 1}
                  onClick={() => setProjectPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                {buildPageNumbers(projectCurrentPage, projectTotalPages).map((p, idx) =>
                  p === '...' ? (
                    <span key={`dots-${idx}`} className="flex size-8 items-center justify-center text-xs text-muted-foreground">⋯</span>
                  ) : (
                    <Button
                      key={p}
                      variant={projectCurrentPage === p ? 'default' : 'outline'}
                      size="icon"
                      className="size-8 text-xs"
                      onClick={() => setProjectPage(p as number)}
                    >
                      {p}
                    </Button>
                  )
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={projectCurrentPage === projectTotalPages}
                  onClick={() => setProjectPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Edit project dialog */}
          <Dialog
            open={editProjectDialogOpen}
            onOpenChange={(open) => {
              setEditProjectDialogOpen(open)
              if (!open) {
                setEditProjectId(null)
                setEditProjectVisibility('PUBLIC')
                setEditProjectManagerUserId('')
                setEditProjectManagerTeamId('')
                setEditProjectInitialName('')
                setEditProjectInitialDescription('')
                setEditProjectInitialVisibility('PUBLIC')
                setEditProjectInitialManagerUserId('')
                setEditProjectInitialManagerTeamId('')
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('workspace.dialog.editProjectTitle')}</DialogTitle>
                <DialogDescription>
                  {isOwner
                    ? t('workspace.dialog.editProjectDescOwner')
                    : t('workspace.dialog.editProjectDescMember')}
                </DialogDescription>
              </DialogHeader>
              <ProjectFormFields
                name={editProjectName}
                description={editProjectDescription}
                visibility={editProjectVisibility}
                managerUserId={editProjectManagerUserId}
                managerTeamId={editProjectManagerTeamId}
                onNameChange={setEditProjectName}
                onDescriptionChange={setEditProjectDescription}
                onVisibilityChange={setEditProjectVisibility}
                onManagerUserChange={setEditProjectManagerUserId}
                onManagerTeamChange={setEditProjectManagerTeamId}
                members={members}
                teams={visibleTeams}
                isOwner={isOwner}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditProjectDialogOpen(false)}>{t('common.cancel')}</Button>
                <Button onClick={() => updateProjectMutation.mutate()} disabled={updateProjectMutation.isPending || !editProjectName.trim() || !isProjectEditDirty}>
                  {updateProjectMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {t('common.save')}
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
                <DialogTitle>{t('workspace.dialog.deleteProjectTitle')}</DialogTitle>
                <DialogDescription className="space-y-3 text-left leading-relaxed text-muted-foreground">
                  <p>
                    {deleteProject
                      ? t('workspace.dialog.deleteProjectConfirm', { name: deleteProject.name })
                      : t('workspace.dialog.deleteProjectConfirmGeneric')}
                  </p>
                  <div className="rounded-2xl border border-destructive/12 bg-destructive/5 px-3 py-3 text-sm text-foreground/80">
                    {t('workspace.dialog.deleteProjectWarning')}
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteProjectDialogOpen(false)}>{t('common.cancel')}</Button>
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
                  {t('workspace.action.deleteProject')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Members tab */}
        <TabsContent value="members" className="mt-4 space-y-4">
          {/* Role legend */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(['OWNER', 'MEMBER'] as const).map((r) => {
              const Icon = roleIcon[r]
              const accentClass = {
                OWNER: 'border-l-amber-400',
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
                placeholder={t('workspace.members.searchPlaceholder')}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Select value={memberRoleFilter} onValueChange={(v) => { setMemberRoleFilter(v as WorkspaceMemberRoleType | 'ALL'); setMemberPage(1) }}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder={t('workspace.members.allRoles')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('workspace.members.allRoles')}</SelectItem>
                <SelectItem value="OWNER">
                  <span className="flex items-center gap-1.5">
                    <Crown className="size-3 text-amber-600 dark:text-amber-400" />
                    {roleDisplayName.OWNER}
                  </span>
                </SelectItem>
                <SelectItem value="MEMBER">
                  <span className="flex items-center gap-1.5">
                    <User className="size-3 text-muted-foreground" />
                    {roleDisplayName.MEMBER}
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
                <SelectItem value="role">{t('workspace.sort.byRole')}</SelectItem>
                <SelectItem value="name">{t('workspace.sort.byName')}</SelectItem>
                <SelectItem value="joined">{t('workspace.sort.byJoinDate')}</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground">{t('workspace.members.count', { filtered: filteredMembers.length, total: members.length })}</span>
            {canManageWorkspace && (
              <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="mr-1.5 size-3.5" />
                    {t('workspace.action.addMember')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('workspace.dialog.addMemberTitle')}</DialogTitle>
                    <DialogDescription>{t('workspace.dialog.addMemberDescription')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="member-id">{t('workspace.field.userIdOrEmail')}</Label>
                      <Input
                        id="member-id"
                        value={memberUserId}
                        onChange={(e) => setMemberUserId(e.target.value)}
                        placeholder={t('workspace.placeholder.userIdOrEmail')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('workspace.field.role')}</Label>
                      <div className="flex gap-2">
                        {(['OWNER', 'MEMBER'] as const).map((r) => (
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
                    <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={() => addMemberMutation.mutate()} disabled={addMemberMutation.isPending || !memberUserId.trim()}>
                      {addMemberMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {t('workspace.action.addMember')}
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
                <p className="text-sm font-medium">{t('workspace.members.notFound')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="grid grid-cols-[2.5rem_1fr_2rem_auto] items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span />
                <span>{t('workspace.table.member')}</span>
                <span />
                <span>{t('workspace.table.role')}</span>
              </div>
              <div className="divide-y divide-border/40">
                {paginatedMembers.map((member) => {
                  const isOwnerMember = member.role === 'OWNER'
                  const isSelf = member.user.userId === currentUserId
                  const joinedDate = new Date(member.joinedAt).toLocaleDateString(localeTag, { day: '2-digit', month: '2-digit', year: 'numeric' })
                  return (
                    <div key={member.id} className="grid grid-cols-[2.5rem_1fr_2rem_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {member.user.firstName.charAt(0)}{member.user.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium">{highlightMatch(`${member.user.firstName} ${member.user.lastName}`, memberSearch.trim())}</p>
                          {isSelf && <Badge variant="outline" className="h-4 px-1 text-[9px]">{t('workspace.badge.you')}</Badge>}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{highlightMatch(member.user.email, memberSearch.trim())}</p>
                        <p className="text-[10px] text-muted-foreground/60">{t('workspace.members.joinedAt', { date: joinedDate })}</p>
                      </div>
                      {canManageWorkspace && !isOwnerMember && !isSelf ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(['OWNER', 'MEMBER'] as const).map((r) => (
                              <DropdownMenuItem
                                key={r}
                                disabled={member.role === r}
                                onClick={() => {
                                  workspaceApi
                                    .updateMemberRole(workspaceId, member.user.userId, r)
                                    .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) }))
                                    .catch((err: Error) => toast.error(t('workspace.toast.roleUpdateFailed'), { description: err.message }))
                                }}
                              >
                                {t('workspace.action.changeRoleTo', { role: roleDisplayName[r] })}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                workspaceApi
                                  .removeMember(workspaceId, member.user.userId)
                                  .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) }))
                                  .catch((err: Error) => toast.error(t('workspace.toast.memberRemoveFailed'), { description: err.message }))
                              }}
                            >
                              <Trash2 className="mr-2 size-3.5" />
                              {t('workspace.action.removeFromWorkspace')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <div className="size-8" />
                      )}
                      <RoleBadge role={member.role} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Member pagination */}
          {memberTotalPages > 1 && (
            <div className="mt-6 flex flex-col items-center gap-2 pb-4">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={memberCurrentPage === 1}
                  onClick={() => setMemberPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                {buildPageNumbers(memberCurrentPage, memberTotalPages).map((p, idx) =>
                  p === '...' ? (
                    <span key={`dots-${idx}`} className="flex size-8 items-center justify-center text-xs text-muted-foreground">⋯</span>
                  ) : (
                    <Button
                      key={p}
                      variant={memberCurrentPage === p ? 'default' : 'outline'}
                      size="icon"
                      className="size-8 text-xs"
                      onClick={() => setMemberPage(p as number)}
                    >
                      {p}
                    </Button>
                  )
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={memberCurrentPage === memberTotalPages}
                  onClick={() => setMemberPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Invites tab */}
        <TabsContent value="invites" className="mt-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{t('workspace.invites.description')}</p>
              {!canManageWorkspace && (
                <p className="text-xs text-muted-foreground">{t('workspace.invites.readOnlyNotice')}</p>
              )}
            </div>
            {canManageWorkspace && (
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1.5 size-3.5" />
                    {t('workspace.action.createInvite')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('workspace.dialog.createInviteTitle')}</DialogTitle>
                    <DialogDescription>{t('workspace.dialog.createInviteDescription')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>{t('workspace.field.assignedRole')}</Label>
                      <div className="flex gap-2">
                        {(['OWNER', 'MEMBER'] as const).map((r) => (
                          <Button key={r} type="button" variant={inviteRole === r ? 'default' : 'outline'} size="sm" onClick={() => setInviteRole(r)}>
                            {roleDisplayName[r]}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('workspace.field.maxUsesOptional')}</Label>
                      <Input
                        type="number"
                        min="1"
                        value={inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(e.target.value)}
                        placeholder={t('workspace.placeholder.unlimited')}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={() => createInviteMutation.mutate()} disabled={createInviteMutation.isPending}>
                      {createInviteMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {t('common.create')}
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
                <p className="text-sm font-medium">{t('workspace.invites.empty')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('workspace.invites.emptyHint')}</p>
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
                        <Badge variant="outline" className="text-[10px]">{roleDisplayName[invite.roleToAssign]}</Badge>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {t('workspace.invites.usageCount', { used: invite.usedCount, max: invite.maxUses ? `/${invite.maxUses}` : '' })}
                        {invite.expiresAt ? t('workspace.invites.expiresAt', { date: invite.expiresAt }) : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => {
                        void navigator.clipboard.writeText(inviteUrl)
                        toast.success(t('workspace.toast.inviteLinkCopied'))
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
                placeholder={t('workspace.teams.searchPlaceholder')}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <span className="text-xs text-muted-foreground">{t('workspace.teams.count', { filtered: filteredTeams.length, total: visibleTeams.length })}</span>
            {canManageWorkspace && (
              <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1.5 size-3.5" />
                    {t('workspace.action.createTeam')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('workspace.dialog.createTeamTitle')}</DialogTitle>
                    <DialogDescription>{t('workspace.dialog.createTeamDescription')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>{t('workspace.field.teamName')}</Label>
                      <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder={t('workspace.placeholder.teamName')} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('workspace.field.descriptionOptional')}</Label>
                      <Textarea value={teamDescription} onChange={(e) => setTeamDescription(e.target.value)} rows={3} placeholder={t('workspace.placeholder.teamDescription')} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setTeamDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={() => createTeamMutation.mutate()} disabled={createTeamMutation.isPending || !teamName.trim()}>
                      {createTeamMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {t('common.create')}
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
                <p className="text-sm font-medium">{visibleTeams.length === 0 ? t('workspace.teams.empty') : t('workspace.teams.notFound')}</p>
                {visibleTeams.length === 0 && <p className="mt-1 text-xs text-muted-foreground">{t('workspace.teams.emptyHint')}</p>}
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

                  const ROLE_ORDER: Record<WorkspaceMemberRoleType, number> = { OWNER: 0, MEMBER: 1 }
                  const sortedTeamMembers = [...teamMembers].sort((a, b) => {
                    const wsMemberA = members.find((m) => m.user.userId === a.user.userId)
                    const wsMemberB = members.find((m) => m.user.userId === b.user.userId)
                    const roleA = wsMemberA?.role ?? 'MEMBER'
                    const roleB = wsMemberB?.role ?? 'MEMBER'
                    const cmp = ROLE_ORDER[roleA] - ROLE_ORDER[roleB]
                    if (cmp !== 0) return cmp
                    return `${a.user.firstName} ${a.user.lastName}`.localeCompare(`${b.user.firstName} ${b.user.lastName}`, localeTag)
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
                                <CardTitle className="text-sm font-semibold leading-tight">{highlightMatch(team.name, teamSearch.trim())}</CardTitle>
                                {team.description && (
                                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{highlightMatch(team.description, teamSearch.trim())}</p>
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
                                {t('workspace.teams.memberCount', { count: team.memberCount })}
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
                              {t('workspace.teams.noMembers')}
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
                                  {isExpanded ? t('workspace.teams.collapse') : t('workspace.teams.showMore', { count: hiddenCount })}
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
                                  <SelectValue placeholder={t('workspace.teams.addMemberPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{t('workspace.teams.selectMember')}</SelectItem>
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
                                {t('workspace.teams.allMembersAdded')}
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
                    {t('workspace.pagination.teamInfo', { current: teamCurrentPage, total: teamTotalPages, count: filteredTeams.length })}
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
              <DialogTitle>{t('workspace.dialog.deleteTitle')}</DialogTitle>
              <DialogDescription className="space-y-3 text-left leading-relaxed text-muted-foreground">
                <p>{t('workspace.dialog.deleteConfirm', { name: workspace.name })}</p>
                <div className="rounded-2xl border border-destructive/12 bg-destructive/5 px-3 py-3 text-sm text-foreground/80">
                  {t('workspace.dialog.deleteWarning')}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteWorkspaceDialogOpen(false)}>{t('common.cancel')}</Button>
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
                {t('workspace.action.delete')}
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
            ? t('workspace.toast.deletingProject')
            : entry.payload.kind === 'workspace'
              ? t('workspace.toast.deletingWorkspace')
              : t('workspace.toast.deletingTeam')
        )}
      />
    </div>
  )
}

/* ─── WorkspaceChartsSection ──────────────────────────────────────────────── */

interface WorkspaceChartsSectionProps {
  projects: Project[]
  members: { role: WorkspaceMemberRoleType }[]
  teamsCount: number
}

function WorkspaceChartsSection({ projects, members, teamsCount }: WorkspaceChartsSectionProps) {
  const { t } = useTranslation()
  const projectGrowth = useMemo<GrowthPoint[]>(() => {
    const monthMap = new Map<string, number>()
    for (const p of projects) {
      if (!p.createdAt) continue
      const m = p.createdAt.slice(0, 7)
      monthMap.set(m, (monthMap.get(m) ?? 0) + 1)
    }
    const sorted = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8)
    let cumul = 0
    return sorted.map(([month, count]) => {
      cumul += count
      return { label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), count, cumulative: cumul }
    })
  }, [projects])

  const memberRoleData = useMemo(() => {
    const owners = members.filter((m) => m.role === 'OWNER').length
    const memberCount = members.filter((m) => m.role === 'MEMBER').length
    return [
      { label: t('workspace.charts.owners'), count: owners, cumulative: owners },
      { label: t('workspace.charts.members'), count: memberCount, cumulative: owners + memberCount },
    ]
  }, [members, t])

  const completionTrend = useMemo(() => {
    const now = new Date()
    const days: { date: string; created: number; completed: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const created = projects.filter((p) => p.createdAt?.slice(0, 10) === dateStr).length
      const completed = projects.filter((p) => p.status === 'COMPLETED' && p.updatedAt?.slice(0, 10) === dateStr).length
      days.push({ date: dateStr, created, completed })
    }
    return days
  }, [projects])

  const activeCount = projects.filter((p) => p.status === 'ACTIVE').length
  const completedCount = projects.filter((p) => p.status === 'COMPLETED').length
  const archivedCount = projects.filter((p) => p.status === 'ARCHIVED').length

  return (
    <div className="space-y-5">
      {/* Summary totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t('workspace.charts.totalProjects'), value: projects.length, color: 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20' },
          { label: t('workspace.charts.active'), value: activeCount, color: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20' },
          { label: t('workspace.charts.members'), value: members.length, color: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20' },
          { label: t('workspace.charts.teams'), value: teamsCount, color: 'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20' },
        ].map((s) => (
          <div key={s.label} className={`flex flex-col items-center justify-center rounded-xl py-3 ${s.color}`}>
            <span className="text-2xl font-bold">{s.value}</span>
            <span className="mt-0.5 text-xs opacity-80 font-medium">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Row 1: PIE + COMPOSED */}
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        {/* PIE CHART: project status donut */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FolderKanban className="size-4 text-indigo-500" />
              {t('workspace.charts.projectsByStatus')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t('workspace.charts.statusSummary', { active: activeCount, completed: completedCount, archived: archivedCount })}
            </p>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            <ProjectStatusDonut projects={projects} />
          </CardContent>
        </Card>

        {/* COMPOSED CHART: project creation growth (bar monthly + line cumulative) */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FolderKanban className="size-4 text-emerald-500" />
              {t('workspace.charts.projectGrowthTitle')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t('workspace.charts.projectGrowthDesc')}</p>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            <GrowthComposedChart
              data={projectGrowth}
              barColor="#6366f1"
              lineColor="#22c55e"
              emptyMessage={t('workspace.charts.noProjectHistory')}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 2: BAR + LINE + AREA (via CompletionLineChart) */}
      <div className="grid gap-5 md:grid-cols-3">
        {/* BAR CHART: member roles */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="size-4 text-amber-500" />
              {t('workspace.charts.memberRoleTitle')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t('workspace.charts.memberRoleDesc')}</p>
          </CardHeader>
          <CardContent className="pb-3 pt-0">
            <GrowthComposedChart
              data={memberRoleData}
              barColor="#f97316"
              lineColor="#a855f7"
              height={180}
              emptyMessage={t('workspace.charts.noMembers')}
            />
          </CardContent>
        </Card>

        {/* LINE CHART: project completion trend (7 days) */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-500" />
              {t('workspace.charts.completionTrendTitle')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t('workspace.charts.completionTrendDesc')}</p>
          </CardHeader>
          <CardContent className="pb-3 pt-0">
            <CompletionLineChart data={completionTrend} mode="cumulative" height={180} />
          </CardContent>
        </Card>

        {/* AREA covered by GrowthComposedChart above (inline area portion) */}
        {/* Additional quick stats card */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Crown className="size-4 text-violet-500" />
              {t('workspace.charts.snapshotTitle')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t('workspace.charts.snapshotDesc')}</p>
          </CardHeader>
          <CardContent className="pb-3 pt-0">
            <div className="space-y-3 pt-1">
              {[
                { label: t('workspace.charts.completionRate'), value: projects.length > 0 ? `${Math.round(completedCount / projects.length * 100)}%` : '0%', bar: projects.length > 0 ? completedCount / projects.length : 0, color: 'bg-emerald-500' },
                { label: t('workspace.charts.activeRatio'), value: projects.length > 0 ? `${Math.round(activeCount / projects.length * 100)}%` : '0%', bar: projects.length > 0 ? activeCount / projects.length : 0, color: 'bg-indigo-500' },
                { label: t('workspace.charts.archivedRatio'), value: projects.length > 0 ? `${Math.round(archivedCount / projects.length * 100)}%` : '0%', bar: projects.length > 0 ? archivedCount / projects.length : 0, color: 'bg-slate-400' },
              ].map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-semibold">{row.value}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.bar * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
