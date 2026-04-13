import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  Check,
  CircleAlert,
  CircleDashed,
  LoaderCircle,
  RefreshCw,
  Rocket,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Textarea } from '@/components/ui/textarea'
import { useUiStore } from '@/app/store/ui-store'
import { goalApi } from '@/lib/api/modules/goal-api'
import { projectApi } from '@/lib/api/modules/project-api'
import { projectAssistantApi } from '@/lib/api/modules/project-assistant-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { queryKeys } from '@/lib/api/query-keys'
import { env } from '@/lib/constants/env'
import { cn } from '@/lib/utils/cn'
import { CursorAnimationOverlay, buildAnimationItems, type CursorAnimationItem } from '@/components/shared/cursor-animation-overlay'
import type {
  ProjectAssistantActionType,
  ProjectAssistantApplyResponse,
  ProjectAssistantPlannedAction,
  ProjectAssistantPreviewResponse,
  ProjectAssistantStatus,
} from '@/types/project-assistant'

// ─── Constants ────────────────────────────────────────────────────────────────

const PROMPT_SUGGESTION_KEYS = [
  'ai.suggestion1',
  'ai.suggestion2',
  'ai.suggestion3',
] as const

const ACTION_LABEL_KEYS: Record<ProjectAssistantActionType, string> = {
  UPDATE_PROJECT: 'ai.actionUpdateProject',
  CREATE_GOAL: 'ai.actionCreateGoal',
  UPDATE_GOAL: 'ai.actionUpdateGoal',
  CREATE_TASK: 'ai.actionCreateTask',
  UPDATE_TASK: 'ai.actionUpdateTask',
  MOVE_TASK: 'ai.actionMoveTask',
  UPDATE_TASK_COMPLETION: 'ai.actionCompleteTask',
  CREATE_TASK_SCHEDULE: 'ai.actionCreateSchedule',
  UPDATE_TASK_SCHEDULE: 'ai.actionUpdateSchedule',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GlobalAIAssistant() {
  const { t } = useTranslation()
  const selectedProjectId = useUiStore((state) => state.selectedProjectId)
  const selectedWorkspaceId = useUiStore((state) => state.selectedWorkspaceId)
  const open = useUiStore((state) => state.aiAssistantOpen)
  const aiAssistantPromptSeed = useUiStore((state) => state.aiAssistantPromptSeed)
  const openAIAssistant = useUiStore((state) => state.openAIAssistant)
  const closeAIAssistant = useUiStore((state) => state.closeAIAssistant)
  const clearAIAssistantPromptSeed = useUiStore((state) => state.clearAIAssistantPromptSeed)
  const queryClient = useQueryClient()

  const [prompt, setPrompt] = useState('')
  const [preview, setPreview] = useState<ProjectAssistantPreviewResponse | null>(null)
  const [applyResult, setApplyResult] = useState<ProjectAssistantApplyResponse | null>(null)
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([])
  const [appliedActionIds, setAppliedActionIds] = useState<string[]>([])
  const [cursorItems, setCursorItems] = useState<CursorAnimationItem[]>([])
  const [showCursorAnim, setShowCursorAnim] = useState(false)

  const projectId = selectedProjectId
  const workspaceId = selectedWorkspaceId

  // ── Queries ──
  const statusQuery = useQuery({
    queryKey: queryKeys.projectAssistant.status,
    queryFn: projectAssistantApi.status,
    enabled: env.projectAssistantEnabled,
    staleTime: 30_000,
  })

  const projectQuery = useQuery({
    queryKey: projectId ? queryKeys.projects.detail(projectId) : ['project-none'],
    queryFn: () => projectApi.detail(projectId!),
    enabled: open && Boolean(projectId),
    staleTime: 60_000,
  })

  const goalsQuery = useQuery({
    queryKey: projectId ? queryKeys.goals.byProject(projectId, 1, 1) : ['goals-none'],
    queryFn: () => goalApi.listByProject(projectId!, { page: 1, size: 1 }),
    enabled: open && Boolean(projectId),
    staleTime: 60_000,
  })

  const tasksQuery = useQuery({
    queryKey: projectId ? queryKeys.tasks.byProject(projectId, 1, 1) : ['tasks-none'],
    queryFn: () => taskApi.listByProject(projectId!, { page: 1, size: 1 }),
    enabled: open && Boolean(projectId),
    staleTime: 60_000,
  })

  const projectName = projectQuery.data?.name ?? (projectId ? t('ai.projectFallback', { id: projectId }) : '')
  const goalTotal = goalsQuery.data?.meta.totalElements ?? 0
  const taskTotal = tasksQuery.data?.meta.totalElements ?? 0

  const resetAssistantState = useCallback(
    (nextPrompt = t(PROMPT_SUGGESTION_KEYS[0])) => {
      setPrompt(nextPrompt)
      setPreview(null)
      setApplyResult(null)
      setSelectedActionIds([])
      setAppliedActionIds([])
      setCursorItems([])
      setShowCursorAnim(false)
    },
    [t],
  )

  // ── Mutations ──
  const previewMutation = useMutation({
    mutationFn: (nextPrompt: string) =>
      projectAssistantApi.preview(projectId!, { prompt: nextPrompt }),
    onSuccess: (response) => {
      setPreview(response)
      setApplyResult(null)
      setAppliedActionIds([])
      setSelectedActionIds(
        response.plan.actions
          .filter((action) => action.executable)
          .map((action) => action.actionId),
      )
      toast.success(t('ai.previewCreated'))
    },
    onError: (error: Error) => {
      toast.error(t('ai.previewFailed'), { description: error.message })
    },
  })

  const applyMutation = useMutation({
    mutationFn: () => {
      if (!preview?.plan) throw new Error(t('ai.needPreviewFirst'))
      if (selectedActionIds.length === 0)
        throw new Error(t('ai.selectAtLeastOne'))
      return projectAssistantApi.apply(projectId!, {
        plan: preview.plan,
        actionIds: selectedActionIds,
      })
    },
    onSuccess: async (response) => {
      setApplyResult(response)
      setAppliedActionIds((current) => [...new Set([...current, ...selectedActionIds])])
      setSelectedActionIds([])

      // Build cursor animation items from applied actions
      const animItems = buildAnimationItems(response.results, preview?.plan.actions ?? [])
      if (animItems.length > 0) {
        setCursorItems(animItems)
        setShowCursorAnim(true)
        void invalidateProjectCaches()
        return
      }

      // No animatable actions → invalidate immediately
      await invalidateProjectCaches()
      toast.success(t('ai.applySuccess'))
    },
    onError: (error: Error) => {
      toast.error(t('ai.applyFailed'), { description: error.message })
    },
  })

  // ── Reset on project change ──
  useEffect(() => {
    resetAssistantState()
  }, [projectId, resetAssistantState])

  useEffect(() => {
    if (!aiAssistantPromptSeed) {
      return
    }

    resetAssistantState(aiAssistantPromptSeed)
    clearAIAssistantPromptSeed()
  }, [aiAssistantPromptSeed, clearAIAssistantPromptSeed, resetAssistantState])

  // ── Derived state ──
  const status = statusQuery.data
  const promptLimit = 4000
  const promptLength = prompt.trim().length

  const selectableActionIds = useMemo(
    () =>
      preview?.plan.actions
        .filter((action) => action.executable && !appliedActionIds.includes(action.actionId))
        .map((action) => action.actionId) ?? [],
    [appliedActionIds, preview?.plan.actions],
  )

  const executableCount = useMemo(
    () => preview?.plan.actions.filter((action) => action.executable).length ?? 0,
    [preview?.plan.actions],
  )

  const blockedCount = useMemo(
    () => preview?.plan.actions.filter((action) => !action.executable).length ?? 0,
    [preview?.plan.actions],
  )

  const canPreview =
    env.projectAssistantEnabled &&
    Boolean(projectId) &&
    Boolean(status?.enabled) &&
    Boolean(status?.ready) &&
    promptLength > 0 &&
    promptLength <= promptLimit

  const canApply =
    selectableActionIds.length > 0 && selectedActionIds.length > 0 && !applyMutation.isPending

  const statusTone = resolveStatusTone(status, statusQuery.error)
  const isReady = Boolean(status?.ready)
  const hasProject = Boolean(projectId)

  const invalidateProjectCaches = async () => {
    const invalidations: Promise<void>[] = [
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId!) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.myWork }),
      queryClient.invalidateQueries({
        predicate: (query) => {
          const [scope, relatedProjectId] = query.queryKey
          return scope === 'goals' && relatedProjectId === projectId
        },
      }),
      queryClient.invalidateQueries({
        predicate: (query) => {
          const [scope, resource, relatedProjectId] = query.queryKey
          return scope === 'tasks' && resource === 'project' && relatedProjectId === projectId
        },
      }),
      queryClient.invalidateQueries({
        predicate: (query) => {
          const [scope, calendarKey, resource, relatedProjectId] = query.queryKey
          return (
            scope === 'task-schedules' &&
            calendarKey === 'calendar' &&
            resource === 'project' &&
            relatedProjectId === projectId
          )
        },
      }),
    ]
    if (workspaceId) {
      invalidations.push(
        queryClient.invalidateQueries({
          predicate: (query) => {
            const [scope, resource, relatedWorkspaceId] = query.queryKey
            return scope === 'projects' && resource === 'workspace' && relatedWorkspaceId === workspaceId
          },
        }),
        queryClient.invalidateQueries({
          predicate: (query) => {
            const [scope, relatedWorkspaceId] = query.queryKey
            return scope === 'activity-logs' && relatedWorkspaceId === workspaceId
          },
        }),
        queryClient.invalidateQueries({
          predicate: (query) => {
            const [scope, calendarKey, resource, relatedWorkspaceId] = query.queryKey
            return (
              scope === 'task-schedules' &&
              calendarKey === 'calendar' &&
              resource === 'workspace' &&
              relatedWorkspaceId === workspaceId
            )
          },
        }),
      )
    }
    await Promise.all(invalidations)
  }

  const handleCursorAnimComplete = async () => {
    setShowCursorAnim(false)
    setCursorItems([])
    toast.success(t('ai.applySuccess'))
  }

  const handleSheetOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      return
    }

    resetAssistantState()
    closeAIAssistant()
  }

  const resetPreview = () => {
    setPreview(null)
    setApplyResult(null)
    setSelectedActionIds([])
    setAppliedActionIds([])
  }

  const toggleAction = (actionId: string) => {
    setSelectedActionIds((current) =>
      current.includes(actionId)
        ? current.filter((id) => id !== actionId)
        : [...current, actionId],
    )
  }

  const selectAllExecutable = () => setSelectedActionIds(selectableActionIds)

  const handlePreview = () => {
    if (!canPreview) return
    previewMutation.mutate(prompt.trim())
  }

  if (!env.projectAssistantEnabled) return null

  return (
    <TooltipProvider>
      {/* ── Floating trigger button ── */}
      <div className="fixed bottom-6 right-6 z-50">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => openAIAssistant()}
              className={cn(
                'group relative flex size-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-95',
                isReady && hasProject
                  ? 'bg-linear-to-br from-sky-500 to-indigo-600 text-white shadow-sky-500/40'
                  : 'border border-border/70 bg-card text-sky-600 shadow-black/15 dark:bg-slate-800 dark:text-sky-300',
              )}
              aria-label={t('ai.tooltip')}
            >
              {statusQuery.isLoading
                ? <LoaderCircle className="size-6 animate-spin" />
                : <Bot className="size-6" />
              }
              {/* Status dot */}
              <span
                className={cn(
                  'absolute right-1.5 top-1.5 size-2.5 rounded-full ring-2',
                  isReady && hasProject
                    ? 'bg-emerald-400 ring-white/30'
                    : 'bg-amber-400 ring-card dark:ring-slate-800',
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {!hasProject
              ? t('ai.tooltipNoProject')
              : isReady
              ? t('ai.tooltipReady', { project: projectName })
              : t('ai.tooltipNotReady')}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* ── Sheet panel ── */}
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-3xl">
          {/* Header */}
          <div className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.04),transparent)]">
            <SheetHeader className="gap-4 px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', statusTone.pillClassName)}>
                    {statusTone.icon}
                    {t(statusTone.shortLabelKey)}
                  </div>
                  {projectName && <Badge variant="secondary">{projectName}</Badge>}
                </div>
              </div>

              <div className="space-y-2">
                <SheetTitle className="flex items-center gap-2 text-xl">
                  <Bot className="size-5 text-primary" />
                  {t('ai.sheetTitle')}
                </SheetTitle>
                <SheetDescription className="max-w-2xl text-sm leading-6">
                  {t('ai.sheetDescription')}
                </SheetDescription>
              </div>

              {hasProject && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniStatCard label={t('ai.goalCount')} value={goalTotal} />
                  <MiniStatCard label={t('ai.taskCount')} value={taskTotal} />
                </div>
              )}
            </SheetHeader>
          </div>

          {/* Body */}
          <div className="flex min-h-0 flex-1 flex-col">
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-5 px-5 py-5">
                <StatusCard
                  status={status}
                  error={statusQuery.error}
                  hasProject={hasProject}
                />

                {/* Prompt form */}
                <Card className="border-border/70 bg-card/95 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <WandSparkles className="size-4 text-primary" />
                      {t('ai.promptTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-ai-prompt">{t('ai.promptLabel')}</Label>
                      <Textarea
                        id="project-ai-prompt"
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        placeholder={t('ai.promptPlaceholderLong')}
                        className="min-h-32 resize-y"
                        maxLength={promptLimit}
                      />
                      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>{t('ai.promptHint')}</span>
                        <span className={cn(promptLength > promptLimit && 'text-destructive')}>
                          {promptLength}/{promptLimit}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {PROMPT_SUGGESTION_KEYS.map((key) => (
                        <Button
                          key={key}
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => setPrompt(t(key))}
                          className="h-auto whitespace-normal text-left text-xs"
                        >
                          {t(key)}
                        </Button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        onClick={handlePreview}
                        disabled={!canPreview || previewMutation.isPending}
                      >
                        {previewMutation.isPending
                          ? <LoaderCircle className="size-4 animate-spin" />
                          : <Sparkles className="size-4" />
                        }
                        {t('ai.createPreview')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetPreview}
                        disabled={!preview && !applyResult}
                      >
                        <RefreshCw className="size-4" />
                        {t('ai.reset')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Preview plan */}
                {preview && (
                  <Card className="border-border/70 bg-card/95 shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="text-base">{t('ai.previewTitle')}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {preview.plan.summary ||
                              t('ai.previewFallbackSummary')}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">
                            {t('ai.itemsCount', { count: preview.plan.actions.length })}
                          </Badge>
                          <Badge variant="outline">{t('ai.executableCount', { count: executableCount })}</Badge>
                          {blockedCount > 0 && (
                            <Badge variant="destructive">{t('ai.needsReviewCount', { count: blockedCount })}</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {preview.plan.warnings.length > 0 && (
                        <div className="rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                          <div className="mb-2 flex items-center gap-2 font-medium">
                            <CircleAlert className="size-4" />
                            {t('ai.warningsTitle')}
                          </div>
                          <div className="space-y-1">
                            {preview.plan.warnings.map((warning) => (
                              <p key={warning}>{warning}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-muted/25 px-3 py-2 text-sm">
                        <div className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('ai.selectionStatus', { selected: selectedActionIds.length, total: selectableActionIds.length }) }} />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={selectAllExecutable}
                            disabled={selectableActionIds.length === 0}
                          >
                            {t('ai.selectAllValid')}
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => setSelectedActionIds([])}
                            disabled={selectedActionIds.length === 0}
                          >
                            {t('ai.deselectAllBtn')}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {preview.plan.actions.map((action) => {
                          const isApplied = appliedActionIds.includes(action.actionId)
                          const isSelectable =
                            Boolean(action.executable) && !isApplied
                          const isSelected = selectedActionIds.includes(action.actionId)
                          const detailChips = getActionDetailChips(action, t)

                          return (
                            <div
                              key={action.actionId}
                              className={cn(
                                'rounded-3xl border p-4 transition-colors',
                                isApplied &&
                                  'border-emerald-300/70 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10',
                                !isApplied &&
                                  isSelected &&
                                  'border-primary/50 bg-primary/5',
                                !isApplied &&
                                  !isSelected &&
                                  'border-border/70 bg-background/85',
                                !action.executable &&
                                  'border-amber-300/60 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10',
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  className="mt-1 size-4 rounded border-border text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                  checked={isSelected}
                                  disabled={!isSelectable || applyMutation.isPending}
                                  onChange={() => toggleAction(action.actionId)}
                                />

                                <div className="min-w-0 flex-1 space-y-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">
                                      {t(ACTION_LABEL_KEYS[action.actionType]) ?? action.actionType}
                                    </Badge>
                                    {action.order != null && (
                                      <Badge variant="secondary">{t('ai.stepLabel', { order: action.order })}</Badge>
                                    )}
                                    {isApplied && (
                                      <Badge variant="default">{t('ai.alreadyApplied')}</Badge>
                                    )}
                                    {!isApplied && action.executable && (
                                      <Badge variant="secondary">{t('ai.canApplyBadge')}</Badge>
                                    )}
                                    {!isApplied && !action.executable && (
                                      <Badge variant="destructive">{t('ai.needsReviewBadge')}</Badge>
                                    )}
                                  </div>

                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">
                                      {action.actionTitle ||
                                        t(ACTION_LABEL_KEYS[action.actionType]) ||
                                        action.actionType}
                                    </p>
                                    {action.rationale && (
                                      <p className="text-sm text-muted-foreground">
                                        {action.rationale}
                                      </p>
                                    )}
                                  </div>

                                  {detailChips.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {detailChips.map((chip) => (
                                        <Badge
                                          key={chip}
                                          variant="outline"
                                          className="bg-background/80"
                                        >
                                          {chip}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}

                                  {action.validationErrors.length > 0 && (
                                    <div className="space-y-1 rounded-2xl border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                                      {action.validationErrors.map((error) => (
                                        <p key={`${action.actionId}-${error}`}>{error}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Apply result */}
                {applyResult && (
                  <Card className="border-border/70 bg-card/95 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Check className="size-4 text-emerald-600 dark:text-emerald-300" />
                        {t('ai.applyResultTitle')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <MiniStatCard label={t('ai.requested')} value={applyResult.requestedCount} />
                        <MiniStatCard label={t('ai.appliedLabel')} value={applyResult.appliedCount} />
                        <MiniStatCard label={t('ai.warningsLabel')} value={applyResult.warnings.length} />
                      </div>

                      {applyResult.results.length > 0 && (
                        <div className="space-y-2">
                          {applyResult.results.map((result) => (
                            <div
                              key={`${result.actionId}-${result.outcome}`}
                              className="rounded-2xl border border-border/70 bg-background/80 px-3 py-3 text-sm"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">
                                  {t(ACTION_LABEL_KEYS[result.actionType]) ?? result.actionType}
                                </Badge>
                                <span className="font-medium text-foreground">
                                  {result.actionTitle || result.actionId}
                                </span>
                              </div>
                              {result.outcome && (
                                <p className="mt-2 text-muted-foreground">{result.outcome}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {applyResult.warnings.length > 0 && (
                        <div className="space-y-1 rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                          {applyResult.warnings.map((warning) => (
                            <p key={warning}>{warning}</p>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <SheetFooter className="border-t border-border/70 bg-background/95 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {t('ai.footerNote')}
                </div>
                <Button
                  type="button"
                  onClick={() => applyMutation.mutate()}
                  disabled={!canApply}
                >
                  {applyMutation.isPending
                    ? <LoaderCircle className="size-4 animate-spin" />
                    : <Rocket className="size-4" />
                  }
                  {t('ai.applySelectedBtn')}
                </Button>
              </div>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* Cursor animation overlay */}
      {showCursorAnim && cursorItems.length > 0 && (
        <CursorAnimationOverlay items={cursorItems} onComplete={handleCursorAnimComplete} />
      )}
    </TooltipProvider>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MiniStatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

function StatusCard({
  status,
  error,
  hasProject,
}: {
  status?: ProjectAssistantStatus
  error: unknown
  hasProject: boolean
}) {
  const { t } = useTranslation()
  const tone = resolveStatusTone(status, error)

  if (!hasProject) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="mt-0.5 rounded-full p-2 bg-muted">
            <CircleDashed className="size-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">{t('ai.noProject')}</p>
            <p className="text-sm text-muted-foreground">
              {t('ai.noProjectDesc')}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('border shadow-sm', tone.cardClassName)}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn('mt-0.5 rounded-full p-2', tone.iconWrapClassName)}>
          {tone.icon}
        </div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">{t(tone.titleKey)}</p>
          <p className="text-sm text-muted-foreground">{tone.description || t(tone.descriptionKey ?? '')}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveStatusTone(status?: ProjectAssistantStatus, error?: unknown) {
  if (error instanceof Error) {
    return {
      badgeVariant: 'destructive' as const,
      badgeLabel: 'Status error',
      shortLabelKey: 'ai.statusErrorShort',
      pillClassName: 'border-destructive/35 bg-destructive/5 text-destructive',
      titleKey: 'ai.statusErrorTitle',
      description: error.message,
      icon: <CircleAlert className="size-4 text-destructive" />,
      cardClassName: 'border-destructive/35 bg-destructive/5',
      iconWrapClassName: 'bg-destructive/10',
    }
  }

  if (!status?.enabled) {
    return {
      badgeVariant: 'outline' as const,
      badgeLabel: 'Disabled',
      shortLabelKey: 'ai.statusDisabledShort',
      pillClassName: 'border-border/60 bg-muted/50 text-muted-foreground',
      titleKey: 'ai.statusDisabledTitle',
      description: status?.message || undefined,
      descriptionKey: 'ai.statusDisabledDesc',
      icon: <CircleDashed className="size-4 text-muted-foreground" />,
      cardClassName: 'border-border/70 bg-card/95',
      iconWrapClassName: 'bg-muted',
    }
  }

  if (!status.ready) {
    return {
      badgeVariant: 'destructive' as const,
      badgeLabel: 'Needs config',
      shortLabelKey: 'ai.statusNeedsConfigShort',
      pillClassName: 'border-amber-300/60 bg-amber-50/80 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
      titleKey: 'ai.statusNotReadyTitle',
      description: status.message || undefined,
      descriptionKey: 'ai.statusNotReadyDesc',
      icon: <CircleAlert className="size-4 text-amber-600 dark:text-amber-300" />,
      cardClassName:
        'border-amber-300/60 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10',
      iconWrapClassName: 'bg-amber-100 dark:bg-amber-500/20',
    }
  }

  return {
    badgeVariant: 'secondary' as const,
    badgeLabel: 'Ready',
    shortLabelKey: 'ai.statusReadyShort',
    pillClassName: 'border-emerald-300/60 bg-emerald-50/80 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
    titleKey: 'ai.statusReadyTitle',
    description: status.message || undefined,
    descriptionKey: 'ai.statusReadyDesc',
    icon: <Check className="size-4 text-emerald-600 dark:text-emerald-300" />,
    cardClassName:
      'border-emerald-300/60 bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-emerald-500/10',
    iconWrapClassName: 'bg-emerald-100 dark:bg-emerald-500/20',
  }
}

function getActionDetailChips(
  action: ProjectAssistantPlannedAction,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const chips: string[] = []

  if (action.name) chips.push(t('ai.chipName', { value: action.name }))
  if (action.title) chips.push(t('ai.chipTitle', { value: action.title }))
  if (action.goalId != null) chips.push(t('ai.chipGoalRef', { id: action.goalId }))
  if (action.taskId != null) chips.push(t('ai.chipTaskRef', { id: action.taskId }))
  if (action.scheduleId != null) chips.push(t('ai.chipScheduleRef', { id: action.scheduleId }))
  if (action.projectStatus) chips.push(t('ai.chipProjectStatus', { value: action.projectStatus }))
  if (action.goalType) chips.push(t('ai.chipGoalType', { value: action.goalType }))
  if (action.goalStatus) chips.push(t('ai.chipGoalStatus', { value: action.goalStatus }))
  if (action.progressPercent != null) chips.push(t('ai.chipProgress', { value: action.progressPercent }))
  if (action.priority) chips.push(t('ai.chipPriority', { value: action.priority }))
  if (action.statusCode) chips.push(t('ai.chipStatusCode', { value: action.statusCode }))
  if (action.targetPosition != null) chips.push(t('ai.chipPosition', { value: action.targetPosition }))
  if (action.clearGoal) chips.push(t('ai.chipClearGoal'))
  if (action.estimatedMinutes != null) chips.push(t('ai.chipMinutes', { value: action.estimatedMinutes }))
  if (action.completed != null) chips.push(action.completed ? t('ai.chipCompleted') : t('ai.chipNotCompleted'))
  if (action.dueDate) chips.push(t('ai.chipDueDate', { value: formatDateTime(action.dueDate) }))
  if (action.scheduledStart && action.scheduledEnd) {
    chips.push(
      t('ai.chipScheduledRange', {
        start: formatDateTime(action.scheduledStart),
        end: formatDateTime(action.scheduledEnd),
      }),
    )
  }

  return chips
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}