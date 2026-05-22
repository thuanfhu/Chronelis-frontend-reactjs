import { useState, useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Shield, ShieldCheck, ShieldAlert, Lock, Users, Users2, Search, Crown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { projectApi } from '@/lib/api/modules/project-api'
import { workspaceTeamApi } from '@/lib/api/modules/workspace-team-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectPermissions } from '@/lib/permissions/use-project-permissions'
import type { EffectiveProjectAccessRoleType, ProjectAccessRoleType } from '@/types/domain'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ProjectAccessManagementProps {
  workspaceId: number
  projectId: number
}

const roleBadgeColor: Record<EffectiveProjectAccessRoleType, string> = {
  MANAGER: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-300/50 hover:bg-purple-500/20',
  CONTRIBUTOR: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-300/50 hover:bg-blue-500/20',
  VIEWER: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-300/50 hover:bg-slate-500/20',
  NO_ACCESS:
    'bg-slate-200/50 text-slate-500 border-slate-300/50 dark:bg-slate-800/50 dark:text-slate-400 hover:bg-slate-200/80',
}

const roleIcon: Record<EffectiveProjectAccessRoleType, React.ElementType> = {
  MANAGER: ShieldCheck,
  CONTRIBUTOR: Shield,
  VIEWER: ShieldAlert,
  NO_ACCESS: Lock,
}

export function ProjectAccessManagement({ workspaceId, projectId }: ProjectAccessManagementProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const { canManageProjectAccess, canGrantManager } = useProjectPermissions({ workspaceId, projectId })

  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId),
    queryFn: () => workspaceApi.detail(workspaceId),
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId),
    queryFn: () => workspaceApi.members(workspaceId),
  })

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams.byWorkspace(workspaceId),
    queryFn: () => workspaceTeamApi.listByWorkspace(workspaceId),
  })

  const accessListQuery = useQuery({
    queryKey: queryKeys.projects.access(projectId),
    queryFn: () => projectApi.listAccess(projectId),
  })

  const projectQuery = useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => projectApi.detail(projectId),
  })

  const upsertMutation = useMutation({
    mutationFn: ({ userId, teamId, role }: { userId?: string; teamId?: number; role: ProjectAccessRoleType }) =>
      projectApi.upsertAccess(projectId, {
        subjectType: userId ? 'USER' : 'TEAM',
        userId,
        teamId,
        role,
      }),
    onSuccess: () => {
      accessListQuery.refetch()
      toast.success(t('workspace.toast.projectUpdated', { defaultValue: 'Cập nhật quyền thành công' }))
    },
    onError: () => {
      toast.error(t('workspace.toast.projectUpdateFailed', { defaultValue: 'Cập nhật quyền thất bại' }))
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (accessId: number) => projectApi.revokeAccess(projectId, accessId),
    onSuccess: () => {
      accessListQuery.refetch()
      toast.success(t('workspace.toast.memberRemoved', { defaultValue: 'Đã thu hồi quyền truy cập' }))
    },
    onError: () => {
      toast.error(t('workspace.toast.memberRemoveFailed', { defaultValue: 'Thu hồi quyền thất bại' }))
    },
  })

  const members = membersQuery.data ?? []
  const teams = teamsQuery.data ?? []
  const directGrants = accessListQuery.data ?? []
  const project = projectQuery.data
  const workspace = workspaceQuery.data

  const filteredMembers = useMemo(() => {
    return members.filter(
      (m) =>
        `${m.user.firstName} ${m.user.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        m.user.email.toLowerCase().includes(search.toLowerCase()),
    )
  }, [members, search])

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
  }, [teams, search])

  if (
    membersQuery.isLoading ||
    accessListQuery.isLoading ||
    projectQuery.isLoading ||
    teamsQuery.isLoading ||
    workspaceQuery.isLoading
  ) {
    return (
      <Card className="overflow-hidden border-none shadow-lg ring-1 ring-border/60">
        <div className="h-72 animate-pulse bg-muted/40" />
      </Card>
    )
  }

  if (!project || !workspace) return null

  const userDirectGrants = new Map(
    directGrants.filter((g) => g.subjectType === 'USER' && g.user).map((g) => [g.user!.userId, g]),
  )
  const teamDirectGrants = new Map(
    directGrants.filter((g) => g.subjectType === 'TEAM' && g.team).map((g) => [g.team!.id, g]),
  )

  const getEffectiveRole = (userId: string) => {
    if (userId === workspace.owner.userId) return 'MANAGER'
    const directGrant = userDirectGrants.get(userId)
    const directRole = directGrant?.role
    const defaultRole = project.visibility === 'PUBLIC' ? 'CONTRIBUTOR' : 'NO_ACCESS'
    const roleWeight = { MANAGER: 3, CONTRIBUTOR: 2, VIEWER: 1, NO_ACCESS: 0 }
    const directWeight = directRole ? roleWeight[directRole] : -1
    const defaultWeight = roleWeight[defaultRole as keyof typeof roleWeight]
    const effectiveWeight = Math.max(directWeight, defaultWeight)
    return Object.keys(roleWeight).find(
      (k) => roleWeight[k as keyof typeof roleWeight] === effectiveWeight,
    ) as EffectiveProjectAccessRoleType
  }

  const roleOptions: ProjectAccessRoleType[] = canGrantManager
    ? ['MANAGER', 'CONTRIBUTOR', 'VIEWER']
    : ['CONTRIBUTOR', 'VIEWER']

  return (
    <Card className="overflow-hidden border-none shadow-lg ring-1 ring-border/60 bg-background flex flex-col h-full">
      <CardHeader className="bg-background border-b border-border/60 px-6 py-5 shrink-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <div className="bg-primary/10 p-1.5 rounded-md text-primary">
                <Users className="size-5" />
              </div>
              {t('project.settings.accessManagement')}
            </CardTitle>
            <CardDescription className="text-sm">{t('project.settings.accessManagementDescription')}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col min-h-0 bg-muted/10">
        <Tabs defaultValue="members" className="flex flex-col h-full w-full">
          <div className="border-b border-border/60 bg-background px-6 pt-4 pb-4 sm:pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
            <TabsList className="h-10 bg-muted/50 p-1 rounded-xl gap-1 w-max">
              <TabsTrigger
                value="members"
                className="relative h-8 rounded-lg px-3 font-bold shadow-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground transition-all"
              >
                <div className="flex items-center gap-2">
                  <Users className="size-4" />
                  <span>{t('project.settings.membersList')}</span>
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-muted-foreground/10">
                    {filteredMembers.length}
                  </Badge>
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="teams"
                className="relative h-8 rounded-lg px-3 font-bold shadow-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground transition-all"
              >
                <div className="flex items-center gap-2">
                  <Users2 className="size-4" />
                  <span>{t('project.settings.team')}</span>
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-muted-foreground/10">
                    {filteredTeams.length}
                  </Badge>
                </div>
              </TabsTrigger>
            </TabsList>

            <div className="relative w-full sm:w-[360px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                placeholder={t('project.settings.searchPlaceholder')}
                className="h-10 px-10 text-center text-sm font-medium bg-muted/30 border-border/60 focus-visible:ring-primary shadow-sm rounded-xl transition-all hover:bg-muted/50 focus:bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
            <TabsContent value="members" className="m-0 h-full absolute inset-0">
              <ScrollArea className="h-full">
                <div className="divide-y divide-border/40 p-2">
                  {filteredMembers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                      <div className="bg-muted/50 p-4 rounded-full mb-4">
                        <Search className="size-8 opacity-40" />
                      </div>
                      <p className="text-base font-bold text-foreground">{t('project.settings.noResults')}</p>
                      <p className="text-sm font-medium mt-1">
                        {t('project.settings.tryDifferentSearch', { defaultValue: 'Thử tìm với từ khóa khác' })}
                      </p>
                    </div>
                  ) : (
                    filteredMembers.map((member) => {
                      const userId = member.user.userId
                      const directGrant = userDirectGrants.get(userId)
                      const effectiveRole = getEffectiveRole(userId)
                      const RoleIcon = roleIcon[effectiveRole]
                      const isWorkspaceOwner = userId === workspace.owner.userId
                      const hasNoAccess = effectiveRole === 'NO_ACCESS'

                      return (
                        <div
                          key={userId}
                          className={cn(
                            'group flex flex-col sm:flex-row sm:items-center justify-between p-4 my-1 rounded-xl transition-all duration-200 hover:bg-background hover:shadow-sm border border-transparent hover:border-border/60',
                            hasNoAccess && 'opacity-70',
                          )}
                        >
                          <div className="flex items-center gap-4 mb-4 sm:mb-0">
                            <Avatar className="size-11 border border-border/50 shadow-sm ring-2 ring-background">
                              <AvatarImage src={undefined} />
                              <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                                {member.user.firstName?.[0]}
                                {member.user.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2.5">
                                <span className="text-[15px] font-bold tracking-tight text-foreground">
                                  {member.user.firstName} {member.user.lastName}
                                </span>
                                {isWorkspaceOwner && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex size-6 cursor-help items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm transition-colors hover:bg-amber-500/20">
                                        <Crown className="size-3.5" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="font-bold text-xs">
                                      {t('project.settings.workspaceOwner')}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                              <span className="text-sm text-muted-foreground/80 font-medium">{member.user.email}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end w-full sm:w-auto">
                            <div className="flex items-center gap-2">
                              {canManageProjectAccess && !isWorkspaceOwner ? (
                                <Select
                                  value={
                                    directGrant?.role ?? (project.visibility === 'PUBLIC' ? 'CONTRIBUTOR' : 'NO_ACCESS')
                                  }
                                  onValueChange={(val) => {
                                    if (val === 'NO_ACCESS') {
                                      if (directGrant) revokeMutation.mutate(directGrant.id)
                                    } else {
                                      upsertMutation.mutate({ userId, role: val as ProjectAccessRoleType })
                                    }
                                  }}
                                  disabled={upsertMutation.isPending || revokeMutation.isPending}
                                >
                                  <SelectTrigger
                                    className={cn(
                                      'h-10 w-[180px] border border-border/50 shadow-sm text-[13px] font-bold transition-all focus:ring-primary focus:ring-offset-0',
                                      roleBadgeColor[effectiveRole],
                                    )}
                                  >
                                    <div className="flex items-center justify-center gap-2 truncate w-full">
                                      <span className="truncate">
                                        {!directGrant && project.visibility !== 'PUBLIC' ? (
                                          <div className="flex items-center gap-2 text-muted-foreground">
                                            <Lock className="size-4" />
                                            {t('project.role.no_access')}
                                          </div>
                                        ) : (
                                          <SelectValue />
                                        )}
                                      </span>
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent className="font-medium rounded-xl shadow-xl">
                                    <SelectItem
                                      value="NO_ACCESS"
                                      className="text-[13px] font-bold text-destructive py-2.5 focus:bg-destructive/10"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Lock className="size-4" />
                                        {t('project.role.no_access')}
                                      </div>
                                    </SelectItem>
                                    {roleOptions.map((role) => {
                                      const Icon = roleIcon[role as EffectiveProjectAccessRoleType]
                                      return (
                                        <SelectItem key={role} value={role} className="text-[13px] font-bold py-2.5">
                                          <div className="flex items-center gap-2">
                                            <Icon className="size-4" />
                                            {t(`project.role.${role.toLowerCase()}`)}
                                          </div>
                                        </SelectItem>
                                      )
                                    })}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'h-9 gap-2 px-3.5 text-[13px] font-bold border shadow-sm',
                                    roleBadgeColor[effectiveRole],
                                  )}
                                >
                                  <RoleIcon className="size-4" />
                                  {t(`project.role.${effectiveRole.toLowerCase()}`)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="teams" className="m-0 h-full absolute inset-0">
              <ScrollArea className="h-full">
                <div className="divide-y divide-border/40 p-2">
                  {filteredTeams.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                      <div className="bg-muted/50 p-4 rounded-full mb-4">
                        <Users2 className="size-8 opacity-40" />
                      </div>
                      <p className="text-base font-bold text-foreground">
                        {search ? t('project.settings.noTeamsResults') : t('workspace.teams.empty')}
                      </p>
                      {search && (
                        <p className="text-sm font-medium mt-1">
                          {t('project.settings.tryDifferentSearch', { defaultValue: 'Thử tìm với từ khóa khác' })}
                        </p>
                      )}
                    </div>
                  ) : (
                    filteredTeams.map((team) => {
                      const directGrant = teamDirectGrants.get(team.id)
                      const RoleIcon = directGrant ? roleIcon[directGrant.role as EffectiveProjectAccessRoleType] : Lock
                      const hasNoAccess = !directGrant

                      return (
                        <div
                          key={team.id}
                          className={cn(
                            'group flex flex-col sm:flex-row sm:items-center justify-between p-4 my-1 rounded-xl transition-all duration-200 hover:bg-background hover:shadow-sm border border-transparent hover:border-border/60',
                            hasNoAccess && 'opacity-70',
                          )}
                        >
                          <div className="flex items-center gap-4 mb-4 sm:mb-0">
                            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm border border-primary/20">
                              <Users2 className="size-5.5" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[15px] font-bold tracking-tight text-foreground">{team.name}</span>
                              <span className="text-sm text-muted-foreground/80 font-medium">
                                {t('workspace.teams.memberCount', { count: team.memberCount })}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto">
                            {canManageProjectAccess ? (
                              <Select
                                value={directGrant?.role ?? 'NO_ACCESS'}
                                onValueChange={(val) => {
                                  if (val === 'NO_ACCESS') {
                                    if (directGrant) revokeMutation.mutate(directGrant.id)
                                  } else {
                                    upsertMutation.mutate({ teamId: team.id, role: val as ProjectAccessRoleType })
                                  }
                                }}
                                disabled={upsertMutation.isPending || revokeMutation.isPending}
                              >
                                <SelectTrigger
                                  className={cn(
                                    'h-10 w-[180px] border border-border/50 shadow-sm text-[13px] font-bold transition-all focus:ring-primary focus:ring-offset-0',
                                    directGrant
                                      ? roleBadgeColor[directGrant.role as EffectiveProjectAccessRoleType]
                                      : 'bg-muted/50 text-muted-foreground hover:bg-muted/80',
                                  )}
                                >
                                  <div className="flex items-center justify-center gap-2 truncate w-full">
                                    <span className="truncate">
                                      {!directGrant ? (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                          <Lock className="size-4" />
                                          {t('project.role.no_access')}
                                        </div>
                                      ) : (
                                        <SelectValue />
                                      )}
                                    </span>
                                  </div>
                                </SelectTrigger>
                                <SelectContent className="font-medium rounded-xl shadow-xl">
                                  <SelectItem
                                    value="NO_ACCESS"
                                    className="text-[13px] font-bold text-destructive py-2.5 focus:bg-destructive/10"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Lock className="size-4" />
                                      {t('project.role.no_access')}
                                    </div>
                                  </SelectItem>
                                  {roleOptions.map((role) => {
                                    const Icon = roleIcon[role as EffectiveProjectAccessRoleType]
                                    return (
                                      <SelectItem key={role} value={role} className="text-[13px] font-bold py-2.5">
                                        <div className="flex items-center gap-2">
                                          <Icon className="size-4" />
                                          {t(`project.role.${role.toLowerCase()}`)}
                                        </div>
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>
                            ) : (
                              directGrant && (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'h-9 gap-2 px-3.5 text-[13px] font-bold border shadow-sm',
                                    roleBadgeColor[directGrant.role as EffectiveProjectAccessRoleType],
                                  )}
                                >
                                  <RoleIcon className="size-4" />
                                  {t(`project.role.${directGrant.role.toLowerCase()}`)}
                                </Badge>
                              )
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  )
}
