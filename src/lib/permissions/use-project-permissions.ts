import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/app/store/auth-store'
import { goalApi } from '@/lib/api/modules/goal-api'
import { projectApi } from '@/lib/api/modules/project-api'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { workspaceTeamApi } from '@/lib/api/modules/workspace-team-api'
import { queryKeys } from '@/lib/api/query-keys'
import type { WorkspaceMemberRoleType } from '@/types/domain'

interface GoalManagerShape {
  managerUser?: {
    userId: string
  }
  managerTeamId?: number
}

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

  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId),
    queryFn: () => workspaceApi.detail(workspaceId),
    enabled: canQuery,
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId),
    queryFn: () => workspaceApi.members(workspaceId),
    enabled: canQuery,
  })

  const projectQuery = useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => projectApi.detail(projectId),
    enabled: canQuery,
  })

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams.byWorkspace(workspaceId),
    queryFn: () => workspaceTeamApi.listByWorkspace(workspaceId),
    enabled: canQuery,
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
    enabled: canQuery && Boolean(currentUserId) && (teamsQuery.data?.length ?? 0) > 0,
  })

  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.byProject(projectId, 1, 500),
    queryFn: () => goalApi.listByProject(projectId, { page: 1, size: 500 }),
    enabled: canQuery,
  })

  const members = membersQuery.data ?? []
  const project = projectQuery.data ?? null
  const workspace = workspaceQuery.data ?? null
  const teamMembershipMap = teamMembershipQuery.data ?? new Map<number, Set<string>>()
  const goals = goalsQuery.data?.content ?? []

  const goalManagerById = useMemo(() => {
    const map = new Map<number, GoalManagerShape>()
    for (const goal of goals) {
      map.set(goal.id, {
        managerUser: goal.managerUser,
        managerTeamId: goal.managerTeamId,
      })
    }
    return map
  }, [goals])

  const currentMember = members.find((member) => member.user.userId === currentUserId)

  const currentRole: WorkspaceMemberRoleType = workspace?.owner.userId === currentUserId
    ? 'OWNER'
    : currentMember?.role ?? 'MEMBER'

  const isOwner = currentRole === 'OWNER'
  const isWorkspaceManager = isOwner || currentRole === 'ADMIN'

  const isCurrentUserInManagerTeam = (teamId?: number) => Boolean(
    teamId
    && currentUserId
    && teamMembershipMap.get(teamId)?.has(currentUserId),
  )

  const permissionsReady = canQuery
    && !workspaceQuery.isLoading
    && !membersQuery.isLoading
    && !projectQuery.isLoading
    && !goalsQuery.isLoading
    && !teamMembershipQuery.isLoading

  const canManageProject = useMemo(
    () => Boolean(
      permissionsReady
      && (
        isWorkspaceManager
        || project?.managerUser?.userId === currentUserId
        || Boolean(
          project?.managerTeamId
          && currentUserId
          && teamMembershipMap.get(project.managerTeamId)?.has(currentUserId)
        )
      ),
    ),
    [currentUserId, isWorkspaceManager, permissionsReady, project?.managerTeamId, project?.managerUser?.userId, teamMembershipMap],
  )

  const canManageGoal = (goal: GoalManagerShape | null | undefined) => {
    if (canManageProject) {
      return true
    }

    return Boolean(
      (goal?.managerUser?.userId && goal.managerUser.userId === currentUserId)
      || isCurrentUserInManagerTeam(goal?.managerTeamId),
    )
  }

  const canManageGoalById = (goalId: number | null | undefined) => {
    if (canManageProject) {
      return true
    }

    if (!goalId) {
      return false
    }

    return canManageGoal(goalManagerById.get(goalId))
  }

  const canManageTask = (goalId: number | null | undefined) => {
    if (canManageProject) {
      return true
    }

    if (!goalId) {
      return false
    }

    return canManageGoalById(goalId)
  }

  return {
    currentUserId,
    currentRole,
    isOwner,
    isWorkspaceManager,
    canManageProject,
    canManageGoal,
    canManageGoalById,
    canManageTask,
    permissionsReady,
    workspace,
    project,
    goals,
    members,
    teams: teamsQuery.data ?? [],
    teamMembershipMap,
  }
}
