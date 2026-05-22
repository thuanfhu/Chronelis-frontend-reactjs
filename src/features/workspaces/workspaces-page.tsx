import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, PanelsTopLeft, Loader2, Users, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { GrowthComposedChart } from '@/components/charts/growth-composed-chart'
import { DailyAreaChart } from '@/components/charts/daily-area-chart'
import { CompletionLineChart } from '@/components/charts/completion-line-chart'
import type { GrowthPoint } from '@/components/charts/growth-composed-chart'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeferredDeleteStack } from '@/components/shared/deferred-delete-stack'
import { useAuthStore } from '@/app/store/auth-store'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useDeferredDelete } from '@/lib/delete/use-deferred-delete'
import type { PageResult, Workspace } from '@/types/domain'

export function WorkspacesPage() {
  const { t, i18n } = useTranslation()
  const [name, setName] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editWsId, setEditWsId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editInitialName, setEditInitialName] = useState('')
  const [deleteWorkspace, setDeleteWorkspace] = useState<Workspace | null>(null)
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.currentUser)
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US'

  const snapshotWorkspaceListQueries = () =>
    queryClient.getQueriesData<PageResult<Workspace>>({ queryKey: ['workspaces', 'list'] })

  const restoreWorkspaceListQueries = (
    snapshot: Array<[readonly unknown[], PageResult<Workspace> | undefined]>,
  ) => {
    for (const [queryKey, data] of snapshot) {
      queryClient.setQueryData(queryKey, data)
    }
  }

  const patchWorkspaceListQueries = (
    updater: (workspaces: Workspace[], pageSize: number) => Workspace[],
  ) => {
    queryClient.setQueriesData<PageResult<Workspace>>(
      { queryKey: ['workspaces', 'list'] },
      (oldData) => {
        if (!oldData) {
          return oldData
        }

        return {
          ...oldData,
          content: updater(oldData.content, oldData.meta.pageSize),
        }
      },
    )
  }

  const listQuery = useQuery({
    queryKey: queryKeys.workspaces.list(1, 30),
    queryFn: () => workspaceApi.list({ page: 1, size: 30 }),
  })

  const createMutation = useMutation({
    mutationFn: workspaceApi.create,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['workspaces', 'list'] })

      const snapshot = snapshotWorkspaceListQueries()
      const optimisticWorkspaceId = -Date.now()
      const nowIso = new Date().toISOString()
      const optimisticWorkspace: Workspace = {
        id: optimisticWorkspaceId,
        name: payload.name,
        owner: {
          userId: currentUser?.userId ?? '',
          email: currentUser?.email ?? '',
          firstName: currentUser?.firstName ?? '',
          lastName: currentUser?.lastName ?? '',
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      }

      patchWorkspaceListQueries((workspaces, pageSize) => [optimisticWorkspace, ...workspaces].slice(0, pageSize))

      return {
        snapshot,
        optimisticWorkspaceId,
      }
    },
    onSuccess: (savedWorkspace, _variables, context) => {
      setName('')
      setDialogOpen(false)

      patchWorkspaceListQueries((workspaces) => {
        const replacedWorkspaces = workspaces.map((workspace) => (
          workspace.id === context?.optimisticWorkspaceId ? savedWorkspace : workspace
        ))

        return replacedWorkspaces.some((workspace) => workspace.id === savedWorkspace.id)
          ? replacedWorkspaces
          : [savedWorkspace, ...replacedWorkspaces]
      })

      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      toast.success(t('workspace.toast.workspaceCreated'))
    },
    onError: (error: unknown, _variables, context) => {
      if (context?.snapshot) {
        restoreWorkspaceListQueries(context.snapshot)
      }

      const description = error instanceof Error ? error.message : undefined
      toast.error(t('workspace.toast.workspaceCreateFailed'), { description })
    },
  })

  const editMutation = useMutation({
    mutationFn: () => {
      if (!editWsId) throw new Error('Workspace không tồn tại')
      return workspaceApi.update(editWsId, { name: editName.trim() })
    },
    onMutate: async () => {
      if (!editWsId) {
        return {}
      }

      await queryClient.cancelQueries({ queryKey: ['workspaces', 'list'] })

      const snapshot = snapshotWorkspaceListQueries()
      const workspaceSnapshot = queryClient.getQueryData<Workspace>(queryKeys.workspaces.detail(editWsId))

      patchWorkspaceListQueries((workspaces) => workspaces.map((workspace) => (
        workspace.id === editWsId
          ? {
            ...workspace,
            name: editName.trim(),
            updatedAt: new Date().toISOString(),
          }
          : workspace
      )))

      if (workspaceSnapshot) {
        queryClient.setQueryData<Workspace>(queryKeys.workspaces.detail(editWsId), {
          ...workspaceSnapshot,
          name: editName.trim(),
          updatedAt: new Date().toISOString(),
        })
      }

      return {
        snapshot,
        workspaceSnapshot,
      }
    },
    onSuccess: (savedWorkspace) => {
      setEditDialogOpen(false)
      setEditWsId(null)

      patchWorkspaceListQueries((workspaces) => workspaces.map((workspace) => (
        workspace.id === savedWorkspace.id ? savedWorkspace : workspace
      )))
      queryClient.setQueryData(queryKeys.workspaces.detail(savedWorkspace.id), savedWorkspace)

      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      toast.success(t('workspace.toast.workspaceUpdated'))
    },
    onError: (error: Error, _variables, context) => {
      if (context?.snapshot) {
        restoreWorkspaceListQueries(context.snapshot)
      }
      if (context?.workspaceSnapshot && editWsId) {
        queryClient.setQueryData(queryKeys.workspaces.detail(editWsId), context.workspaceSnapshot)
      }

      toast.error(t('workspace.toast.workspaceUpdateFailed'), { description: error.message })
    },
  })

  const {
    pendingDeletes: pendingWorkspaceDeletes,
    clockMs: workspaceDeleteClockMs,
    undoWindowMs: workspaceDeleteUndoWindowMs,
    scheduleDelete: scheduleWorkspaceDelete,
    undoDelete: undoWorkspaceDelete,
    isQueued: isWorkspaceDeleteQueued,
  } = useDeferredDelete<{ id: number; name: string }>({
    onFinalize: async (payload) => {
      await workspaceApi.remove(payload.id)
    },
    onFinalizeSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
    },
    pendingMessage: (entry) => t('workspace.toast.deleteScheduled', { entity: t('workspace.entity.workspace'), name: entry.label }),
    successMessage: (entry) => t('workspace.toast.deleteSuccess', { entity: t('workspace.entity.workspace'), name: entry.label }),
    alreadyDeletedMessage: (entry) => t('workspace.toast.alreadyDeleted', { entity: t('workspace.entity.workspace'), name: entry.label }),
    errorTitle: t('workspace.toast.deleteFailed'),
  })

  const workspaces = listQuery.data?.content ?? []
  const pendingWorkspaceIds = new Set(pendingWorkspaceDeletes.map((entry) => entry.payload.id))
  const visibleWorkspaces = workspaces.filter((workspace) => !pendingWorkspaceIds.has(workspace.id))

  const ownedCount = useMemo(
    () => visibleWorkspaces.filter((ws) => ws.owner.userId === currentUser?.userId).length,
    [visibleWorkspaces, currentUser],
  )
  const joinedCount = visibleWorkspaces.length - ownedCount

  const ownershipData = [
    { name: t('workspace.charts.ownedByMe'), value: ownedCount, color: '#6366f1' },
    { name: t('workspace.charts.joined'), value: joinedCount, color: '#22c55e' },
  ].filter((d) => d.value > 0)

  const workspaceGrowth = useMemo<GrowthPoint[]>(() => {
    const monthMap = new Map<string, number>()
    for (const ws of visibleWorkspaces) {
      if (!ws.createdAt) continue
      const m = ws.createdAt.slice(0, 7)
      monthMap.set(m, (monthMap.get(m) ?? 0) + 1)
    }
    const sorted = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8)
    let cumul = 0
    return sorted.map(([month, count]) => {
      cumul += count
      return { label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), count, cumulative: cumul }
    })
  }, [visibleWorkspaces])

  const workspaceAreaData = useMemo(() => {
    const monthMap = new Map<string, number>()
    for (const ws of visibleWorkspaces) {
      if (!ws.createdAt) continue
      monthMap.set(ws.createdAt.slice(0, 7), (monthMap.get(ws.createdAt.slice(0, 7)) ?? 0) + 1)
    }
    return [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8)
      .map(([month, count]) => ({ date: month + '-01', created: count, completed: 0 }))
  }, [visibleWorkspaces])

  const workspaceLineData = useMemo(() =>
    workspaceAreaData.map((d) => ({ ...d, completed: d.created })),
    [workspaceAreaData])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('workspace.title')}
        description={t('workspace.list.description')}
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1.5 size-4" />
                {t('workspace.create')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('workspace.list.createTitle')}</DialogTitle>
                <DialogDescription>{t('workspace.list.createDescription')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="ws-name">{t('workspace.list.nameLabel')}</Label>
                <Input
                  id="ws-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('workspace.list.namePlaceholder')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) {
                      createMutation.mutate({ name: name.trim() })
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
                <Button
                  onClick={() => createMutation.mutate({ name: name.trim() })}
                  disabled={createMutation.isPending || !name.trim()}
                >
                  {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {t('common.create')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Workspace overview - 5 chart types */}
      {!listQuery.isLoading && visibleWorkspaces.length > 0 && (
        <div className="space-y-5">
          {/* Totals row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('workspace.charts.total'), value: visibleWorkspaces.length, color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300' },
              { label: t('workspace.charts.owned'), value: ownedCount, color: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300' },
              { label: t('workspace.charts.joined'), value: joinedCount, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' },
            ].map((s) => (
              <div key={s.label} className={`flex flex-col items-center justify-center rounded-xl py-3 ${s.color}`}>
                <span className="text-2xl font-bold">{s.value}</span>
                <span className="mt-0.5 text-xs opacity-70">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Row 1: PIE + COMPOSED */}
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            {/* PIE CHART: ownership donut */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-5">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <PanelsTopLeft className="size-4 text-indigo-500" />
                  {t('workspace.charts.ownershipTitle')}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t('workspace.charts.ownershipDesc')}</p>
              </CardHeader>
              <CardContent className="pb-4 pt-0">
                {ownershipData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={ownershipData} cx="50%" cy="50%" innerRadius="46%" outerRadius="68%" paddingAngle={3} dataKey="value" nameKey="name" animationBegin={0} animationDuration={600} strokeWidth={0}>
                        {ownershipData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={(props: any) => {
                        if (!props.active || !props.payload?.length) return null
                        const d = props.payload[0]
                        return (
                          <div className="rounded-xl border border-border/60 bg-background px-3 py-2 shadow-xl">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="inline-block size-2.5 rounded-full" style={{ background: d.payload.color }} />
                              <span className="font-semibold text-foreground">{d.name}</span>
                              <span className="font-bold text-foreground">{d.value}</span>
                            </div>
                          </div>
                        )
                      }} />
                      <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '11px' }} formatter={(v) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[200px] items-center justify-center"><p className="text-sm text-muted-foreground">{t('workspace.charts.noWorkspaces')}</p></div>
                )}
              </CardContent>
            </Card>

            {/* COMPOSED CHART: workspace growth (bar monthly + line cumulative) */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-5">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="size-4 text-emerald-500" />
                  {t('workspace.charts.growthTitle')}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t('workspace.charts.growthDesc')}</p>
              </CardHeader>
              <CardContent className="pb-4 pt-0">
                <GrowthComposedChart data={workspaceGrowth} barColor="#6366f1" lineColor="#22c55e" emptyMessage={t('workspace.charts.noGrowthHistory')} />
              </CardContent>
            </Card>
          </div>

          {/* Row 2: AREA + LINE */}
          <div className="grid gap-5 md:grid-cols-2">
            {/* AREA CHART: monthly workspace additions */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <PanelsTopLeft className="size-4 text-violet-500" />
                  {t('workspace.charts.areaTitle')}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t('workspace.charts.areaDesc')}</p>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <DailyAreaChart data={workspaceAreaData} height={180} showLegend={false} />
              </CardContent>
            </Card>

            {/* LINE CHART: cumulative workspace count */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="size-4 text-amber-500" />
                  {t('workspace.charts.lineTitle')}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t('workspace.charts.lineDesc')}</p>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <CompletionLineChart data={workspaceLineData} mode="cumulative" height={180} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {listQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : visibleWorkspaces.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <PanelsTopLeft className="mb-4 size-12 text-muted-foreground/30" />
            <h3 className="text-base font-semibold">{t('workspace.list.emptyTitle')}</h3>
            <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
              {t('workspace.list.emptyDescription')}
            </p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              {t('workspace.create')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleWorkspaces.map((ws) => (
            <Card key={ws.id} className="group h-full transition-all hover:border-primary/30 hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Link to={`/workspaces/${ws.id}`} className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    {ws.name.charAt(0).toUpperCase()}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/workspaces/${ws.id}`}>
                      <CardTitle className="truncate text-base hover:text-primary">{ws.name}</CardTitle>
                    </Link>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="size-3" />
                      <span>{ws.owner.firstName} {ws.owner.lastName}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setEditWsId(ws.id)
                        setEditName(ws.name)
                        setEditInitialName(ws.name.trim())
                        setEditDialogOpen(true)
                      }}>
                        <Pencil className="mr-2 size-4" />
                        {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setDeleteWorkspace(ws)
                        }}
                      >
                        <Trash2 className="mr-2 size-4" />
                        {t('workspace.action.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <Link to={`/workspaces/${ws.id}`} className="block">
                  <p className="text-xs text-muted-foreground">
                    {t('workspace.list.createdAt', { date: new Date(ws.createdAt).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) })}
                  </p>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit workspace dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setEditInitialName('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('workspace.dialog.editTitle')}</DialogTitle>
            <DialogDescription>{t('workspace.dialog.editDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-ws-name">{t('workspace.list.nameLabel')}</Label>
            <Input
              id="edit-ws-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editName.trim() && editName.trim() !== editInitialName) editMutation.mutate()
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending || !editName.trim() || editName.trim() === editInitialName}>
              {editMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteWorkspace)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteWorkspace(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('workspace.list.deleteTitle')}</DialogTitle>
            <DialogDescription className="space-y-3 text-left leading-relaxed text-muted-foreground">
              <p>
                {deleteWorkspace
                  ? t('workspace.list.deleteConfirm', { name: deleteWorkspace.name })
                  : t('workspace.list.deleteConfirmGeneric')}
              </p>
              <div className="rounded-2xl border border-destructive/12 bg-destructive/5 px-3 py-3 text-sm text-foreground/80">
                {t('workspace.list.deleteWarning')}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteWorkspace(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteWorkspace) {
                  return
                }

                const queued = scheduleWorkspaceDelete({
                  key: `workspace-${deleteWorkspace.id}`,
                  label: deleteWorkspace.name,
                  payload: {
                    id: deleteWorkspace.id,
                    name: deleteWorkspace.name,
                  },
                })

                if (queued) {
                  setDeleteWorkspace(null)
                }
              }}
              disabled={Boolean(deleteWorkspace && isWorkspaceDeleteQueued(`workspace-${deleteWorkspace.id}`))}
            >
              {t('workspace.action.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeferredDeleteStack
        pendingDeletes={pendingWorkspaceDeletes}
        clockMs={workspaceDeleteClockMs}
        undoWindowMs={workspaceDeleteUndoWindowMs}
        onUndo={undoWorkspaceDelete}
        itemTitle={() => t('workspace.toast.deletingWorkspace')}
      />
    </div>
  )
}
