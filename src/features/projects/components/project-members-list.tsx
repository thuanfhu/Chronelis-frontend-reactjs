import { useState, useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Shield, ShieldCheck, ShieldAlert, Lock, Users, Users2, Search, Crown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { projectApi, type ProjectAccess } from '@/lib/api/modules/project-api'
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
  VIEWER:
    'bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-300/70 hover:bg-amber-400/30',
  NO_ACCESS:
    'bg-slate-200/50 text-slate-500 border-slate-300/50 dark:bg-slate-800/50 dark:text-slate-400 hover:bg-slate-200/80',
}

const roleIcon: Record<EffectiveProjectAccessRoleType, React.ElementType> = {
  MANAGER: ShieldCheck,
  CONTRIBUTOR: Shield,
  VIEWER: ShieldAlert,
  NO_ACCESS: Lock,
}

const accessRowClass =
  'group grid min-h-[88px] grid-cols-1 gap-3 p-4 my-1 rounded-xl transition-all duration-200 hover:bg-background hover:shadow-sm border border-transparent hover:border-border/60 sm:h-[88px] sm:grid-cols-[minmax(0,1fr)_188px] sm:items-center sm:gap-5'

const roleControlClass =
  'box-border flex h-11 max-h-11 w-full min-w-0 shrink-0 items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm font-semibold leading-5 antialiased shadow-sm transition-all sm:w-[188px]'

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

  const saveAccessMutation = useMutation({
    mutationFn: ({
      accessId,
      userId,
      teamId,
      role,
    }: {
      accessId?: number
      userId?: string
      teamId?: number
      role: ProjectAccessRoleType
    }) => {
      if (accessId) {
        return projectApi.updateAccess(projectId, accessId, role)
      }

      return projectApi.upsertAccess(projectId, {
        subjectType: userId ? 'USER' : 'TEAM',
        userId,
        teamId,
        role,
      })
    },
    onSuccess: () => {
      accessListQuery.refetch()
      toast.success(t('project.settings.accessUpdateSuccess', { defaultValue: 'Cập nhật quyền truy cập thành công' }))
    },
    onError: () => {
      toast.error(t('project.settings.accessUpdateFailed', { defaultValue: 'Cập nhật quyền truy cập thất bại' }))
    },
  })

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data])
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data])
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

  const canEditDirectGrant = (grant?: ProjectAccess) => {
    if (!canManageProjectAccess) return false
    return grant?.role !== 'MANAGER' || canGrantManager
  }

  const getRoleOptions = () => roleOptions

  const changeAccess = ({
    value,
    directGrant,
    userId,
    teamId,
  }: {
    value: ProjectAccessRoleType
    directGrant?: ProjectAccess
    userId?: string
    teamId?: number
  }) => {
    if (directGrant?.role === value) return

    saveAccessMutation.mutate({
      accessId: directGrant?.id,
      userId,
      teamId,
      role: value,
    })
  }

  const renderRoleContent = (role: EffectiveProjectAccessRoleType) => {
    const Icon = roleIcon[role]

    return (
      <span className="grid min-w-0 flex-1 grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 text-left">
        <Icon className="size-4 justify-self-center" />
        <span className="truncate">{t(`project.role.${role.toLowerCase()}`)}</span>
      </span>
    )
  }

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
                      const isWorkspaceOwner = userId === workspace.owner.userId
                      const hasNoAccess = effectiveRole === 'NO_ACCESS'
                      const selectedRole = (directGrant?.role ??
                        (project.visibility === 'PUBLIC'
                          ? 'CONTRIBUTOR'
                          : 'NO_ACCESS')) as EffectiveProjectAccessRoleType
                      const editable = canEditDirectGrant(directGrant)
                      const availableRoles = getRoleOptions()

                      return (
                        <div
                          key={userId}
                          className={cn(
                            accessRowClass,
                            hasNoAccess && 'opacity-70',
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-4">
                            <Avatar className="size-11 shrink-0 border border-border/50 shadow-sm ring-2 ring-background">
                              {member.user.avatarUrl && (
                                <AvatarImage
                                  src={member.user.avatarUrl}
                                  alt={`${member.user.firstName} ${member.user.lastName}`}
                                />
                              )}
                              <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                                {member.user.firstName?.[0]}
                                {member.user.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className="truncate text-[15px] font-bold tracking-tight text-foreground">
                                  {member.user.firstName} {member.user.lastName}
                                </span>
                                {isWorkspaceOwner && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex size-4 shrink-0 cursor-help items-center justify-center text-amber-500 dark:text-amber-400">
                                        <Crown className="size-3.5" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="font-bold text-xs">
                                      {t('project.settings.workspaceOwner')}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                              <span className="truncate text-sm text-muted-foreground/80 font-medium">
                                {member.user.email}
                              </span>
                            </div>
                          </div>

                          <div className="flex w-full items-center sm:justify-end">
                            <div className="flex w-full items-center sm:w-[188px]">
                              {editable && !isWorkspaceOwner ? (
                                <Select
                                  value={selectedRole}
                                  onValueChange={(val) => {
                                    changeAccess({
                                      value: val as ProjectAccessRoleType,
                                      directGrant,
                                      userId,
                                    })
                                  }}
                                  disabled={saveAccessMutation.isPending}
                                >
                                  <SelectTrigger
                                    className={cn(
                                      roleControlClass,
                                      'focus:ring-primary focus:ring-offset-0',
                                      roleBadgeColor[selectedRole],
                                    )}
                                  >
                                    {renderRoleContent(selectedRole)}
                                  </SelectTrigger>
                                  <SelectContent className="font-medium rounded-xl shadow-xl">
                                    {availableRoles.map((role) => {
                                      const optionRole = role as EffectiveProjectAccessRoleType
                                      return (
                                        <SelectItem
                                          key={role}
                                          value={role}
                                          className="py-2.5 text-sm font-semibold leading-5"
                                        >
                                          {renderRoleContent(optionRole)}
                                        </SelectItem>
                                      )
                                    })}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Select value={effectiveRole} disabled>
                                  <SelectTrigger
                                    className={cn(
                                      roleControlClass,
                                      'cursor-default focus:ring-primary focus:ring-offset-0 disabled:cursor-default disabled:opacity-100',
                                      isWorkspaceOwner && '[&>svg]:invisible',
                                      roleBadgeColor[effectiveRole],
                                    )}
                                  >
                                    {renderRoleContent(effectiveRole)}
                                  </SelectTrigger>
                                </Select>
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
                      const hasNoAccess = !directGrant
                      const selectedRole = (directGrant?.role ?? 'NO_ACCESS') as EffectiveProjectAccessRoleType
                      const editable = canEditDirectGrant(directGrant)
                      const availableRoles = getRoleOptions()

                      return (
                        <div
                          key={team.id}
                          className={cn(
                            accessRowClass,
                            hasNoAccess && 'opacity-70',
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-4">
                            <Avatar className="size-11 shrink-0 border border-primary/20 shadow-sm ring-2 ring-background">
                              {team.imageUrl && <AvatarImage src={team.imageUrl} alt={team.name} />}
                              <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                                {team.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="truncate text-[15px] font-bold tracking-tight text-foreground">
                                {team.name}
                              </span>
                              <span className="truncate text-sm text-muted-foreground/80 font-medium">
                                {t('workspace.teams.memberCount', { count: team.memberCount })}
                              </span>
                            </div>
                          </div>

                          <div className="flex w-full items-center sm:justify-end">
                            {editable ? (
                              <Select
                                value={selectedRole}
                                onValueChange={(val) => {
                                  changeAccess({
                                    value: val as ProjectAccessRoleType,
                                    directGrant,
                                    teamId: team.id,
                                  })
                                }}
                                disabled={saveAccessMutation.isPending}
                              >
                                <SelectTrigger
                                  className={cn(
                                    roleControlClass,
                                    'focus:ring-primary focus:ring-offset-0',
                                    roleBadgeColor[selectedRole],
                                  )}
                                >
                                  {renderRoleContent(selectedRole)}
                                </SelectTrigger>
                                <SelectContent className="font-medium rounded-xl shadow-xl">
                                  {availableRoles.map((role) => {
                                    const optionRole = role as EffectiveProjectAccessRoleType
                                    return (
                                      <SelectItem
                                        key={role}
                                        value={role}
                                        className="py-2.5 text-sm font-semibold leading-5"
                                      >
                                        {renderRoleContent(optionRole)}
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>
                            ) : (
                              directGrant && (
                                <Select value={directGrant.role} disabled>
                                  <SelectTrigger
                                    className={cn(
                                      roleControlClass,
                                      'cursor-default focus:ring-primary focus:ring-offset-0 disabled:cursor-default disabled:opacity-100',
                                      roleBadgeColor[directGrant.role as EffectiveProjectAccessRoleType],
                                    )}
                                  >
                                    {renderRoleContent(directGrant.role as EffectiveProjectAccessRoleType)}
                                  </SelectTrigger>
                                </Select>
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
