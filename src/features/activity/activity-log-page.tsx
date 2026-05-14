import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { activityLogApi } from '@/lib/api/modules/activity-log-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
import { CheckCircle2, Target, Layout, Users, Trash2, PlusCircle, RotateCw, UserPlus, Activity, History, MessageSquare, Clock } from 'lucide-react'
import { isToday, isYesterday, format } from 'date-fns'
import { vi, enUS } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const actionConfig: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive', icon: any, color: string }> = {
  CREATED: { variant: 'default', icon: PlusCircle, color: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/20' },
  ADDED: { variant: 'default', icon: PlusCircle, color: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/20' },
  UPDATED: { variant: 'secondary', icon: RotateCw, color: 'text-blue-600 bg-blue-500/10 dark:text-blue-400 dark:bg-blue-500/20' },
  EDITED: { variant: 'secondary', icon: RotateCw, color: 'text-blue-600 bg-blue-500/10 dark:text-blue-400 dark:bg-blue-500/20' },
  DELETED: { variant: 'destructive', icon: Trash2, color: 'text-rose-600 bg-rose-500/10 dark:text-rose-400 dark:bg-rose-500/20' },
  REMOVED: { variant: 'destructive', icon: Trash2, color: 'text-rose-600 bg-rose-500/10 dark:text-rose-400 dark:bg-rose-500/20' },
  ASSIGNED: { variant: 'outline', icon: UserPlus, color: 'text-purple-600 bg-purple-500/10 dark:text-purple-400 dark:bg-purple-500/20' },
  COMPLETED: { variant: 'default', icon: CheckCircle2, color: 'text-green-600 bg-green-500/10 dark:text-green-400 dark:bg-green-500/20' },
  COMMENTED: { variant: 'outline', icon: MessageSquare, color: 'text-amber-600 bg-amber-500/10 dark:text-amber-400 dark:bg-amber-500/20' },
}

const targetConfig: Record<string, { icon: any, color: string }> = {
  TASK: { icon: CheckCircle2, color: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' },
  GOAL: { icon: Target, color: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400' },
  PROJECT: { icon: Layout, color: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' },
  WORKSPACE_MEMBER: { icon: UserPlus, color: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400' },
  PROJECT_MEMBER: { icon: UserPlus, color: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400' },
  TEAM: { icon: Users, color: 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400' },
}

function getActionInfo(action: string) {
  for (const [key, config] of Object.entries(actionConfig)) {
    if (action.includes(key)) return config
  }
  return { variant: 'outline' as const, icon: Activity, color: 'text-muted-foreground bg-muted' }
}

function getTargetInfo(target: string) {
  return targetConfig[target] || { icon: Activity, color: 'bg-muted text-muted-foreground' }
}

export function ActivityLogPage() {
  const { t, i18n } = useTranslation()
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)

  useProjectRealtime(Number.isFinite(workspaceId) ? workspaceId : null, Number.isFinite(projectId) ? projectId : null)

  const logsQuery = useQuery({
    queryKey: queryKeys.activityLogs.byWorkspace(workspaceId, `project:${projectId}`, 1, 100),
    queryFn: () =>
      activityLogApi.listByWorkspace(workspaceId, {
        page: 1,
        size: 100,
      }),
    enabled: Number.isFinite(workspaceId),
  })

  if (logsQuery.isLoading) {
    return <LoadingPanel />
  }

  const logs = logsQuery.data?.content ?? []

  // Group logs by date
  const groupedLogs = logs.reduce((groups, log) => {
    const date = new Date(log.createdAt)
    let groupKey = ''
    
    if (isToday(date)) {
      groupKey = t('activity.today', { defaultValue: 'Hôm nay' })
    } else if (isYesterday(date)) {
      groupKey = t('activity.yesterday', { defaultValue: 'Hôm qua' })
    } else {
      groupKey = format(date, 'PPP', { locale: i18n.language === 'vi' ? vi : enUS })
    }

    if (!groups[groupKey]) groups[groupKey] = []
    groups[groupKey].push(log)
    return groups
  }, {} as Record<string, typeof logs>)

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary">
            <History className="size-7" />
          </div>
          {t('activity.title')}
        </h1>
        <p className="text-muted-foreground font-medium pl-14">
          {t('activity.description', { defaultValue: 'Theo dõi mọi thay đổi và tiến độ trong dự án của bạn.' })}
        </p>
      </div>

      {logs.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-background p-5 rounded-full shadow-sm mb-4">
              <Activity className="size-10 text-muted-foreground/30" />
            </div>
            <p className="text-lg font-bold text-foreground">{t('activity.empty')}</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">{t('activity.emptyDescription')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedLogs).map(([date, dateLogs]) => (
            <div key={date} className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="px-3 py-1 text-xs font-bold bg-primary/10 text-primary border border-primary/20 rounded-lg">
                  {date}
                </Badge>
                <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
              </div>

              <div className="relative space-y-1 ml-4 border-l-2 border-border/80 dark:border-white/20 pl-8">
                {dateLogs.map((log) => {
                  const actionInfo = getActionInfo(log.actionType)
                  const targetInfo = getTargetInfo(log.targetType)
                  const ActionIcon = actionInfo.icon
                  const TargetIcon = targetInfo.icon

                  return (
                    <div key={log.id} className="relative py-4 group">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[43px] top-1/2 -translate-y-1/2 size-5 rounded-full border-4 border-background bg-muted-foreground/30 dark:bg-white/40 flex items-center justify-center transition-colors group-hover:bg-primary group-hover:border-primary/20 shadow-sm z-10">
                         <div className="size-1.5 rounded-full bg-background" />
                      </div>

                      <div className="flex items-start gap-4 p-4 rounded-2xl transition-all bg-background border border-border/80 dark:border-border/40 shadow-sm group-hover:shadow-md group-hover:border-primary/30 group-hover:bg-muted/5">
                        <Avatar className="size-10 shrink-0 shadow-sm border-2 border-background ring-1 ring-border/20">
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-xs font-bold text-primary">
                            {log.actor.firstName.charAt(0)}{log.actor.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                            <span className="text-[15px] font-bold text-foreground truncate max-w-[150px]">
                              {log.actor.firstName} {log.actor.lastName}
                            </span>
                            
                            <Badge className={cn("px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-tight border-none", actionInfo.color)}>
                              <ActionIcon className="size-3 mr-1 inline-block" />
                              {log.actionType.replaceAll('_', ' ')}
                            </Badge>

                            <Badge className={cn("px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-tight border-none", targetInfo.color)}>
                              <TargetIcon className="size-3 mr-1 inline-block" />
                              {log.targetType}
                            </Badge>

                            <span className="text-[11px] font-bold text-muted-foreground/60 dark:text-white/60 flex items-center gap-1 ml-auto">
                              <Clock className="size-3" />
                              {format(new Date(log.createdAt), 'HH:mm')}
                            </span>
                          </div>

                          <div className="bg-muted/30 dark:bg-muted/10 rounded-xl p-3 border border-border/50 dark:border-border/20 shadow-inner-sm">
                            <p className="text-sm font-medium leading-relaxed text-foreground/80 italic">
                              {log.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
