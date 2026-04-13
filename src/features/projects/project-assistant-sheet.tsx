import { useEffect, useMemo, useState } from 'react'
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
import type {
  ProjectAssistantActionType,
  ProjectAssistantApplyResponse,
  ProjectAssistantPlannedAction,
  ProjectAssistantPreviewResponse,
  ProjectAssistantStatus,
} from '@/types/project-assistant'

// ─── Constants ────────────────────────────────────────────────────────────────

const PROMPT_SUGGESTIONS = [
  'Phân rã backlog hiện tại thành các bước thực thi ưu tiên trong 7 ngày tới.',
  'Tìm blocker và dependency quan trọng nhất rồi đề xuất task hoặc cập nhật cần làm ngay.',
  'Rà soát goals hiện tại và đề xuất kế hoạch ngắn gọn để đẩy nhanh tiến độ.',
]

const ACTION_LABELS: Record<ProjectAssistantActionType, string> = {
  UPDATE_PROJECT: 'Cập nhật project',
  CREATE_GOAL: 'Tạo goal',
  UPDATE_GOAL: 'Cập nhật goal',
  CREATE_TASK: 'Tạo task',
  UPDATE_TASK: 'Cập nhật task',
  MOVE_TASK: 'Di chuyển task',
  UPDATE_TASK_COMPLETION: 'Hoàn thành task',
  CREATE_TASK_SCHEDULE: 'Tạo lịch task',
  UPDATE_TASK_SCHEDULE: 'Cập nhật lịch task',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GlobalAIAssistant() {
  const selectedProjectId = useUiStore((state) => state.selectedProjectId)
  const selectedWorkspaceId = useUiStore((state) => state.selectedWorkspaceId)
  const open = useUiStore((state) => state.aiAssistantOpen)
  const aiAssistantPromptSeed = useUiStore((state) => state.aiAssistantPromptSeed)
  const openAIAssistant = useUiStore((state) => state.openAIAssistant)
  const closeAIAssistant = useUiStore((state) => state.closeAIAssistant)
  const clearAIAssistantPromptSeed = useUiStore((state) => state.clearAIAssistantPromptSeed)
  const queryClient = useQueryClient()

  const [prompt, setPrompt] = useState(PROMPT_SUGGESTIONS[0])
  const [preview, setPreview] = useState<ProjectAssistantPreviewResponse | null>(null)
  const [applyResult, setApplyResult] = useState<ProjectAssistantApplyResponse | null>(null)
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([])
  const [appliedActionIds, setAppliedActionIds] = useState<string[]>([])

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

  const projectName = projectQuery.data?.name ?? (projectId ? `Project #${projectId}` : '')
  const goalTotal = goalsQuery.data?.meta.totalElements ?? 0
  const taskTotal = tasksQuery.data?.meta.totalElements ?? 0

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
      toast.success('AI đã tạo preview kế hoạch')
    },
    onError: (error: Error) => {
      toast.error('Không tạo được preview AI', { description: error.message })
    },
  })

  const applyMutation = useMutation({
    mutationFn: () => {
      if (!preview?.plan) throw new Error('Bạn cần tạo preview trước khi apply.')
      if (selectedActionIds.length === 0)
        throw new Error('Hãy chọn ít nhất một action hợp lệ để apply.')
      return projectAssistantApi.apply(projectId!, {
        plan: preview.plan,
        actionIds: selectedActionIds,
      })
    },
    onSuccess: async (response) => {
      setApplyResult(response)
      setAppliedActionIds((current) => [...new Set([...current, ...selectedActionIds])])
      setSelectedActionIds([])
      const invalidations: Promise<void>[] = [
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId!) }),
        queryClient.invalidateQueries({ queryKey: ['goals', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] }),
        queryClient.invalidateQueries({
          queryKey: ['task-schedules', 'calendar', 'project', projectId],
        }),
      ]
      if (workspaceId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: ['activity-logs', workspaceId] }),
        )
      }
      await Promise.all(invalidations)
      toast.success('Đã apply kế hoạch AI vào project')
    },
    onError: (error: Error) => {
      toast.error('Không apply được kế hoạch AI', { description: error.message })
    },
  })

  // ── Reset on project change ──
  useEffect(() => {
    setPreview(null)
    setApplyResult(null)
    setSelectedActionIds([])
    setAppliedActionIds([])
  }, [projectId])

  useEffect(() => {
    if (!aiAssistantPromptSeed) {
      return
    }

    setPrompt(aiAssistantPromptSeed)
    setPreview(null)
    setApplyResult(null)
    setSelectedActionIds([])
    setAppliedActionIds([])
    clearAIAssistantPromptSeed()
  }, [aiAssistantPromptSeed, clearAIAssistantPromptSeed])

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
                'group relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-1 transition-all duration-200 hover:scale-105 active:scale-95',
                isReady && hasProject
                  ? 'bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.75))] ring-primary/30 hover:shadow-primary/25 hover:shadow-xl'
                  : 'bg-card ring-border hover:bg-muted',
              )}
              aria-label="Mở AI planning assistant"
            >
              {statusQuery.isLoading
                ? <LoaderCircle className="size-6 animate-spin text-primary" />
                : (
                    <Sparkles
                      className={cn(
                        'size-6',
                        isReady && hasProject ? 'text-primary-foreground' : 'text-muted-foreground',
                      )}
                    />
                  )
              }
              {/* Status dot */}
              <span
                className={cn(
                  'absolute right-1 top-1 size-3 rounded-full ring-2 ring-background',
                  isReady && hasProject ? 'bg-emerald-400' : 'bg-amber-400',
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {!hasProject
              ? 'Chọn một project để dùng AI planning assistant'
              : isReady
              ? `AI planning assistant · ${projectName}`
              : 'AI planning assistant · Chưa cấu hình'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* ── Sheet panel ── */}
      <Sheet open={open} onOpenChange={(nextOpen) => { if (!nextOpen) closeAIAssistant() }}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-3xl">
          {/* Header */}
          <div className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.04),transparent)]">
            <SheetHeader className="gap-4 px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', statusTone.pillClassName)}>
                    {statusTone.icon}
                    {statusTone.shortLabel}
                  </div>
                  {projectName && <Badge variant="secondary">{projectName}</Badge>}
                </div>
              </div>

              <div className="space-y-2">
                <SheetTitle className="flex items-center gap-2 text-xl">
                  <Bot className="size-5 text-primary" />
                  AI Breakdown & Planning
                </SheetTitle>
                <SheetDescription className="max-w-2xl text-sm leading-6">
                  Mô tả kết quả bạn muốn đạt được, AI sẽ đề xuất task, lịch và cập nhật phù hợp. Xem kỹ từng action rồi chỉ apply phần bạn thực sự muốn giữ.
                </SheetDescription>
              </div>

              {hasProject && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniStatCard label="Goals" value={goalTotal} />
                  <MiniStatCard label="Tasks" value={taskTotal} />
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
                      Tạo preview breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-ai-prompt">Bạn muốn AI giúp gì?</Label>
                      <Textarea
                        id="project-ai-prompt"
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        placeholder="Ví dụ: Phân rã task lớn thành các bước thực thi, tìm blocker chính, và đề xuất lịch làm việc trong tuần này."
                        className="min-h-32 resize-y"
                        maxLength={promptLimit}
                      />
                      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>Prompt tối đa {promptLimit} ký tự.</span>
                        <span className={cn(promptLength > promptLimit && 'text-destructive')}>
                          {promptLength}/{promptLimit}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {PROMPT_SUGGESTIONS.map((item) => (
                        <Button
                          key={item}
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => setPrompt(item)}
                          className="h-auto whitespace-normal text-left text-xs"
                        >
                          {item}
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
                        Tạo preview
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetPreview}
                        disabled={!preview && !applyResult}
                      >
                        <RefreshCw className="size-4" />
                        Reset
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
                          <CardTitle className="text-base">Preview plan</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {preview.plan.summary ||
                              'AI đã trả về một kế hoạch có cấu trúc cho project này.'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">
                            {preview.plan.actions.length} actions
                          </Badge>
                          <Badge variant="outline">{executableCount} executable</Badge>
                          {blockedCount > 0 && (
                            <Badge variant="destructive">{blockedCount} blocked</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {preview.plan.warnings.length > 0 && (
                        <div className="rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                          <div className="mb-2 flex items-center gap-2 font-medium">
                            <CircleAlert className="size-4" />
                            Cảnh báo từ AI / context
                          </div>
                          <div className="space-y-1">
                            {preview.plan.warnings.map((warning) => (
                              <p key={warning}>{warning}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-muted/25 px-3 py-2 text-sm">
                        <div className="text-muted-foreground">
                          Đang chọn{' '}
                          <span className="font-semibold text-foreground">
                            {selectedActionIds.length}
                          </span>{' '}
                          / {selectableActionIds.length} action có thể apply.
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={selectAllExecutable}
                            disabled={selectableActionIds.length === 0}
                          >
                            Chọn hết executable
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => setSelectedActionIds([])}
                            disabled={selectedActionIds.length === 0}
                          >
                            Bỏ chọn
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {preview.plan.actions.map((action) => {
                          const isApplied = appliedActionIds.includes(action.actionId)
                          const isSelectable =
                            Boolean(action.executable) && !isApplied
                          const isSelected = selectedActionIds.includes(action.actionId)
                          const detailChips = getActionDetailChips(action)

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
                                      {ACTION_LABELS[action.actionType] ?? action.actionType}
                                    </Badge>
                                    {action.order != null && (
                                      <Badge variant="secondary">Bước {action.order}</Badge>
                                    )}
                                    {isApplied && (
                                      <Badge variant="default">Đã apply</Badge>
                                    )}
                                    {!isApplied && action.executable && (
                                      <Badge variant="secondary">Có thể apply</Badge>
                                    )}
                                    {!isApplied && !action.executable && (
                                      <Badge variant="destructive">Cần xem lại</Badge>
                                    )}
                                  </div>

                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">
                                      {action.actionTitle ||
                                        ACTION_LABELS[action.actionType] ||
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
                        Kết quả apply
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <MiniStatCard label="Requested" value={applyResult.requestedCount} />
                        <MiniStatCard label="Applied" value={applyResult.appliedCount} />
                        <MiniStatCard label="Warnings" value={applyResult.warnings.length} />
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
                                  {ACTION_LABELS[result.actionType] ?? result.actionType}
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
                  Bạn kiểm soát hoàn toàn — chỉ những thay đổi bạn chọn mới được áp dụng vào project.
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
                  Apply action đã chọn
                </Button>
              </div>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
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
  const tone = resolveStatusTone(status, error)

  if (!hasProject) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="mt-0.5 rounded-full p-2 bg-muted">
            <CircleDashed className="size-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">Chưa có project được chọn</p>
            <p className="text-sm text-muted-foreground">
              Mở một project từ sidebar để dùng AI planning assistant với đầy đủ context.
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
          <p className="font-medium text-foreground">{tone.title}</p>
          <p className="text-sm text-muted-foreground">{tone.description}</p>
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
      shortLabel: 'Lỗi kết nối',
      pillClassName: 'border-destructive/35 bg-destructive/5 text-destructive',
      title: 'Không kiểm tra được trạng thái AI planning assistant',
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
      shortLabel: 'Đã tắt',
      pillClassName: 'border-border/60 bg-muted/50 text-muted-foreground',
      title: 'AI planning assistant đang tắt ở backend',
      description:
        status?.message || 'Bật PROJECT_ASSISTANT_ENABLED và cấu hình Gemini để sử dụng.',
      icon: <CircleDashed className="size-4 text-muted-foreground" />,
      cardClassName: 'border-border/70 bg-card/95',
      iconWrapClassName: 'bg-muted',
    }
  }

  if (!status.ready) {
    return {
      badgeVariant: 'destructive' as const,
      badgeLabel: 'Needs config',
      shortLabel: 'Chưa cấu hình',
      pillClassName: 'border-amber-300/60 bg-amber-50/80 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
      title: 'AI planning assistant chưa sẵn sàng',
      description:
        status.message || 'Kiểm tra lại PROJECT_ASSISTANT_GOOGLE_* trong env backend.',
      icon: <CircleAlert className="size-4 text-amber-600 dark:text-amber-300" />,
      cardClassName:
        'border-amber-300/60 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10',
      iconWrapClassName: 'bg-amber-100 dark:bg-amber-500/20',
    }
  }

  return {
    badgeVariant: 'secondary' as const,
    badgeLabel: 'Ready',
    shortLabel: 'Sẵn sàng',
    pillClassName: 'border-emerald-300/60 bg-emerald-50/80 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
    title: 'AI planning assistant sẵn sàng tạo plan',
    description:
      status.message || 'Bạn có thể preview và apply từng action một cách an toàn.',
    icon: <Check className="size-4 text-emerald-600 dark:text-emerald-300" />,
    cardClassName:
      'border-emerald-300/60 bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-emerald-500/10',
    iconWrapClassName: 'bg-emerald-100 dark:bg-emerald-500/20',
  }
}

function getActionDetailChips(action: ProjectAssistantPlannedAction) {
  const chips: string[] = []

  if (action.name) chips.push(`Tên: ${action.name}`)
  if (action.title) chips.push(`Tiêu đề: ${action.title}`)
  if (action.goalId != null) chips.push(`Goal #${action.goalId}`)
  if (action.taskId != null) chips.push(`Task #${action.taskId}`)
  if (action.scheduleId != null) chips.push(`Schedule #${action.scheduleId}`)
  if (action.projectStatus) chips.push(`Project ${action.projectStatus}`)
  if (action.goalType) chips.push(`Loại goal: ${action.goalType}`)
  if (action.goalStatus) chips.push(`Trạng thái goal: ${action.goalStatus}`)
  if (action.progressPercent != null) chips.push(`Tiến độ ${action.progressPercent}%`)
  if (action.priority) chips.push(`Ưu tiên: ${action.priority}`)
  if (action.statusCode) chips.push(`Status: ${action.statusCode}`)
  if (action.targetPosition != null) chips.push(`Vị trí #${action.targetPosition}`)
  if (action.clearGoal) chips.push('Xóa goal hiện tại')
  if (action.estimatedMinutes != null) chips.push(`${action.estimatedMinutes} phút`)
  if (action.completed != null) chips.push(action.completed ? 'Đánh dấu hoàn thành' : 'Đánh dấu chưa xong')
  if (action.dueDate) chips.push(`Due: ${formatDateTime(action.dueDate)}`)
  if (action.scheduledStart && action.scheduledEnd) {
    chips.push(`${formatDateTime(action.scheduledStart)} → ${formatDateTime(action.scheduledEnd)}`)
  }

  return chips
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}