import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Shield, ShieldCheck, ShieldAlert, Globe, Lock, Info, Settings, Settings2, Fingerprint, Save, Users, BookOpen, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { projectApi } from '@/lib/api/modules/project-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectPermissions } from '@/lib/permissions/use-project-permissions'
import { ProjectAccessManagement } from './components/project-members-list'
import { toast } from 'sonner'
import type { EffectiveProjectAccessRoleType } from '@/types/domain'
import { cn } from '@/lib/utils'

const roleBadgeColor: Record<EffectiveProjectAccessRoleType, string> = {
  MANAGER: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-300/50',
  CONTRIBUTOR: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-300/50',
  VIEWER: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-300/50',
  NO_ACCESS: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-300/50',
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

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
  const [activeTab, setActiveTab] = useState<'general' | 'access' | 'roles'>('general')

  const permissions = useProjectPermissions({
    workspaceId: Number.isFinite(workspaceId) ? workspaceId : 0,
    projectId: Number.isFinite(projectId) ? projectId : 0,
    enabled: Number.isFinite(workspaceId) && Number.isFinite(projectId),
  })

  const {
    canChangeVisibility,
    isOwner,
    effectiveAccess,
  } = permissions

  const projectQuery = useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => projectApi.detail(projectId),
    enabled: Number.isFinite(projectId),
  })

  useEffect(() => {
    if (projectQuery.data) {
      setName(projectQuery.data.name)
      setDescription(projectQuery.data.description || '')
      setVisibility(projectQuery.data.visibility)
    }
  }, [projectQuery.data])

  const updateProjectMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string; visibility: 'PUBLIC' | 'PRIVATE' }) =>
      projectApi.update(projectId, payload),
    onSuccess: () => {
      projectQuery.refetch()
      toast.success(t('project.settings.saveSuccess'))
    },
    onError: () => {
      toast.error(t('project.settings.saveError'))
    },
  })

  if (projectQuery.isLoading) return <LoadingPanel />

  const project = projectQuery.data
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm font-medium text-muted-foreground">{t('project.notFound')}</p>
      </div>
    )
  }

  const effectiveRole = effectiveAccess?.effectiveRole ?? 'NO_ACCESS'
  const RoleIcon = roleIcon[effectiveRole as EffectiveProjectAccessRoleType]
  const hasChanges = name !== project.name || description !== (project.description || '') || visibility !== project.visibility

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12 px-4 md:px-0">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border/60 pb-6 gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="rounded-xl bg-primary/10 p-2 text-primary shadow-sm ring-1 ring-primary/20">
              <Settings2 className="size-6" />
            </div>
            {t('project.settings.title')}
          </h1>
          <p className="text-base font-medium text-muted-foreground max-w-2xl">
            {t('project.settings.description')}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Sidebar Navigation */}
        <aside className="w-full shrink-0 md:w-64">
          <div className="sticky top-20 space-y-6">
            <nav className="flex flex-col space-y-1.5">
              <Button
                variant={activeTab === 'general' ? 'secondary' : 'ghost'}
                className={cn(
                  "w-full justify-start gap-3 h-11 transition-all duration-200", 
                  activeTab === 'general' ? "bg-primary/10 text-primary hover:bg-primary/15 shadow-sm ring-1 ring-primary/20" : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveTab('general')}
              >
                <Settings className="size-4" />
                <span className="text-[13px] font-bold">{t('project.settings.tabGeneral')}</span>
              </Button>
              <Button
                variant={activeTab === 'access' ? 'secondary' : 'ghost'}
                className={cn(
                  "w-full justify-start gap-3 h-11 transition-all duration-200", 
                  activeTab === 'access' ? "bg-primary/10 text-primary hover:bg-primary/15 shadow-sm ring-1 ring-primary/20" : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveTab('access')}
              >
                <Users className="size-4" />
                <span className="text-[13px] font-bold">{t('project.settings.tabAccess')}</span>
              </Button>
              <Button
                variant={activeTab === 'roles' ? 'secondary' : 'ghost'}
                className={cn(
                  "w-full justify-start gap-3 h-11 transition-all duration-200", 
                  activeTab === 'roles' ? "bg-primary/10 text-primary hover:bg-primary/15 shadow-sm ring-1 ring-primary/20" : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveTab('roles')}
              >
                <BookOpen className="size-4" />
                <span className="text-[13px] font-bold">{t('project.settings.tabRoles')}</span>
              </Button>
            </nav>
            
            <Separator className="opacity-50" />

            {/* Personal Role Card */}
            <div className="rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 p-4 border border-border/60 shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5 relative z-10">
                <Fingerprint className="size-3.5" />
                {t('project.settings.yourRole')}
              </h4>
              <div className="flex flex-col gap-2 relative z-10">
                <div className="flex items-center gap-3">
                  <div className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm border", roleBadgeColor[effectiveRole as EffectiveProjectAccessRoleType])}>
                    <RoleIcon className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold tracking-tight text-foreground">
                      {t(`project.role.${effectiveRole.toLowerCase()}`)}
                    </h3>
                    {isOwner && (
                      <Badge variant="outline" className="h-[18px] border-primary/30 bg-primary/10 px-1.5 text-[9px] font-black uppercase text-primary tracking-tighter mt-0.5">
                        {t('workspace.role.owner')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div
                key="general"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="space-y-8"
              >
                {/* Basic Info Card */}
                <Card className="overflow-hidden border-none shadow-lg ring-1 ring-border/60">
                  <CardHeader className="bg-background border-b border-border/60 px-6 py-5">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <div className="bg-primary/10 p-1.5 rounded-md text-primary">
                        <Info className="size-5" />
                      </div>
                      {t('project.settings.editBasicInfo')}
                    </CardTitle>
                    <CardDescription className="text-sm">{t('project.settings.editBasicInfoDescription')}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6 bg-muted/20">
                    <div className="space-y-2.5">
                      <label className="text-sm font-bold text-foreground/90">{t('project.settings.projectNameLabel')}</label>
                      <Input 
                        value={name} 
                        onChange={(e) => setName(e.target.value)}
                        className="bg-background h-11 border-border/60 font-medium focus-visible:ring-primary shadow-sm text-base transition-shadow hover:shadow-md focus-visible:shadow-md"
                        placeholder={t('project.settings.projectNameLabel')}
                        disabled={!isOwner}
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-sm font-bold text-foreground/90">{t('project.settings.projectDescriptionLabel')}</label>
                      <Textarea 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)}
                        className="bg-background min-h-[140px] border-border/60 font-medium focus-visible:ring-primary shadow-sm resize-none text-base transition-shadow hover:shadow-md focus-visible:shadow-md"
                        placeholder={t('project.settings.projectDescriptionLabel')}
                        disabled={!isOwner}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Visibility Card */}
                <Card className="overflow-hidden border-none shadow-lg ring-1 ring-border/60">
                  <CardHeader className="bg-background border-b border-border/60 px-6 py-5">
                    <CardTitle className="flex items-center gap-2 text-xl font-bold">
                      <div className="bg-primary/10 p-1.5 rounded-md text-primary">
                        <Globe className="size-5" />
                      </div>
                      {t('project.settings.visibility')}
                    </CardTitle>
                    <CardDescription className="text-sm">{t('project.visibility.publicDescription')}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 bg-muted/20">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div 
                        onClick={() => isOwner && canChangeVisibility && setVisibility('PUBLIC')}
                        className={cn(
                          "relative flex cursor-pointer flex-col gap-3 rounded-2xl border-2 p-5 transition-all duration-200 shadow-sm",
                          visibility === 'PUBLIC' ? "border-primary bg-primary/[0.03] shadow-primary/10 ring-4 ring-primary/5" : "border-border/60 bg-background hover:bg-muted/50 hover:border-border",
                          (!isOwner || !canChangeVisibility) && "cursor-not-allowed opacity-50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className={cn("p-2 rounded-xl", visibility === 'PUBLIC' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                            <Globe className="size-6" />
                          </div>
                          {visibility === 'PUBLIC' && <div className="size-2.5 rounded-full bg-primary ring-4 ring-primary/20" />}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-base mb-1">{t('project.visibility.public')}</h4>
                          <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                            {t('project.visibility.publicDescription')}
                          </p>
                        </div>
                      </div>

                      <div 
                        onClick={() => isOwner && canChangeVisibility && setVisibility('PRIVATE')}
                        className={cn(
                          "relative flex cursor-pointer flex-col gap-3 rounded-2xl border-2 p-5 transition-all duration-200 shadow-sm",
                          visibility === 'PRIVATE' ? "border-primary bg-primary/[0.03] shadow-primary/10 ring-4 ring-primary/5" : "border-border/60 bg-background hover:bg-muted/50 hover:border-border",
                          (!isOwner || !canChangeVisibility) && "cursor-not-allowed opacity-50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className={cn("p-2 rounded-xl", visibility === 'PRIVATE' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                            <Lock className="size-6" />
                          </div>
                          {visibility === 'PRIVATE' && <div className="size-2.5 rounded-full bg-primary ring-4 ring-primary/20" />}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-base mb-1">{t('project.visibility.private')}</h4>
                          <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                            {t('project.visibility.privateDescription')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {isOwner && (
                  <div className="flex justify-end pt-2">
                    <Button 
                      onClick={() => updateProjectMutation.mutate({ name, description, visibility })}
                      disabled={updateProjectMutation.isPending || !name.trim() || !hasChanges}
                      className="gap-2 shadow-md hover:shadow-lg transition-all min-w-36 h-11 font-bold rounded-xl"
                    >
                      <Save className="size-4.5" />
                      {t('project.settings.saveChanges')}
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'access' && (
              <motion.div
                key="access"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="h-[750px] flex flex-col"
              >
                 <ProjectAccessManagement workspaceId={workspaceId} projectId={projectId} />
              </motion.div>
            )}

            {activeTab === 'roles' && (
              <motion.div
                key="roles"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* MANAGER */}
                  <Card className="border-none shadow-lg ring-1 ring-border/60 overflow-hidden bg-background flex flex-col">
                    <CardHeader className="pb-4">
                      <div className="size-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mb-4 shadow-inner">
                        <ShieldCheck className="size-6" />
                      </div>
                      <CardTitle className="text-xl font-extrabold text-foreground">{t('project.role.manager')}</CardTitle>
                      <CardDescription className="text-xs font-bold uppercase tracking-wider text-purple-600/80">{t('project.settings.managerRestricted', { defaultValue: 'Full Access' })}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-6">
                      <p className="text-[13px] font-medium leading-relaxed text-muted-foreground/90 italic border-l-2 border-purple-200 pl-4 py-1 min-h-[80px]">
                        "{t('project.settings.roleManagerFullDescription')}"
                      </p>
                      <div className="space-y-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-foreground/40">{t('project.settings.whatsIncluded')}</p>
                        <ul className="space-y-2.5">
                          <li className="flex items-start gap-2.5 text-[13px] font-bold text-foreground/80">
                            <Check className="size-4 text-green-500 shrink-0 mt-0.5" />
                            <span>{t('project.settings.permManageTasks')}</span>
                          </li>
                          <li className="flex items-start gap-2.5 text-[13px] font-bold text-foreground/80">
                            <Check className="size-4 text-green-500 shrink-0 mt-0.5" />
                            <span>{t('project.settings.permManageAccess')}</span>
                          </li>
                          <li className="flex items-start gap-2.5 text-[13px] font-bold text-foreground/80">
                            <Check className="size-4 text-green-500 shrink-0 mt-0.5" />
                            <span>{t('project.settings.permManageGoals')}</span>
                          </li>
                          <li className="flex items-start gap-2.5 text-[13px] font-bold text-foreground/80">
                            <X className="size-4 text-red-400 shrink-0 mt-0.5" />
                            <span className="text-muted-foreground/60 line-through decoration-red-400/40">{t('project.settings.permDeleteProject')}</span>
                          </li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  {/* CONTRIBUTOR */}
                  <Card className="border-none shadow-lg ring-1 ring-border/60 overflow-hidden bg-background flex flex-col">
                    <CardHeader className="pb-4">
                      <div className="size-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-4 shadow-inner">
                        <Shield className="size-6" />
                      </div>
                      <CardTitle className="text-xl font-extrabold text-foreground">{t('project.role.contributor')}</CardTitle>
                      <CardDescription className="text-xs font-bold uppercase tracking-wider text-blue-600/80">{t('project.settings.standardMember', { defaultValue: 'Member' })}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-6">
                      <p className="text-[13px] font-medium leading-relaxed text-muted-foreground/90 italic border-l-2 border-blue-200 pl-4 py-1 min-h-[80px]">
                        "{t('project.settings.roleContributorFullDescription')}"
                      </p>
                      <div className="space-y-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-foreground/40">{t('project.settings.whatsIncluded')}</p>
                        <ul className="space-y-2.5">
                          <li className="flex items-start gap-2.5 text-[13px] font-bold text-foreground/80">
                            <Check className="size-4 text-green-500 shrink-0 mt-0.5" />
                            <span>{t('project.settings.permCreateTasks')}</span>
                          </li>
                          <li className="flex items-start gap-2.5 text-[13px] font-bold text-foreground/80">
                            <Check className="size-4 text-green-500 shrink-0 mt-0.5" />
                            <span>{t('project.settings.permManageOwnGoals')}</span>
                          </li>
                          <li className="flex items-start gap-2.5 text-[13px] font-bold text-foreground/80">
                            <X className="size-4 text-red-400 shrink-0 mt-0.5" />
                            <span className="text-muted-foreground/60 line-through decoration-red-400/40">{t('project.settings.permInviteOthers')}</span>
                          </li>
                          <li className="flex items-start gap-2.5 text-[13px] font-bold text-foreground/80">
                            <X className="size-4 text-red-400 shrink-0 mt-0.5" />
                            <span className="text-muted-foreground/60 line-through decoration-red-400/40">{t('project.settings.permSettings')}</span>
                          </li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  {/* VIEWER */}
                  <Card className="border-none shadow-lg ring-1 ring-border/60 overflow-hidden bg-background flex flex-col">
                    <CardHeader className="pb-4">
                      <div className="size-12 rounded-2xl bg-slate-500/10 text-slate-600 flex items-center justify-center mb-4 shadow-inner">
                        <ShieldAlert className="size-6" />
                      </div>
                      <CardTitle className="text-xl font-extrabold text-foreground">{t('project.role.viewer')}</CardTitle>
                      <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-600/80">{t('project.settings.readOnly', { defaultValue: 'Read Only' })}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-6">
                      <p className="text-[13px] font-medium leading-relaxed text-muted-foreground/90 italic border-l-2 border-slate-200 pl-4 py-1 min-h-[80px]">
                        "{t('project.settings.roleViewerFullDescription')}"
                      </p>
                      <div className="space-y-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-foreground/40">{t('project.settings.whatsIncluded')}</p>
                        <ul className="space-y-2.5">
                          <li className="flex items-start gap-2.5 text-[13px] font-bold text-foreground/80">
                            <Check className="size-4 text-green-500 shrink-0 mt-0.5" />
                            <span>{t('project.settings.permViewTasks')}</span>
                          </li>
                          <li className="flex items-start gap-2.5 text-[13px] font-bold text-foreground/80">
                            <Check className="size-4 text-green-500 shrink-0 mt-0.5" />
                            <span>{t('project.settings.permViewGoals')}</span>
                          </li>
                          <li className="flex items-start gap-2.5 text-[13px] font-bold text-foreground/80">
                            <X className="size-4 text-red-400 shrink-0 mt-0.5" />
                            <span className="text-muted-foreground/60 line-through decoration-red-400/40">{t('project.settings.permEditTasks')}</span>
                          </li>
                          <li className="flex items-start gap-2.5 text-[13px] font-bold text-foreground/80">
                            <X className="size-4 text-red-400 shrink-0 mt-0.5" />
                            <span className="text-muted-foreground/60 line-through decoration-red-400/40">{t('project.settings.permComment')}</span>
                          </li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
