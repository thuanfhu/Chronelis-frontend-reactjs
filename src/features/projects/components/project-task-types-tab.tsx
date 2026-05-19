import { useMemo, useState } from 'react'
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
      return [
        type.name,
        type.description ?? '',
        type.icon ?? '',
        goal?.title ?? '',
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
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
      toast.success('Đã tạo task type')
      closeDialog()
    },
    onError: (error: Error) => toast.error('Không thể tạo task type', { description: error.message }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateTaskTypePayload }) => taskTypeApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskTypes.byProject(projectId) })
      toast.success('Đã cập nhật task type')
      closeDialog()
    },
    onError: (error: Error) => toast.error('Không thể cập nhật task type', { description: error.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => taskTypeApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskTypes.byProject(projectId) })
      toast.success('Đã xóa task type')
      setDeleteTarget(null)
    },
    onError: (error: Error) => toast.error('Không thể xóa task type', { description: error.message }),
  })

  const submitForm = () => {
    const name = form.name.trim()
    const description = form.description.trim()
    const color = form.color.trim().toUpperCase()

    if (!name) {
      toast.error('Tên task type không được để trống')
      return
    }

    if (!isValidHexColor(color)) {
      toast.error('Màu phải có định dạng #RRGGBB')
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
        <Metric label="Tổng loại" value={taskTypes.length} />
        <Metric label="Gắn goal" value={scopedCount} />
        <Metric label="Toàn project" value={taskTypes.length - scopedCount} />
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Tags className="size-5" />
                </span>
                Task Types
              </CardTitle>
              <CardDescription>
                Chuẩn hóa nhãn phân loại như Feature, Bug, Release hoặc Documentation để task dễ lọc và dễ đọc hơn.
              </CardDescription>
            </div>
            {isOwnerOrManager && (
              <Button className="gap-2" onClick={openCreateDialog}>
                <Plus className="size-4" />
                Tạo task type
              </Button>
            )}
          </div>

          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên, mô tả hoặc goal..."
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {taskTypesQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Đang tải task types...
            </div>
          ) : filteredTaskTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Tags className="size-7" />
              </div>
              <div>
                <p className="font-semibold">Chưa có task type phù hợp</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isOwnerOrManager ? 'Tạo task type đầu tiên để phân loại công việc tốt hơn.' : 'Project chưa cấu hình task type.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {filteredTaskTypes.map((type) => {
                const TypeIcon = resolveTaskTypeIcon(type.icon)
                const goal = type.goalId ? goals.find((item) => item.id === type.goalId) : null
                const color = type.color ?? '#3B82F6'

                return (
                  <div key={type.id} className="grid gap-4 p-4 transition-colors hover:bg-muted/25 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="flex min-w-0 gap-4">
                      <div
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl border"
                        style={{ backgroundColor: `${color}18`, borderColor: `${color}55`, color }}
                      >
                        <TypeIcon className="size-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{type.name}</h3>
                          <Badge variant="outline" className="gap-1">
                            <Palette className="size-3" />
                            {color}
                          </Badge>
                          <Badge variant={goal ? 'secondary' : 'outline'}>
                            {goal ? goal.title : 'Toàn project'}
                          </Badge>
                        </div>
                        {type.description ? (
                          <p className="line-clamp-2 text-sm text-muted-foreground">{type.description}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground/70">Không có mô tả</p>
                        )}
                      </div>
                    </div>

                    {isOwnerOrManager && (
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => openEditDialog(type)}>
                          <Edit3 className="size-4" />
                          Sửa
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(type)}>
                          <Trash2 className="size-4" />
                          Xóa
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setIsDialogOpen(true) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTaskType ? 'Sửa task type' : 'Tạo task type'}</DialogTitle>
            <DialogDescription>
              Task type nên ngắn, rõ và có màu/icon đủ khác biệt để nhận diện nhanh trong task form.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="grid gap-2">
              <Label htmlFor="task-type-name">Tên</Label>
              <Input
                id="task-type-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Feature, Bug, Release..."
                maxLength={100}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="task-type-description">Mô tả</Label>
              <Textarea
                id="task-type-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Task type này dùng khi nào?"
                className="min-h-24"
                maxLength={2000}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Màu</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={form.color}
                    onChange={(event) => setForm((current) => ({ ...current, color: event.target.value.toUpperCase() }))}
                    className="h-10 w-14 cursor-pointer p-1"
                  />
                  <Input
                    value={form.color}
                    onChange={(event) => setForm((current) => ({ ...current, color: event.target.value.toUpperCase() }))}
                    className={cn('font-mono uppercase', !isValidHexColor(form.color) && 'border-destructive focus-visible:ring-destructive')}
                    maxLength={7}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn('size-6 rounded-full border-2 border-background ring-1 ring-border transition-transform hover:scale-110', form.color === color && 'ring-2 ring-primary')}
                      style={{ backgroundColor: color }}
                      onClick={() => setForm((current) => ({ ...current, color }))}
                      aria-label={`Chọn màu ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Icon</Label>
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
              <Label>Phạm vi goal</Label>
              <Select value={form.goalId} onValueChange={(value) => setForm((current) => ({ ...current, goalId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phạm vi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__project">Toàn project</SelectItem>
                  {goals.map((goal) => (
                    <SelectItem key={goal.id} value={String(goal.id)}>
                      {goal.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold" style={{ backgroundColor: `${form.color}18`, borderColor: `${form.color}55`, color: form.color }}>
                <SelectedIcon className="size-4" />
                {form.name.trim() || 'Task type name'}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>Hủy</Button>
            <Button onClick={submitForm} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Lưu task type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={deleteTarget != null}
        title="Xóa task type"
        description={(
          <>
            Task type <strong>{deleteTarget?.name}</strong> sẽ bị xóa. Các task đang dùng type này sẽ được bỏ liên kết type.
          </>
        )}
        confirmText="Xóa"
        confirmVariant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
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
