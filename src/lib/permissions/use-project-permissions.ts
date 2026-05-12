import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/app/store/auth-store'
import { projectApi } from '@/lib/api/modules/project-api'
import { queryKeys } from '@/lib/api/query-keys'
import type { WorkspaceMemberRoleType } from '@/types/domain'

interface UseProjectPermissionsOptions {
  workspaceId: number
  projectId: number
  enabled?: boolean
}

export function useProjectPermissions({ workspaceId, projectId, enabled = true }: UseProjectPermissionsOptions) {
  const currentUserId = useAuthStore((state) => state.currentUser?.userId ?? null)

  const canQuery = enabled
    && Number.isFinite(workspaceId)
    && Number.isFinite(projectId)
    && workspaceId > 0
    && projectId > 0

  const projectQuery = useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => projectApi.detail(projectId),
    enabled: canQuery,
  })

  const effectiveAccessQuery = useQuery({
    queryKey: queryKeys.projects.effectiveAccess(projectId),
    queryFn: () => projectApi.effectiveAccess(projectId),
    enabled: canQuery,
  })

  const project = projectQuery.data ?? null
  const effectiveAccess = effectiveAccessQuery.data ?? null

  const currentRole: WorkspaceMemberRoleType = effectiveAccess?.workspaceOwner
    ? 'OWNER'
    : 'MEMBER'

  const isOwner = currentRole === 'OWNER'

  const permissionsReady = canQuery
    && !projectQuery.isLoading
    && !effectiveAccessQuery.isLoading

  const canManageProject = Boolean(permissionsReady && effectiveAccess?.canManageProjectWork)
  const canViewProject = Boolean(permissionsReady && effectiveAccess?.canViewProject)
  const canContribute = Boolean(permissionsReady && effectiveAccess?.canContribute)
  const canComment = Boolean(permissionsReady && effectiveAccess?.canComment)
  const isWorkspaceManager = canManageProject
  const canManageGoal = () => canManageProject
  const canManageGoalById = () => canManageProject
  const canManageTask = () => canContribute
  const canDeleteTask = () => canManageProject
  const canScheduleTask = () => canManageProject

  return {
    currentUserId,
    currentRole,
    isOwner,
    isWorkspaceManager,
    canViewProject,
    canManageProject,
    canManageProjectWork: canManageProject,
    canContribute,
    canComment,
    canManageProjectAccess: Boolean(permissionsReady && effectiveAccess?.canManageProjectAccess),
    canGrantManager: Boolean(permissionsReady && (effectiveAccess?.canGrantManager ?? effectiveAccess?.canManageManagerAccess)),
    canRevokeManager: Boolean(permissionsReady && (effectiveAccess?.canRevokeManager ?? effectiveAccess?.canManageManagerAccess)),
    canManageManagerAccess: Boolean(permissionsReady && (effectiveAccess?.canGrantManager ?? effectiveAccess?.canManageManagerAccess)),
    canChangeVisibility: Boolean(permissionsReady && effectiveAccess?.canChangeVisibility),
    canDeleteProject: Boolean(permissionsReady && effectiveAccess?.canDeleteProject),
    canAssignOthers: Boolean(permissionsReady && effectiveAccess?.canAssignOthers),
    canManageWorkspaceMembers: Boolean(permissionsReady && effectiveAccess?.canManageWorkspaceMembers),
    canManageWorkspaceTeams: Boolean(permissionsReady && effectiveAccess?.canManageWorkspaceTeams),
    canManageWorkspaceInvites: Boolean(permissionsReady && effectiveAccess?.canManageWorkspaceInvites),
    canManageWorkspaceSettings: Boolean(permissionsReady && effectiveAccess?.canManageWorkspaceSettings),
    canManageGoal,
    canManageGoalById,
    canManageTask,
    canDeleteTask,
    canScheduleTask,
    permissionsReady,
    effectiveAccess,
    workspace: null,
    project,
    goals: [],
    members: [],
    teams: [],
    teamMembershipMap: new Map<number, Set<string>>(),
  }
}
