import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Shield, ShieldAlert, ShieldCheck, Users, UserPlus, Trash2, Save, Lock, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { PageHeader } from '@/components/shared/page-header'
import { projectApi } from '@/lib/api/modules/project-api'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { workspaceTeamApi } from '@/lib/api/modules/workspace-team-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectPermissions } from '@/lib/permissions/use-project-permissions'
import type { EffectiveProjectAccessRoleType, ProjectAccessRoleType } from '@/types/domain'

const roleBadgeColor: Record<EffectiveProjectAccessRoleType, string> = {
  MANAGER: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  CONTRIBUTOR: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  VIEWER: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  NO_ACCESS: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

const roleIcon: Record<EffectiveProjectAccessRoleType, React.ElementType> = {
  MANAGER: ShieldCheck,
  CONTRIBUTOR: Shield,
  VIEWER: ShieldAlert,
  NO_ACCESS: Lock,
}

export function ProjectSettingsPage() {
  const { t } = useTranslation()
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)

  const [addAccessOpen, setAddAccessOpen] = useState(false)
  const [addAccessSubjectType, setAddAccessSubjectType] = useState<'USER' | 'TEAM'>('USER')
  const [addAccessUserId, setAddAccessUserId] = useState('')
  const [addAccessTeamId, setAddAccessTeamId] = useState('')
  const [addAccessRole, setAddAccessRole] = useState<ProjectAccessRoleType>('VIEWER')

  const permissions = useProjectPermissions({
    workspaceId: Number.isFinite(workspaceId) ? workspaceId : 0,
    projectId: Number.isFinite(projectId) ? projectId : 0,
    enabled: Number.isFinite(workspaceId) && Number.isFinite(projectId),
  })

  const {
    canManageProjectAccess,
    canGrantManager,
    canChangeVisibility,
    isOwner,
    effectiveAccess,
  } = permissions

  const projectQuery = useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => projectApi.detail(projectId),
    enabled: Number.isFinite(projectId),
  })

  const accessListQuery = useQuery({
    queryKey: queryKeys.projects.access(projectId),
    queryFn: () => projectApi.listAccess(projectId),
    enabled: Number.isFinite(projectId) && canManageProjectAccess,
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId),
    queryFn: () => workspaceApi.members(workspaceId),
    enabled: Number.isFinite(workspaceId) && canManageProjectAccess,
  })

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams.byWorkspace(workspaceId),
    queryFn: () => workspaceTeamApi.listByWorkspace(workspaceId),
    enabled: Number.isFinite(workspaceId) && canManageProjectAccess,
  })

  const addAccessMutation = useMutation({
    mutationFn: () => {
      if (addAccessSubjectType === 'USER') {
        return projectApi.upsertAccess(projectId, {
          subjectType: 'USER',
          userId: addAccessUserId,
          role: addAccessRole,
        })
      }
      return projectApi.upsertAccess(projectId, {
        subjectType: 'TEAM',
        teamId: Number(addAccessTeamId),
        role: addAccessRole,
      })
    },
    onSuccess: () => {
      setAddAccessOpen(false)
      setAddAccessUserId('')
      setAddAccessTeamId('')
      setAddAccessRole('VIEWER')
      accessListQuery.refetch()
    },
  })

  const updateAccessMutation = useMutation({
    mutationFn: ({ accessId, role }: { accessId: number; role: ProjectAccessRoleType }) => {
      return projectApi.updateAccess(projectId, accessId, role)
    },
    onSuccess: () => {
      accessListQuery.refetch()
    },
  })

  const revokeAccessMutation = useMutation({
    mutationFn: (accessId: number) => {
      return projectApi.revokeAccess(projectId, accessId)
    },
    onSuccess: () => {
      accessListQuery.refetch()
    },
  })

  const updateVisibilityMutation = useMutation({
    mutationFn: (newVisibility: 'PUBLIC' | 'PRIVATE') => {
      return projectApi.update(projectId, { visibility: newVisibility })
    },
    onSuccess: () => {
      projectQuery.refetch()
    },
  })

  if (projectQuery.isLoading) {
    return <LoadingPanel />
  }

  if (!projectQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">{t('project.notFound')}</p>
      </div>
    )
  }

  const accessList = accessListQuery.data ?? []
  const members = membersQuery.data ?? []
  const teams = teamsQuery.data ?? []
  const effectiveRole = effectiveAccess?.effectiveRole ?? 'NO_ACCESS'
  const visibility = effectiveAccess?.visibility ?? 'PUBLIC'
  const RoleIcon = roleIcon[effectiveRole as EffectiveProjectAccessRoleType]

  const canManageCurrentRole = (role: 'MANAGER' | 'CONTRIBUTOR' | 'VIEWER') => {
    if (!canManageProjectAccess) return false
    if (role === 'MANAGER' && !canGrantManager) return false
    return true
  }

  const roleOptions: ProjectAccessRoleType[] = canGrantManager
    ? ['MANAGER', 'CONTRIBUTOR', 'VIEWER']
    : ['CONTRIBUTOR', 'VIEWER']

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('project.settings.title')}
        description={t('project.settings.description')}
      />

      {/* Current Access Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            {t('project.settings.currentAccess')}
          </CardTitle>
          <CardDescription>{t('project.settings.currentAccessDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>{t('project.settings.visibility')}</Label>
              <div className="flex items-center gap-2">
                {visibility === 'PUBLIC' ? <Globe className="size-4" /> : <Lock className="size-4" />}
                <span className="font-medium">{t(`project.visibility.${visibility.toLowerCase()}`)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(`project.visibility.${visibility.toLowerCase()}Description`)}
              </p>
            </div>
            {isOwner && canChangeVisibility && (
              <Select
                value={visibility}
                onValueChange={(value: 'PUBLIC' | 'PRIVATE') => {
                  updateVisibilityMutation.mutate(value)
                }}
                disabled={updateVisibilityMutation.isPending}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('common.select')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">{t('project.visibility.public')}</SelectItem>
                  <SelectItem value="PRIVATE">{t('project.visibility.private')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator />

          <div className="space-y-1">
            <Label>{t('project.settings.yourRole')}</Label>
            <div className="flex items-center gap-2">
              <Badge className={roleBadgeColor[effectiveRole as EffectiveProjectAccessRoleType]}>
                <RoleIcon className="mr-1 size-3" />
                {t(`project.role.${effectiveRole.toLowerCase()}`)}
              </Badge>
              {isOwner && (
                <Badge variant="outline">{t('workspace.role.owner')}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {effectiveRole === 'MANAGER' && t('project.settings.roleManagerDescription')}
              {effectiveRole === 'CONTRIBUTOR' && t('project.settings.roleContributorDescription')}
              {effectiveRole === 'VIEWER' && t('project.settings.roleViewerDescription')}
              {effectiveRole === 'NO_ACCESS' && t('project.settings.roleNoAccessDescription')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Role Explanations */}
      <Card>
        <CardHeader>
          <CardTitle>{t('project.settings.roleExplanationTitle')}</CardTitle>
          <CardDescription>{t('project.settings.roleExplanationDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck className="size-4 text-purple-600" />
              {t('project.role.manager')}
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              {t('project.settings.roleManagerFullDescription')}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <Shield className="size-4 text-blue-600" />
              {t('project.role.contributor')}
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              {t('project.settings.roleContributorFullDescription')}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="size-4 text-gray-600" />
              {t('project.role.viewer')}
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              {t('project.settings.roleViewerFullDescription')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Access Management */}
      {canManageProjectAccess && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  {t('project.settings.accessManagement')}
                </CardTitle>
                <CardDescription>{t('project.settings.accessManagementDescription')}</CardDescription>
              </div>
              {!canGrantManager && (
                <Badge variant="outline" className="text-xs">
                  {t('project.settings.managerRestricted')}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Access Button */}
            <Dialog open={addAccessOpen} onOpenChange={setAddAccessOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 size-4" />
                  {t('project.settings.addAccess')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('project.settings.addAccessTitle')}</DialogTitle>
                  <DialogDescription>{t('project.settings.addAccessDescription')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('project.settings.subjectType')}</Label>
                    <Select value={addAccessSubjectType} onValueChange={(value: 'USER' | 'TEAM') => setAddAccessSubjectType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">{t('project.settings.user')}</SelectItem>
                        <SelectItem value="TEAM">{t('project.settings.team')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {addAccessSubjectType === 'USER' ? (
                    <div className="space-y-2">
                      <Label>{t('project.settings.selectUser')}</Label>
                      <Select value={addAccessUserId} onValueChange={setAddAccessUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('project.settings.selectUserPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((member) => (
                            <SelectItem key={member.user.userId} value={member.user.userId}>
                              {member.user.firstName} {member.user.lastName} ({member.user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>{t('project.settings.selectTeam')}</Label>
                      <Select value={addAccessTeamId} onValueChange={setAddAccessTeamId}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('project.settings.selectTeamPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={String(team.id)}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>{t('project.settings.role')}</Label>
                    <Select value={addAccessRole} onValueChange={(value: ProjectAccessRoleType) => setAddAccessRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((role) => (
                          <SelectItem key={role} value={role}>{t(`project.role.${role.toLowerCase()}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!canGrantManager && (
                      <p className="text-xs text-muted-foreground">
                        {t('project.settings.managerRestrictedHint')}
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddAccessOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={() => addAccessMutation.mutate()}
                    disabled={addAccessMutation.isPending || (addAccessSubjectType === 'USER' && !addAccessUserId) || (addAccessSubjectType === 'TEAM' && !addAccessTeamId)}
                  >
                    <Save className="mr-2 size-4" />
                    {t('common.save')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Access List */}
            {accessList.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('project.settings.noAccessGrants')}</p>
            ) : (
              <div className="space-y-2">
                {accessList.map((access) => (
                  <div key={access.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                        {access.subjectType === 'USER' ? (
                          <Users className="size-4" />
                        ) : (
                          <Shield className="size-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {access.subjectType === 'USER'
                            ? `${access.user?.firstName} ${access.user?.lastName}`
                            : access.team?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {access.subjectType === 'USER' ? access.user?.email : t('project.settings.team')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canManageCurrentRole(access.role) ? (
                        <Select
                          value={access.role}
                          onValueChange={(value: ProjectAccessRoleType) => {
                            updateAccessMutation.mutate({ accessId: access.id, role: value })
                          }}
                          disabled={updateAccessMutation.isPending}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((role) => (
                              <SelectItem key={role} value={role}>{t(`project.role.${role.toLowerCase()}`)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={roleBadgeColor[access.role]}>
                          {t(`project.role.${access.role.toLowerCase()}`)}
                        </Badge>
                      )}
                      {canManageCurrentRole(access.role) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => revokeAccessMutation.mutate(access.id)}
                          disabled={revokeAccessMutation.isPending}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    {access.grantedBy && (
                      <p className="mt-2 text-right text-[11px] text-muted-foreground">
                        {t('project.settings.grantedBy', {
                          name: `${access.grantedBy.firstName} ${access.grantedBy.lastName}`,
                        })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
