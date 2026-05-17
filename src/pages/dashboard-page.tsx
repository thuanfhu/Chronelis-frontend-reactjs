import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bell, PanelsTopLeft, FolderKanban, ArrowRight, Plus, Briefcase, ShieldAlert, Clock, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { notificationApi } from '@/lib/api/modules/notification-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useAuthStore } from '@/app/store/auth-store'
import { useTranslation } from 'react-i18next'
import { TaskHealthDonut } from '@/components/charts/task-health-donut'
import { PriorityBarChart } from '@/components/charts/priority-bar-chart'

export function DashboardPage() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const { t } = useTranslation()
  const [page, setPage] = useState(1)

  const workspaceQuery = useQuery({
    queryKey: ['workspaces', 'list', page, 6],
    queryFn: () => workspaceApi.list({ page, size: 6, sort: 'createdAt,desc' }),
  })

  const notificationCountQuery = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: notificationApi.unreadCount,
  })

  const myWorkQuery = useQuery({
    queryKey: queryKeys.tasks.myWork,
    queryFn: taskApi.myWork,
  })

  const workspaces = workspaceQuery.data?.content ?? []
  const workspaceCount = workspaceQuery.data?.meta.totalElements ?? 0
  const unreadCount = notificationCountQuery.data?.unreadCount ?? 0
  const myWork = myWorkQuery.data

  const assignedTasks = useMemo(() => myWork?.assignedTasks ?? [], [myWork])

  const isLoading = workspaceQuery.isLoading || myWorkQuery.isLoading

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('dashboard.greeting', { name: currentUser?.firstName ?? t('dashboard.userFallback') }) + ' 👋'}
        description={t('dashboard.recentWorkspaces')}
      />

      {/* Overview panel */}
      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[280px] rounded-2xl lg:col-span-1" />
          <Skeleton className="h-[280px] rounded-2xl" />
          <Skeleton className="h-[280px] rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Compact stats */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-5">
              <MiniStat icon={PanelsTopLeft} label={t('dashboard.totalWorkspaces')} value={workspaceCount} accent="text-primary bg-primary/10" />
              <MiniStat icon={FolderKanban} label={t('dashboard.totalProjects')} value={workspaces.length} accent="text-violet-600 bg-violet-100 dark:bg-violet-500/20 dark:text-violet-300" />
              <MiniStat icon={Bell} label={t('notification.title')} value={unreadCount} accent="text-rose-600 bg-rose-100 dark:bg-rose-500/20 dark:text-rose-300" />
              <MiniStat icon={Briefcase} label={t('dashboard.tasksAssigned')} value={myWork?.assignedCount ?? 0} accent="text-amber-600 bg-amber-100 dark:bg-amber-500/20 dark:text-amber-300" />
              <MiniStat icon={ShieldAlert} label="Blocked tasks" value={myWork?.blockedCount ?? 0} accent="text-orange-600 bg-orange-100 dark:bg-orange-500/20 dark:text-orange-300" />
              <MiniStat icon={Clock} label="Overdue" value={myWork?.overdueCount ?? 0} accent="text-sky-600 bg-sky-100 dark:bg-sky-500/20 dark:text-sky-300" />
            </CardContent>
          </Card>

          {/* Task Health Donut */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="size-4 text-emerald-500" />
                Task Health
              </CardTitle>
              <p className="text-xs text-muted-foreground">Breakdown of your assigned tasks</p>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <TaskHealthDonut
                assignedCount={myWork?.assignedCount ?? 0}
                blockedCount={myWork?.blockedCount ?? 0}
                overdueCount={myWork?.overdueCount ?? 0}
                dueTodayCount={myWork?.dueTodayCount ?? 0}
              />
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Briefcase className="size-4 text-amber-500" />
                Priority Breakdown
              </CardTitle>
              <p className="text-xs text-muted-foreground">Your tasks by priority level</p>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <PriorityBarChart tasks={assignedTasks} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent workspaces */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('dashboard.recentWorkspaces')}</h2>
          <Link to="/workspaces">
            <Button variant="ghost" size="sm">
              {t('common.all')} <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </Link>
        </div>

        {workspaceQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <PanelsTopLeft className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">{t('dashboard.noWorkspaces')}</p>
              <p className="mt-1 text-xs text-muted-foreground/70">{t('dashboard.createFirstWorkspace')}</p>
              <Link to="/workspaces" className="mt-4">
                <Button size="sm">
                  <Plus className="mr-1.5 size-3.5" />
                  {t('workspace.create')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {workspaces.map((ws) => (
                <Link key={ws.id} to={`/workspaces/${ws.id}`}>
                  <Card className="group transition-all hover:border-primary/30 hover:shadow-md">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          {ws.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">{ws.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {t('dashboard.ownerName', {
                              name: `${ws.owner.firstName} ${ws.owner.lastName}`,
                            })}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {t('dashboard.createdAt', {
                          date: new Date(ws.createdAt).toLocaleDateString(),
                        })}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Pagination controls */}
            {workspaceQuery.data && workspaceQuery.data.meta.totalPages > 1 && (
              <div className="mt-6 flex flex-col items-center gap-2 pb-6">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || workspaceQuery.isLoading}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  
                  {Array.from({ length: workspaceQuery.data.meta.totalPages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="icon"
                      className="size-8"
                      onClick={() => setPage(p)}
                      disabled={workspaceQuery.isLoading}
                    >
                      {p}
                    </Button>
                  ))}

                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!workspaceQuery.data.meta.hasNext || workspaceQuery.isLoading}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Trang {page} / {workspaceQuery.data.meta.totalPages}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MiniStat({ icon: Icon, label, value, accent }: { icon: typeof PanelsTopLeft; label: string; value: number; accent: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="size-3.5" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-base font-bold tabular-nums">{value}</span>
    </div>
  )
}
