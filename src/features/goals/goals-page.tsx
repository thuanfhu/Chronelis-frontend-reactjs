import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { goalApi } from '@/lib/api/modules/goal-api'
import { queryKeys } from '@/lib/api/query-keys'
import type { GoalStatusType, GoalType } from '@/types/domain'

export function GoalsPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const queryClient = useQueryClient()

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
        title,
        goalType,
        status,
        progressPercent: 0,
      }),
    onSuccess: () => {
      setTitle('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(projectId, 1, 50) })
      toast.success('Tao goal thanh cong')
    },
    onError: (error: Error) => {
      toast.error('Tao goal that bai', { description: error.message })
    },
  })

  if (goalsQuery.isLoading) {
    return <LoadingPanel />
  }

  const goals = goalsQuery.data?.content ?? []

  return (
    <div className="space-y-5">
      <PageHeader title="Goals" description="Moc tieu ngan han va dai han trong project" />

      <Card>
        <CardHeader>
          <CardTitle>Tao goal</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-[1fr,180px,180px,auto]">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tieu de goal" />
          <Select value={goalType} onChange={(event) => setGoalType(event.target.value as GoalType)}>
            <option value="SHORT_TERM">SHORT_TERM</option>
            <option value="MEDIUM_TERM">MEDIUM_TERM</option>
            <option value="LONG_TERM">LONG_TERM</option>
          </Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value as GoalStatusType)}>
            <option value="NOT_STARTED">NOT_STARTED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="ON_HOLD">ON_HOLD</option>
            <option value="COMPLETED">COMPLETED</option>
          </Select>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || title.trim().length === 0}>
            Tao
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {goals.map((goal) => (
          <Card key={goal.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{goal.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">Type: {goal.goalType}</p>
              <p className="text-muted-foreground">Status: {goal.status}</p>
              <p className="text-muted-foreground">Progress: {goal.progressPercent}%</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
