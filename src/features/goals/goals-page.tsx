import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Target, Loader2, Timer, Clock, Milestone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { goalApi } from '@/lib/api/modules/goal-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
import type { GoalStatusType, GoalType } from '@/types/domain'

const goalTypeConfig: Record<GoalType, { label: string; icon: typeof Timer; color: string }> = {
  SHORT_TERM: { label: 'Ngắn hạn', icon: Timer, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  MEDIUM_TERM: { label: 'Trung hạn', icon: Clock, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  LONG_TERM: { label: 'Dài hạn', icon: Milestone, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
}

const goalStatusConfig: Record<GoalStatusType, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  NOT_STARTED: { label: 'Chưa bắt đầu', variant: 'outline' },
  IN_PROGRESS: { label: 'Đang thực hiện', variant: 'default' },
  ON_HOLD: { label: 'Tạm dừng', variant: 'secondary' },
  COMPLETED: { label: 'Hoàn thành', variant: 'secondary' },
}

export function GoalsPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const workspaceId = Number(params.workspaceId)
  const queryClient = useQueryClient()

  useProjectRealtime(Number.isFinite(workspaceId) ? workspaceId : null, Number.isFinite(projectId) ? projectId : null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [goalType, setGoalType] = useState<GoalType>('SHORT_TERM')
  const [status, setStatus] = useState<GoalStatusType>('NOT_STARTED')

  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.byProject(projectId, 1, 50),
    queryFn: () => goalApi.listByProject(projectId, { page: 1, size: 50 }),
    enabled: Number.isFinite(projectId),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      goalApi.create({
        projectId,
        title: title.trim(),
        goalType,
        status,
        progressPercent: 0,
      }),
    onSuccess: () => {
      setTitle('')
      setGoalType('SHORT_TERM')
      setStatus('NOT_STARTED')
      setDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(projectId, 1, 50) })
      toast.success('Tạo goal thành công')
    },
    onError: (error: Error) => {
      toast.error('Tạo goal thất bại', { description: error.message })
    },
  })

  if (goalsQuery.isLoading) {
    return <LoadingPanel />
  }

  const goals = goalsQuery.data?.content ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goals"
        description="Mục tiêu ngắn hạn và dài hạn trong project"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 size-3.5" />
                Tạo goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tạo goal mới</DialogTitle>
                <DialogDescription>Đặt mục tiêu cho project của bạn.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="goal-title">Tiêu đề</Label>
                  <Input
                    id="goal-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Hoàn thành MVP"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Loại mục tiêu</Label>
                  <div className="flex gap-2">
                    {(Object.keys(goalTypeConfig) as GoalType[]).map((t) => (
                      <Button
                        key={t}
                        type="button"
                        variant={goalType === t ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setGoalType(t)}
                      >
                        {goalTypeConfig[t].label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Trạng thái ban đầu</Label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(goalStatusConfig) as GoalStatusType[]).map((s) => (
                      <Button
                        key={s}
                        type="button"
                        variant={status === s ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatus(s)}
                      >
                        {goalStatusConfig[s].label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !title.trim()}>
                  {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Tạo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {goals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">Chưa có goal nào</p>
            <p className="mt-1 text-xs text-muted-foreground">Tạo goal đầu tiên để theo dõi tiến độ</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => {
            const typeConfig = goalTypeConfig[goal.goalType]
            const statusConfig = goalStatusConfig[goal.status]
            const TypeIcon = typeConfig.icon
            return (
              <Card key={goal.id} className="transition-all hover:shadow-sm">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className={`flex size-8 items-center justify-center rounded-lg ${typeConfig.color}`}>
                      <TypeIcon className="size-4" />
                    </div>
                    <Badge variant={statusConfig.variant} className="text-[10px]">
                      {statusConfig.label}
                    </Badge>
                  </div>

                  <h4 className="line-clamp-2 font-medium">{goal.title}</h4>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Tiến độ</span>
                      <span className="text-xs font-semibold">{goal.progressPercent}%</span>
                    </div>
                    <Progress value={goal.progressPercent} className="h-1.5" />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{typeConfig.label}</span>
                    <span>{goal.createdBy.firstName} {goal.createdBy.lastName}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
