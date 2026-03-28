import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { taskStatusApi } from '@/lib/api/modules/task-status-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useProjectRealtime } from '@/lib/websocket/use-domain-realtime'
import { useUiStore } from '@/app/store/ui-store'
import { TaskPriorityBadge } from '@/features/tasks/task-priority-badge'
import type { TaskPriorityType } from '@/types/domain'

export function KanbanPage() {
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)
  const queryClient = useQueryClient()
  const setTaskDrawerTaskId = useUiStore((state) => state.setTaskDrawerTaskId)

  useProjectRealtime(Number.isFinite(workspaceId) ? workspaceId : null, Number.isFinite(projectId) ? projectId : null)

  const [statusName, setStatusName] = useState('')
  const [statusCode, setStatusCode] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskStatusId, setTaskStatusId] = useState<number | null>(null)
  const [taskPriority, setTaskPriority] = useState<TaskPriorityType>('MEDIUM')

  const statusesQuery = useQuery({
    queryKey: queryKeys.statuses.byProject(projectId),
    queryFn: () => taskStatusApi.listByProject(projectId),
    enabled: Number.isFinite(projectId),
  })

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.byProject(projectId, 1, 200),
    queryFn: () => taskApi.listByProject(projectId, { page: 1, size: 200 }),
    enabled: Number.isFinite(projectId),
  })

  const createStatusMutation = useMutation({
    mutationFn: () => taskStatusApi.create({ projectId, name: statusName, code: statusCode }),
    onSuccess: () => {
      setStatusName('')
      setStatusCode('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.statuses.byProject(projectId) })
      toast.success('Tao cot kanban thanh cong')
    },
    onError: (error: Error) => {
      toast.error('Tao cot that bai', { description: error.message })
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: () =>
      taskApi.create({
        projectId,
        title: taskTitle,
        statusId: taskStatusId ?? 0,
        priority: taskPriority,
      }),
    onSuccess: () => {
      setTaskTitle('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId, 1, 200) })
      toast.success('Tao task thanh cong')
    },
    onError: (error: Error) => {
      toast.error('Tao task that bai', { description: error.message })
    },
  })

  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, statusId }: { taskId: number; statusId: number }) => taskApi.move(taskId, statusId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId, 1, 200) })
    },
  })

  if (statusesQuery.isLoading || tasksQuery.isLoading) {
    return <LoadingPanel />
  }

  const statuses = statusesQuery.data ?? []
  const tasks = tasksQuery.data?.content ?? []
  const grouped = new Map<number, typeof tasks>()
  for (const status of statuses) {
    grouped.set(status.id, [])
  }
  for (const task of tasks) {
    if (!grouped.has(task.status.id)) {
      grouped.set(task.status.id, [])
    }
    grouped.get(task.status.id)?.push(task)
  }
  for (const bucket of grouped.values()) {
    bucket.sort((a, b) => a.boardPosition - b.boardPosition)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Kanban" description="Keo tha task giua cac cot theo workflow backend" />

      <Card>
        <CardHeader>
          <CardTitle>Khoi tao nhanh</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 lg:grid-cols-2">
          <div className="grid gap-2 sm:grid-cols-[1fr,1fr,auto]">
            <Input value={statusName} onChange={(event) => setStatusName(event.target.value)} placeholder="Ten cot" />
            <Input value={statusCode} onChange={(event) => setStatusCode(event.target.value)} placeholder="Code" />
            <Button
              onClick={() => createStatusMutation.mutate()}
              disabled={createStatusMutation.isPending || !statusName.trim() || !statusCode.trim()}
            >
              Them cot
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr,180px,180px,auto]">
            <Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Tieu de task" />
            <Select
              value={taskStatusId ? String(taskStatusId) : ''}
              onChange={(event) => setTaskStatusId(Number(event.target.value))}
            >
              <option value="">Chon cot</option>
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>{status.name}</option>
              ))}
            </Select>
            <Select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as TaskPriorityType)}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </Select>
            <Button onClick={() => createTaskMutation.mutate()} disabled={createTaskMutation.isPending || !taskTitle.trim() || !taskStatusId}>
              Tao task
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-4">
        {statuses.map((status) => (
          <Card
            key={status.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const taskId = Number(event.dataTransfer.getData('text/task-id'))
              if (!taskId) {
                return
              }
              moveTaskMutation.mutate({ taskId, statusId: status.id })
            }}
          >
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm font-semibold">{status.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {(grouped.get(status.id) ?? []).map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/task-id', String(task.id))
                  }}
                  onClick={() => setTaskDrawerTaskId(task.id)}
                  className="cursor-pointer rounded-md border bg-card p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-medium">{task.title}</p>
                    <TaskPriorityBadge priority={task.priority} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>#{task.id}</span>
                    <span>{task.assignee?.firstName ?? 'Unassigned'}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
