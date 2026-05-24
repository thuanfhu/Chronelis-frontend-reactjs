import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit3, Loader2, Palette, Plus, Search, Tags, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { goalApi } from '@/lib/api/modules/goal-api'
import { taskTypeApi, type CreateTaskTypePayload, type UpdateTaskTypePayload } from '@/lib/api/modules/task-type-api'
import { queryKeys } from '@/lib/api/query-keys'
import { TASK_TYPE_ICON_OPTIONS, resolveTaskTypeIcon } from '@/lib/task-types/task-type-icons'
import { cn } from '@/lib/utils'
import type { TaskType } from '@/types/domain'

interface ProjectTaskTypesTabProps {
  workspaceId: number
  projectId: number
  isOwnerOrManager: boolean
}

interface TaskTypeFormState {
  name: string
  description: string
  color: string
  icon: string
  goalId: string
}

const DEFAULT_FORM: TaskTypeFormState = {
  name: '',
  description: '',
  color: '#3B82F6',
  icon: 'tag',
  goalId: '__project',
}

const COLOR_PRESETS = ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#64748B']

function isValidHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
}

export function ProjectTaskTypesTab({ workspaceId, projectId, isOwnerOrManager }: ProjectTaskTypesTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTaskType, setEditingTaskType] = useState<TaskType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TaskType | null>(null)
  const [form, setForm] = useState<TaskTypeFormState>(DEFAULT_FORM)

  const taskTypesQuery = useQuery({
    queryKey: queryKeys.taskTypes.byProject(projectId),
    queryFn: () => taskTypeApi.listByProject(projectId),
    enabled: Number.isFinite(projectId) && projectId > 0,
  })

  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.byProject(projectId, 1, 100),
    queryFn: () => goalApi.listByProject(projectId, { page: 1, size: 100 }),
    enabled: Number.isFinite(projectId) && projectId > 0,
  })

  const taskTypes = taskTypesQuery.data ?? []
  const goals = goalsQuery.data?.content ?? []

  const filteredTaskTypes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return taskTypes

    return taskTypes.filter((type) => {
      const goal = type.goalId ? goals.find((item) => item.id === type.goalId) : null
      return [type.name, type.description ?? '', type.icon ?? '', goal?.title ?? ''].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      )
    })
  }, [goals, query, taskTypes])

  const scopedCount = taskTypes.filter((type) => type.goalId).length

  const resetForm = () => {
    setForm(DEFAULT_FORM)
    setEditingTaskType(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (taskType: TaskType) => {
    setEditingTaskType(taskType)
    setForm({
      name: taskType.name,
      description: taskType.description ?? '',
      color: taskType.color ?? '#3B82F6',
      icon: taskType.icon ?? 'tag',
      goalId: taskType.goalId ? String(taskType.goalId) : '__project',
    })
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    resetForm()
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateTaskTypePayload) => taskTypeApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskTypes.byProject(projectId) })
      toast.success(t('taskTypes.toastCreateSuccess'))
      closeDialog()
    },
    onError: (error: Error) => toast.error(t('taskTypes.toastCreateError'), { description: error.message }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateTaskTypePayload }) => taskTypeApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskTypes.byProject(projectId) })
      toast.success(t('taskTypes.toastUpdateSuccess'))
      closeDialog()
    },
    onError: (error: Error) => toast.error(t('taskTypes.toastUpdateError'), { description: error.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => taskTypeApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskTypes.byProject(projectId) })
      toast.success(t('taskTypes.toastDeleteSuccess'))
      setDeleteTarget(null)
    },
    onError: (error: Error) => toast.error(t('taskTypes.toastDeleteError'), { description: error.message }),
  })

  const submitForm = () => {
    const name = form.name.trim()
    const description = form.description.trim()
    const color = form.color.trim().toUpperCase()

    if (!name) {
      toast.error(t('taskTypes.validationNameRequired'))
      return
    }

    if (!isValidHexColor(color)) {
      toast.error(t('taskTypes.validationColorInvalid'))
      return
    }

    const goalId = form.goalId === '__project' ? undefined : Number(form.goalId)

    if (editingTaskType) {
      updateMutation.mutate({
        id: editingTaskType.id,
        payload: {
          name,
          description: description || undefined,
          color,
          icon: form.icon,
          ...(goalId ? { goalId } : { clearGoal: true }),
        },
      })
      return
    }

    createMutation.mutate({
      workspaceId,
      projectId,
      name,
      description: description || undefined,
      color,
      icon: form.icon,
      goalId,
    })
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const SelectedIcon = resolveTaskTypeIcon(form.icon)

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label={t('taskTypes.total')} value={taskTypes.length} />
        <Metric label={t('taskTypes.scoped')} value={scopedCount} />
        <Metric label={t('taskTypes.global')} value={taskTypes.length - scopedCount} />
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Tags className="size-5" />
                </span>
                {t('taskTypes.title')}
              </CardTitle>
              <CardDescription>
                {t('taskTypes.description')}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('taskTypes.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            {isOwnerOrManager && (
              <Button className="w-full gap-2 sm:w-auto shrink-0" onClick={openCreateDialog}>
                <Plus className="size-4" />
                {t('taskTypes.create')}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {taskTypesQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('taskTypes.loading')}
            </div>
          ) : filteredTaskTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Tags className="size-7" />
              </div>
              <div>
                <p className="font-semibold">{t('taskTypes.emptyTitle')}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isOwnerOrManager
                    ? t('taskTypes.emptyDescManager')
                    : t('taskTypes.emptyDescMember')}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {filteredTaskTypes.map((type) => {
                const TypeIcon = resolveTaskTypeIcon(type.icon)
                const goal = type.goalId ? goals.find((item) => item.id === type.goalId) : null
                const goalLabel = goal ? goal.title : t('taskTypes.global')
                const color = type.color ?? '#3B82F6'

                return (
                  <div
                    key={type.id}
                    className="grid gap-4 p-4 transition-colors hover:bg-muted/25 md:grid-cols-[1fr_auto] md:items-center"
                  >
                    <div className="flex min-w-0 gap-4">
                      <div
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl border"
                        style={{ backgroundColor: `${color}18`, borderColor: `${color}55`, color }}
                      >
                        <TypeIcon className="size-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                          <h3 className="max-w-36 shrink-0 truncate font-semibold sm:max-w-52" title={type.name}>
                            {type.name}
                          </h3>
                          <Badge variant="outline" className="shrink-0 gap-1">
                            <Palette className="size-3" />
                            {color}
                          </Badge>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant={goal ? 'secondary' : 'outline'}
                                className="min-w-0 max-w-full flex-1 overflow-hidden sm:max-w-80 lg:max-w-96"
                                title={goalLabel}
                              >
                                <span className="truncate">{goalLabel}</span>
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-80 break-words">{goalLabel}</TooltipContent>
                          </Tooltip>
                        </div>
                        {type.description ? (
                          <p className="line-clamp-2 text-sm text-muted-foreground">{type.description}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground/70">{t('taskTypes.noDescription')}</p>
                        )}
                      </div>
                    </div>

                    {isOwnerOrManager && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                          onClick={() => openEditDialog(type)}
                        >
                          <Edit3 className="size-4" />
                          {t('taskTypes.edit')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(type)}
                        >
                          <Trash2 className="size-4" />
                          {t('taskTypes.delete')}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog()
          else setIsDialogOpen(true)
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTaskType ? t('taskTypes.dialogEditTitle') : t('taskTypes.dialogCreateTitle')}</DialogTitle>
            <DialogDescription>
              {t('taskTypes.dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="grid gap-2">
              <Label htmlFor="task-type-name">{t('taskTypes.nameLabel')}</Label>
              <Input
                id="task-type-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={t('taskTypes.namePlaceholder')}
                maxLength={100}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="task-type-description">{t('taskTypes.descLabel')}</Label>
              <Textarea
                id="task-type-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={t('taskTypes.descPlaceholder')}
                className="min-h-24"
                maxLength={2000}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t('taskTypes.colorLabel')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={form.color}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, color: event.target.value.toUpperCase() }))
                    }
                    className="h-10 w-14 cursor-pointer p-1"
                  />
                  <Input
                    value={form.color}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, color: event.target.value.toUpperCase() }))
                    }
                    className={cn(
                      'font-mono uppercase',
                      !isValidHexColor(form.color) && 'border-destructive focus-visible:ring-destructive',
                    )}
                    maxLength={7}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        'size-6 rounded-full border-2 border-background ring-1 ring-border transition-transform hover:scale-110',
                        form.color === color && 'ring-2 ring-primary',
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setForm((current) => ({ ...current, color }))}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>{t('taskTypes.iconLabel')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {TASK_TYPE_ICON_OPTIONS.map((option) => {
                    const Icon = option.icon
                    const active = form.icon === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors',
                          active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted',
                        )}
                        onClick={() => setForm((current) => ({ ...current, icon: option.value }))}
                      >
                        <Icon className="size-4" />
                        <span className="truncate">{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>{t('taskTypes.goalScopeLabel')}</Label>
              <Select
                value={form.goalId}
                onValueChange={(value) => setForm((current) => ({ ...current, goalId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('taskTypes.goalScopePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__project">{t('taskTypes.goalScopeGlobal')}</SelectItem>
                  {goals.map((goal) => (
                    <SelectItem key={goal.id} value={String(goal.id)}>
                      {goal.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('taskTypes.preview')}</p>
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold"
                style={{ backgroundColor: `${form.color}18`, borderColor: `${form.color}55`, color: form.color }}
              >
                <SelectedIcon className="size-4" />
                {form.name.trim() || t('taskTypes.defaultNamePreview')}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              {t('taskTypes.cancel')}
            </Button>
            <Button onClick={submitForm} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {t('taskTypes.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={deleteTarget != null}
        title={t('taskTypes.deleteTitle')}
        description={
          <>
            {t('taskTypes.deleteDesc1')} <strong>{deleteTarget?.name}</strong> {t('taskTypes.deleteDesc2')}
          </>
        }
        confirmText={t('taskTypes.deleteConfirm')}
        confirmVariant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}
