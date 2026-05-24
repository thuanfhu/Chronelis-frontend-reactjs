import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Plus,
  PanelsTopLeft,
  Loader2,
  Users,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  ArrowDownUp,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WorkspaceImageUpload } from '@/components/shared/workspace-image-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

function buildPageNumbers(current: number, total: number): Array<number | '...'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: Array<number | '...'> = []
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  pages.push(1)
  if (left > 2) pages.push('...')
  for (let p = left; p <= right; p++) pages.push(p)
  if (right < total - 1) pages.push('...')
  pages.push(total)
  return pages
}

type WorkspaceOwnerFilter = 'all' | 'owned' | 'joined'
type WorkspaceSortKey = 'newest' | 'oldest' | 'nameAsc' | 'nameDesc'

export function WorkspacesPage() {
  const { t, i18n } = useTranslation()
  const [name, setName] = useState('')
  const [createImageUrl, setCreateImageUrl] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editWsId, setEditWsId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editInitialName, setEditInitialName] = useState('')
  const [editInitialImageUrl, setEditInitialImageUrl] = useState('')
  const [deleteWorkspace, setDeleteWorkspace] = useState<Workspace | null>(null)
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.currentUser)
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US'

  const [page, setPage] = useState(1)
  const [workspaceSearch, setWorkspaceSearch] = useState('')
  const [workspaceOwnerFilter, setWorkspaceOwnerFilter] = useState<WorkspaceOwnerFilter>('all')
  const [workspaceSort, setWorkspaceSort] = useState<WorkspaceSortKey>('newest')
  const pageSize = 9

  useEffect(() => {
    setPage(1)
  }, [workspaceOwnerFilter, workspaceSearch, workspaceSort])

  const snapshotWorkspaceListQueries = () =>
    queryClient.getQueriesData<PageResult<Workspace>>({ queryKey: ['workspaces', 'list'] })

  const restoreWorkspaceListQueries = (snapshot: Array<[readonly unknown[], PageResult<Workspace> | undefined]>) => {
    for (const [queryKey, data] of snapshot) {
      queryClient.setQueryData(queryKey, data)
    }
  }

  const patchWorkspaceListQueries = (updater: (workspaces: Workspace[], pageSize: number) => Workspace[]) => {
    queryClient.setQueriesData<PageResult<Workspace>>({ queryKey: ['workspaces', 'list'] }, (oldData) => {
      if (!oldData) {
        return oldData
      }

      return {
        ...oldData,
        content: updater(oldData.content, oldData.meta.pageSize),
      }
    })
  }

  const listQuery = useQuery({
    queryKey: queryKeys.workspaces.list(1, 90),
    queryFn: () => workspaceApi.list({ page: 1, size: 90, sort: 'createdAt,desc' }),
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
        imageUrl: payload.imageUrl,
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
      setCreateImageUrl('')
      setDialogOpen(false)

      patchWorkspaceListQueries((workspaces) => {
        const replacedWorkspaces = workspaces.map((workspace) =>
          workspace.id === context?.optimisticWorkspaceId ? savedWorkspace : workspace,
        )

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
      return workspaceApi.update(editWsId, { name: editName.trim(), imageUrl: editImageUrl.trim() })
    },
    onMutate: async () => {
      if (!editWsId) {
        return {}
      }

      await queryClient.cancelQueries({ queryKey: ['workspaces', 'list'] })

      const snapshot = snapshotWorkspaceListQueries()
      const workspaceSnapshot = queryClient.getQueryData<Workspace>(queryKeys.workspaces.detail(editWsId))

      patchWorkspaceListQueries((workspaces) =>
        workspaces.map((workspace) =>
          workspace.id === editWsId
            ? {
                ...workspace,
                name: editName.trim(),
                imageUrl: editImageUrl.trim(),
                updatedAt: new Date().toISOString(),
              }
            : workspace,
        ),
      )

      if (workspaceSnapshot) {
        queryClient.setQueryData<Workspace>(queryKeys.workspaces.detail(editWsId), {
          ...workspaceSnapshot,
          name: editName.trim(),
          imageUrl: editImageUrl.trim(),
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

      patchWorkspaceListQueries((workspaces) =>
        workspaces.map((workspace) => (workspace.id === savedWorkspace.id ? savedWorkspace : workspace)),
      )
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
    pendingMessage: (entry) =>
      t('workspace.toast.deleteScheduled', { entity: t('workspace.entity.workspace'), name: entry.label }),
    successMessage: (entry) =>
      t('workspace.toast.deleteSuccess', { entity: t('workspace.entity.workspace'), name: entry.label }),
    alreadyDeletedMessage: (entry) =>
      t('workspace.toast.alreadyDeleted', { entity: t('workspace.entity.workspace'), name: entry.label }),
    errorTitle: t('workspace.toast.deleteFailed'),
  })

  const workspaces = listQuery.data?.content ?? []
  const pendingWorkspaceIds = new Set(pendingWorkspaceDeletes.map((entry) => entry.payload.id))
  const visibleWorkspaces = workspaces.filter((workspace) => !pendingWorkspaceIds.has(workspace.id))
  const filteredWorkspaces = useMemo(() => {
    const query = workspaceSearch.trim().toLowerCase()
    let list = visibleWorkspaces.slice()

    if (query) {
      list = list.filter((workspace) => {
        const ownerName = `${workspace.owner.firstName} ${workspace.owner.lastName}`.toLowerCase()
        return (
          workspace.name.toLowerCase().includes(query) ||
          ownerName.includes(query) ||
          workspace.owner.email.toLowerCase().includes(query)
        )
      })
    }

    if (workspaceOwnerFilter === 'owned') {
      list = list.filter((workspace) => workspace.owner.userId === currentUser?.userId)
    }

    if (workspaceOwnerFilter === 'joined') {
      list = list.filter((workspace) => workspace.owner.userId !== currentUser?.userId)
    }

    list.sort((left, right) => {
      if (workspaceSort === 'nameAsc' || workspaceSort === 'nameDesc') {
        const result = left.name.localeCompare(right.name, locale)
        return workspaceSort === 'nameAsc' ? result : -result
      }

      const leftCreatedAt = new Date(left.createdAt).getTime()
      const rightCreatedAt = new Date(right.createdAt).getTime()
      return workspaceSort === 'newest' ? rightCreatedAt - leftCreatedAt : leftCreatedAt - rightCreatedAt
    })

    return list
  }, [currentUser?.userId, locale, visibleWorkspaces, workspaceOwnerFilter, workspaceSearch, workspaceSort])
  const totalPages = Math.max(1, Math.ceil(filteredWorkspaces.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedWorkspaces = filteredWorkspaces.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const rangeStart = filteredWorkspaces.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, filteredWorkspaces.length)
  const filtersActive = Boolean(workspaceSearch.trim()) || workspaceOwnerFilter !== 'all' || workspaceSort !== 'newest'

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
      return {
        label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        count,
        cumulative: cumul,
      }
    })
  }, [visibleWorkspaces])

  const workspaceAreaData = useMemo(() => {
    const monthMap = new Map<string, number>()
    for (const ws of visibleWorkspaces) {
      if (!ws.createdAt) continue
      monthMap.set(ws.createdAt.slice(0, 7), (monthMap.get(ws.createdAt.slice(0, 7)) ?? 0) + 1)
    }
    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([month, count]) => ({ date: month + '-01', created: count, completed: 0 }))
  }, [visibleWorkspaces])

  const workspaceLineData = useMemo(
    () => workspaceAreaData.map((d) => ({ ...d, completed: d.created })),
    [workspaceAreaData],
  )

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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <WorkspaceImageUpload value={createImageUrl} onChange={setCreateImageUrl} />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="ws-name">{t('workspace.list.nameLabel')}</Label>
                  <Input
                    id="ws-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('workspace.list.namePlaceholder')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && name.trim()) {
                        createMutation.mutate({ name: name.trim(), imageUrl: createImageUrl.trim() })
                      }
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={() => createMutation.mutate({ name: name.trim(), imageUrl: createImageUrl.trim() })}
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
              {
                label: t('workspace.charts.total'),
                value: visibleWorkspaces.length,
                color: 'bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20',
              },
              {
                label: t('workspace.charts.owned'),
                value: ownedCount,
                color: 'bg-violet-50 text-violet-600 border border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20',
              },
              {
                label: t('workspace.charts.joined'),
                value: joinedCount,
                color: 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
              },
            ].map((s) => (
              <div key={s.label} className={`flex flex-col items-center justify-center rounded-xl py-3 ${s.color}`}>
                <span className="text-2xl font-bold">{s.value}</span>
                <span className="mt-0.5 text-xs opacity-80 font-medium">{s.label}</span>
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
                      <Pie
                        data={ownershipData}
                        cx="50%"
                        cy="50%"
                        innerRadius="46%"
                        outerRadius="68%"
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                        animationBegin={0}
                        animationDuration={600}
                        strokeWidth={0}
                      >
                        {ownershipData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={(props: any) => {
                          if (!props.active || !props.payload?.length) return null
                          const d = props.payload[0]
                          return (
                            <div className="rounded-xl border border-border/60 bg-background px-3 py-2 shadow-xl">
                              <div className="flex items-center gap-2 text-xs">
                                <span
                                  className="inline-block size-2.5 rounded-full"
                                  style={{ background: d.payload.color }}
                                />
                                <span className="font-semibold text-foreground">{d.name}</span>
                                <span className="font-bold text-foreground">{d.value}</span>
                              </div>
                            </div>
                          )
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={7}
                        wrapperStyle={{ fontSize: '11px' }}
                        formatter={(v) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{v}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[200px] items-center justify-center">
                    <p className="text-sm text-muted-foreground">{t('workspace.charts.noWorkspaces')}</p>
                  </div>
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
                <GrowthComposedChart
                  data={workspaceGrowth}
                  barColor="#6366f1"
                  lineColor="#22c55e"
                  emptyMessage={t('workspace.charts.noGrowthHistory')}
                />
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
        <>
          <section className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-normal">{t('workspace.list.recentTitle')}</h2>
                <p className="text-sm text-muted-foreground">
                  {filtersActive
                    ? t('workspace.list.showingRangeFiltered', {
                        start: rangeStart,
                        end: rangeEnd,
                        filtered: filteredWorkspaces.length,
                        total: visibleWorkspaces.length,
                      })
                    : t('workspace.list.showingRange', {
                        start: rangeStart,
                        end: rangeEnd,
                        filtered: filteredWorkspaces.length,
                      })}
                </p>
              </div>
              {filtersActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-fit"
                  onClick={() => {
                    setWorkspaceSearch('')
                    setWorkspaceOwnerFilter('all')
                    setWorkspaceSort('newest')
                  }}
                >
                  <X className="mr-1.5 size-3.5" />
                  {t('workspace.list.clearFilters')}
                </Button>
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_13rem_13rem]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={workspaceSearch}
                  onChange={(event) => setWorkspaceSearch(event.target.value)}
                  placeholder={t('workspace.list.searchPlaceholder')}
                  className="pl-9"
                />
              </div>
              <Select
                value={workspaceOwnerFilter}
                onValueChange={(value) => setWorkspaceOwnerFilter(value as WorkspaceOwnerFilter)}
              >
                <SelectTrigger>
                  <SlidersHorizontal className="size-4 text-muted-foreground" />
                  <SelectValue aria-label={t('workspace.list.filterByOwnership')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('workspace.list.allWorkspaces')}</SelectItem>
                  <SelectItem value="owned">{t('workspace.list.ownedByMe')}</SelectItem>
                  <SelectItem value="joined">{t('workspace.list.joinedByMe')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={workspaceSort} onValueChange={(value) => setWorkspaceSort(value as WorkspaceSortKey)}>
                <SelectTrigger>
                  <ArrowDownUp className="size-4 text-muted-foreground" />
                  <SelectValue aria-label={t('workspace.list.sortBy')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t('workspace.list.sortNewest')}</SelectItem>
                  <SelectItem value="oldest">{t('workspace.list.sortOldest')}</SelectItem>
                  <SelectItem value="nameAsc">{t('workspace.list.sortNameAsc')}</SelectItem>
                  <SelectItem value="nameDesc">{t('workspace.list.sortNameDesc')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          {filteredWorkspaces.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="mb-3 size-10 text-muted-foreground/30" />
                <h3 className="text-sm font-semibold">{t('workspace.list.noMatchesTitle')}</h3>
                <p className="mt-1 max-w-sm text-center text-xs text-muted-foreground">
                  {t('workspace.list.noMatchesDescription')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paginatedWorkspaces.map((ws) => (
              <Card key={ws.id} className="group h-full transition-all hover:border-primary/30 hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <Link
                      to={`/workspaces/${ws.id}`}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground overflow-hidden"
                    >
                      {ws.imageUrl ? (
                        <img src={ws.imageUrl} alt={ws.name} className="size-full object-cover" />
                      ) : (
                        ws.name.charAt(0).toUpperCase()
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link to={`/workspaces/${ws.id}`}>
                        <CardTitle className="truncate text-base hover:text-primary">{ws.name}</CardTitle>
                      </Link>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="size-3" />
                        <span>
                          {ws.owner.firstName} {ws.owner.lastName}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditWsId(ws.id)
                            setEditName(ws.name)
                            setEditImageUrl(ws.imageUrl || '')
                            setEditInitialName(ws.name.trim())
                            setEditInitialImageUrl(ws.imageUrl || '')
                            setEditDialogOpen(true)
                          }}
                        >
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
                      {t('workspace.list.createdAt', {
                        date: new Date(ws.createdAt).toLocaleDateString(locale, {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        }),
                      })}
                    </p>
                  </Link>
                </CardContent>
              </Card>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-6 flex flex-col items-center gap-2 pb-4">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                {buildPageNumbers(currentPage, totalPages).map((p, idx) =>
                  p === '...' ? (
                    <span
                      key={`dots-${idx}`}
                      className="flex size-8 items-center justify-center text-xs text-muted-foreground"
                    >
                      ⋯
                    </span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === currentPage ? 'default' : 'outline'}
                      size="icon"
                      className="size-8 text-xs"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  ),
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit workspace dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setEditInitialName('')
            setEditInitialImageUrl('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('workspace.dialog.editTitle')}</DialogTitle>
            <DialogDescription>{t('workspace.dialog.editDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <WorkspaceImageUpload value={editImageUrl} onChange={setEditImageUrl} />
            <div className="flex-1 space-y-2">
              <Label htmlFor="edit-ws-name">{t('workspace.list.nameLabel')}</Label>
              <Input
                id="edit-ws-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editName.trim() && (editName.trim() !== editInitialName || editImageUrl.trim() !== editInitialImageUrl)) editMutation.mutate()
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending || !editName.trim() || (editName.trim() === editInitialName && editImageUrl.trim() === editInitialImageUrl)}
            >
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
            <Button variant="outline" onClick={() => setDeleteWorkspace(null)}>
              {t('common.cancel')}
            </Button>
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
