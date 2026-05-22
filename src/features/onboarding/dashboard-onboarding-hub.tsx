import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Columns3,
  Eye,
  FolderKanban,
  ListTodo,
  Lock,
  Rocket,
  Sparkles,
  Target,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useDashboardOnboardingState,
  type DashboardLearningStepKey,
} from '@/features/onboarding/use-dashboard-onboarding-state'
import { cn } from '@/lib/utils'
import type { Goal, Project, Task, Workspace, WorkspaceInvite, WorkspaceMember } from '@/types/domain'

type OnboardingStatus = 'completed' | 'recommended' | 'locked' | 'explore' | 'next'
type OnboardingGroup = 'setup' | 'projects' | 'work' | 'collaboration'

interface OnboardingAction {
  label: string
  onClick: () => void
  disabled?: boolean
  disabledReason?: string
}

interface OnboardingStep {
  id: string
  group: OnboardingGroup
  icon: LucideIcon
  title: string
  description: string
  completed: boolean
  locked?: boolean
  recommended?: boolean
  explore?: boolean
  lockReason?: string
  action: OnboardingAction
  secondaryAction?: OnboardingAction
}

interface DashboardOnboardingHubProps {
  userId?: string | number | null
  workspaces: Workspace[]
  workspaceCount: number
  projects: Project[]
  goals: Goal[]
  tasks: Task[]
  members: WorkspaceMember[]
  invites: WorkspaceInvite[]
  unreadNotificationCount: number
  selectedWorkspaceId?: number | null
  selectedProjectId?: number | null
  loading?: boolean
}

const groupOrder: OnboardingGroup[] = ['setup', 'projects', 'work', 'collaboration']

export function DashboardOnboardingHub({
  userId,
  workspaces,
  workspaceCount,
  projects,
  goals,
  tasks,
  members,
  invites,
  unreadNotificationCount,
  selectedWorkspaceId,
  selectedProjectId,
  loading = false,
}: DashboardOnboardingHubProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)
  const { state, markSeen, setCollapsed, dismiss, restore, markLearningStep } = useDashboardOnboardingState(userId)

  useEffect(() => {
    markSeen()
  }, [markSeen])

  const targetWorkspace = useMemo(() => {
    if (selectedWorkspaceId) {
      const selected = workspaces.find((workspace) => workspace.id === selectedWorkspaceId)
      if (selected) {
        return selected
      }
    }
    return workspaces[0]
  }, [selectedWorkspaceId, workspaces])

  const targetProject = useMemo(() => {
    if (selectedProjectId) {
      const selected = projects.find((project) => project.id === selectedProjectId)
      if (selected) {
        return selected
      }
    }
    return projects[0]
  }, [projects, selectedProjectId])

  const workspaceId = targetWorkspace?.id
  const projectId = targetProject?.id
  const workspaceCreated = workspaceCount > 0 || workspaces.length > 0
  const projectCreated = projects.length > 0
  const goalCreated = goals.length > 0
  const taskCreated = tasks.length > 0
  const invitedMember = members.length > 1 || invites.length > 0
  const completedLearningSteps = state.completedLearningSteps
  const collapsedDashboardHub = state.collapsedDashboardHub

  const navigateTo = useCallback(
    (path: string, learningStep?: DashboardLearningStepKey) => {
      if (learningStep) {
        markLearningStep(learningStep)
      }
      navigate(path)
    },
    [markLearningStep, navigate],
  )

  const workspacePath = workspaceId ? `/workspaces/${workspaceId}` : '/workspaces'
  const projectPath = workspaceId && projectId ? `/workspaces/${workspaceId}/projects/${projectId}` : null
  const needsWorkspaceReason = t('onboarding.reason.needsWorkspace')
  const needsProjectReason = t('onboarding.reason.needsProject')

  const steps = useMemo<OnboardingStep[]>(
    () => [
      {
        id: 'create-workspace',
        group: 'setup',
        icon: Users,
        title: t('onboarding.steps.createWorkspace.title'),
        description: t('onboarding.steps.createWorkspace.description'),
        completed: workspaceCreated,
        action: {
          label: t('onboarding.steps.createWorkspace.cta'),
          onClick: () => navigateTo('/workspaces'),
        },
      },
      {
        id: 'create-project',
        group: 'setup',
        icon: FolderKanban,
        title: t('onboarding.steps.createProject.title'),
        description: t('onboarding.steps.createProject.description'),
        completed: projectCreated,
        locked: !workspaceCreated,
        lockReason: needsWorkspaceReason,
        action: {
          label: t('onboarding.steps.createProject.cta'),
          onClick: () => navigateTo(workspacePath),
          disabled: !workspaceCreated,
          disabledReason: needsWorkspaceReason,
        },
      },
      {
        id: 'create-goal',
        group: 'projects',
        icon: Target,
        title: t('onboarding.steps.createGoal.title'),
        description: t('onboarding.steps.createGoal.description'),
        completed: goalCreated,
        locked: !projectCreated || !projectPath,
        recommended: true,
        lockReason: needsProjectReason,
        action: {
          label: t('onboarding.steps.createGoal.cta'),
          onClick: () => projectPath && navigateTo(`${projectPath}?view=goals`),
          disabled: !projectCreated || !projectPath,
          disabledReason: needsProjectReason,
        },
      },
      {
        id: 'create-task',
        group: 'projects',
        icon: ListTodo,
        title: t('onboarding.steps.createTask.title'),
        description: t('onboarding.steps.createTask.description'),
        completed: taskCreated,
        locked: !projectCreated || !projectPath,
        lockReason: needsProjectReason,
        action: {
          label: t('onboarding.steps.createTask.cta'),
          onClick: () => projectPath && navigateTo(`${projectPath}?view=kanban`),
          disabled: !projectCreated || !projectPath,
          disabledReason: needsProjectReason,
        },
      },
      {
        id: 'invite-member',
        group: 'collaboration',
        icon: UserPlus,
        title: t('onboarding.steps.inviteMember.title'),
        description: t('onboarding.steps.inviteMember.description'),
        completed: invitedMember,
        locked: !workspaceCreated || !workspaceId,
        lockReason: needsWorkspaceReason,
        action: {
          label: t('onboarding.steps.inviteMember.cta'),
          onClick: () => workspaceId && navigateTo(`/workspaces/${workspaceId}?tab=invites`),
          disabled: !workspaceCreated || !workspaceId,
          disabledReason: needsWorkspaceReason,
        },
      },
      {
        id: 'kanban-view',
        group: 'work',
        icon: Columns3,
        title: t('onboarding.steps.openKanban.title'),
        description: t('onboarding.steps.openKanban.description'),
        completed: completedLearningSteps.includes('kanbanVisited'),
        locked: !projectCreated || !projectPath,
        explore: true,
        lockReason: needsProjectReason,
        action: {
          label: t('onboarding.steps.openKanban.cta'),
          onClick: () => projectPath && navigateTo(`${projectPath}?view=kanban`, 'kanbanVisited'),
          disabled: !projectCreated || !projectPath,
          disabledReason: needsProjectReason,
        },
      },
      {
        id: 'todo-view',
        group: 'work',
        icon: ListTodo,
        title: t('onboarding.steps.openTodo.title'),
        description: t('onboarding.steps.openTodo.description'),
        completed: completedLearningSteps.includes('todoVisited'),
        locked: !projectCreated || !projectPath,
        explore: true,
        lockReason: needsProjectReason,
        action: {
          label: t('onboarding.steps.openTodo.cta'),
          onClick: () => projectPath && navigateTo(`${projectPath}?view=todo`, 'todoVisited'),
          disabled: !projectCreated || !projectPath,
          disabledReason: needsProjectReason,
        },
      },
      {
        id: 'calendar-view',
        group: 'work',
        icon: CalendarDays,
        title: t('onboarding.steps.openCalendar.title'),
        description: t('onboarding.steps.openCalendar.description'),
        completed: completedLearningSteps.includes('calendarVisited'),
        locked: !projectCreated || !projectPath,
        explore: true,
        lockReason: needsProjectReason,
        action: {
          label: t('onboarding.steps.openCalendar.cta'),
          onClick: () => projectPath && navigateTo(`${projectPath}?view=calendar`, 'calendarVisited'),
          disabled: !projectCreated || !projectPath,
          disabledReason: needsProjectReason,
        },
      },
      {
        id: 'notifications-activity',
        group: 'collaboration',
        icon: Bell,
        title: t('onboarding.steps.notifications.title'),
        description: t('onboarding.steps.notifications.description'),
        completed:
          completedLearningSteps.includes('notificationsVisited') ||
          completedLearningSteps.includes('activityVisited') ||
          unreadNotificationCount > 0,
        explore: true,
        action: {
          label: t('onboarding.steps.notifications.ctaNotifications'),
          onClick: () => navigateTo('/notifications', 'notificationsVisited'),
        },
        secondaryAction: {
          label: t('onboarding.steps.notifications.ctaActivity'),
          onClick: () => projectPath && navigateTo(`${projectPath}?view=activity`, 'activityVisited'),
          disabled: !projectCreated || !projectPath,
          disabledReason: needsProjectReason,
        },
      },
    ],
    [
      completedLearningSteps,
      goalCreated,
      invitedMember,
      needsProjectReason,
      needsWorkspaceReason,
      projectCreated,
      projectPath,
      taskCreated,
      t,
      unreadNotificationCount,
      workspaceCreated,
      workspaceId,
      workspacePath,
      navigateTo,
    ],
  )

  const completedCount = steps.filter((step) => step.completed).length
  const progressValue = steps.length > 0 ? (completedCount / steps.length) * 100 : 0
  const visibleSteps = useMemo(() => {
    if (showAll) {
      return steps
    }
    const active = steps.filter((step) => !step.completed && !step.locked)
    const locked = steps.filter((step) => !step.completed && step.locked)
    const completed = steps.filter((step) => step.completed)
    return [...active, ...locked, ...completed].slice(0, 4)
  }, [showAll, steps])

  if (state.dismissedDashboardHub) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed bg-card/70 px-4 py-3 text-sm shadow-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Rocket className="h-4 w-4 text-primary" />
          <span>{t('onboarding.dashboard.dismissedText')}</span>
        </div>
        <Button size="sm" variant="outline" onClick={restore}>
          <Sparkles className="mr-2 h-4 w-4" />
          {t('onboarding.actions.restore')}
        </Button>
      </div>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b bg-gradient-to-br from-primary/8 via-card to-emerald-500/8 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Rocket className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-normal text-foreground sm:text-2xl">
                  {t('onboarding.dashboard.title')}
                </h2>
                <Badge variant="secondary" className="rounded-full">
                  {t('onboarding.dashboard.progressLabel', {
                    completed: completedCount,
                    total: steps.length,
                  })}
                </Badge>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                {t('onboarding.dashboard.description')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCollapsed(!collapsedDashboardHub)}>
              {collapsedDashboardHub ? (
                <ChevronDown className="mr-2 h-4 w-4" />
              ) : (
                <ChevronUp className="mr-2 h-4 w-4" />
              )}
              {collapsedDashboardHub ? t('onboarding.actions.expand') : t('onboarding.actions.collapse')}
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={dismiss}>
              <X className="h-4 w-4" />
              <span className="sr-only">{t('onboarding.actions.hide')}</span>
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <Progress value={progressValue} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {t('onboarding.dashboard.nextHint', {
              remaining: Math.max(steps.length - completedCount, 0),
            })}
          </p>
        </div>
      </div>

      {!collapsedDashboardHub ? (
        <div className="space-y-5 p-4 sm:p-6">
          {loading ? <OnboardingSkeleton /> : null}
          {!loading ? (
            <>
              {showAll ? (
                <div className="space-y-6">
                  {groupOrder.map((group) => (
                    <div key={group} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CircleDot className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">{t(`onboarding.groups.${group}`)}</h3>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {steps
                          .filter((step) => step.group === group)
                          .map((step) => (
                            <OnboardingStepPanel key={step.id} step={step} />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {visibleSteps.map((step) => (
                    <OnboardingStepPanel key={step.id} step={step} compact />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs leading-5 text-muted-foreground">{t('onboarding.dashboard.dataHint')}</p>
                <Button variant="outline" size="sm" onClick={() => setShowAll((current) => !current)}>
                  {showAll ? <Eye className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {showAll ? t('onboarding.actions.showLess') : t('onboarding.actions.showAll')}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function OnboardingStepPanel({ step, compact = false }: { step: OnboardingStep; compact?: boolean }) {
  const status = getStatus(step)
  const Icon = step.completed ? CheckCircle2 : step.locked ? Lock : step.icon

  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-xl border bg-background/80 p-4 transition-colors',
        step.completed && 'border-emerald-500/30 bg-emerald-500/5',
        step.locked && 'bg-muted/35 text-muted-foreground',
        !step.completed && !step.locked && step.recommended && 'border-amber-500/35 bg-amber-500/5',
        !step.completed && !step.locked && step.explore && 'border-sky-500/25 bg-sky-500/5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15',
            step.completed && 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
            step.locked && 'bg-muted text-muted-foreground ring-border',
            !step.completed &&
              !step.locked &&
              step.recommended &&
              'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
            !step.completed &&
              !step.locked &&
              step.explore &&
              'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400',
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <StatusBadge status={status} />
      </div>

      <div className={cn('mt-4 flex-1 space-y-2', compact && 'space-y-1.5')}>
        <h4 className="text-sm font-semibold leading-5 text-foreground">{step.title}</h4>
        <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
        {step.locked && step.lockReason ? (
          <p className="text-xs font-medium text-muted-foreground">{step.lockReason}</p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={step.completed ? 'outline' : 'default'}
          onClick={step.action.onClick}
          disabled={step.action.disabled}
          title={step.action.disabled ? step.action.disabledReason : undefined}
        >
          {step.action.label}
        </Button>
        {step.secondaryAction ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={step.secondaryAction.onClick}
            disabled={step.secondaryAction.disabled}
            title={step.secondaryAction.disabled ? step.secondaryAction.disabledReason : undefined}
          >
            {step.secondaryAction.label}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: OnboardingStatus }) {
  const { t } = useTranslation()
  const variants: Record<OnboardingStatus, string> = {
    completed: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    recommended: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    locked: 'border-border bg-muted text-muted-foreground',
    explore: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    next: 'border-primary/20 bg-primary/10 text-primary',
  }
  return (
    <Badge variant="outline" className={cn('rounded-full text-[11px]', variants[status])}>
      {t(`onboarding.status.${status}`)}
    </Badge>
  )
}

function getStatus(step: OnboardingStep): OnboardingStatus {
  if (step.completed) {
    return 'completed'
  }
  if (step.locked) {
    return 'locked'
  }
  if (step.recommended) {
    return 'recommended'
  }
  if (step.explore) {
    return 'explore'
  }
  return 'next'
}

function OnboardingSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-background/80 p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-4 w-4/5" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-3/4" />
          <Skeleton className="mt-4 h-9 w-28" />
        </div>
      ))}
    </div>
  )
}
