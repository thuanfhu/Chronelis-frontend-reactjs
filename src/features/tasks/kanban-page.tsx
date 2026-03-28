import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Loader2, GripVertical, Columns3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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

  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [statusName, setStatusName] = useState('')
  const [statusCode, setStatusCode] = useState('')
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
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
    mutationFn: () => taskStatusApi.create({ projectId, name: statusName.trim(), code: statusCode.trim() }),
    onSuccess: () => {
      setStatusName('')
      setStatusCode('')
      setStatusDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.statuses.byProject(projectId) })
      toast.success('Tạo cột thành công')
    },
    onError: (error: Error) => {
      toast.error('Tạo cột thất bại', { description: error.message })
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: () =>
      taskApi.create({
        projectId,
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        statusId: taskStatusId ?? 0,
        priority: taskPriority,
      }),
    onSuccess: () => {
      setTaskTitle('')
      setTaskDescription('')
      setTaskDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId, 1, 200) })
      toast.success('Tạo task thành công')
    },
    onError: (error: Error) => {
      toast.error('Tạo task thất bại', { description: error.message })
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
  for (const status of statuses) grouped.set(status.id, [])
  for (const task of tasks) {
    if (!grouped.has(task.status.id)) grouped.set(task.status.id, [])
    grouped.get(task.status.id)?.push(task)
  }
  for (const bucket of grouped.values()) bucket.sort((a, b) => a.boardPosition - b.boardPosition)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kanban Board"
        description="Kéo thả task giữa các cột theo workflow"
        actions={
          <div className="flex gap-2">
            {/* Status dialog */}
            <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="mr-1.5 size-3.5" />
                  Thêm cột
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Thêm cột trạng thái</DialogTitle>
                  <DialogDescription>Tạo một cột mới trên kanban board.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Tên cột</Label>
                    <Input value={statusName} onChange={(e) => setStatusName(e.target.value)} placeholder="Ví dụ: In Review" />
                  </div>
                  <div className="space-y-2">
                    <Label>Code</Label>
                    <Input value={statusCode} onChange={(e) => setStatusCode(e.target.value)} placeholder="Ví dụ: IN_REVIEW" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Hủy</Button>
                  <Button onClick={() => createStatusMutation.mutate()} disabled={createStatusMutation.isPending || !statusName.trim() || !statusCode.trim()}>
                    {createStatusMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Tạo
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Task dialog */}
            <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 size-3.5" />
                  Tạo task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tạo task mới</DialogTitle>
                  <DialogDescription>Thêm task vào một cột trên board.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Tiêu đề</Label>
                    <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Tiêu đề task" />
                  </div>
                  <div className="space-y-2">
                    <Label>Mô tả (tùy chọn)</Label>
                    <Textarea value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Mô tả chi tiết..." rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cột</Label>
                    <div className="flex flex-wrap gap-2">
                      {statuses.map((s) => (
                        <Button key={s.id} type="button" variant={taskStatusId === s.id ? 'default' : 'outline'} size="sm" onClick={() => setTaskStatusId(s.id)}>
                          {s.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Mức ưu tiên</Label>
                    <div className="flex gap-2">
                      {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => (
                        <Button key={p} type="button" variant={taskPriority === p ? 'default' : 'outline'} size="sm" onClick={() => setTaskPriority(p)}>
                          {p}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Hủy</Button>
                  <Button onClick={() => createTaskMutation.mutate()} disabled={createTaskMutation.isPending || !taskTitle.trim() || !taskStatusId}>
                    {createTaskMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Tạo
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {statuses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Columns3 className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">Chưa có cột nào</p>
            <p className="mt-1 text-xs text-muted-foreground">Thêm cột trạng thái đầu tiên để bắt đầu</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statuses.map((status) => {
            const columnTasks = grouped.get(status.id) ?? []
            return (
              <div
                key={status.id}
                className="flex w-72 shrink-0 flex-col rounded-xl border bg-muted/20"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const taskId = Number(e.dataTransfer.getData('text/task-id'))
                  if (taskId) moveTaskMutation.mutate({ taskId, statusId: status.id })
                }}
              >
                {/* Column header */}
                <div className="flex items-center justify-between border-b px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{status.name}</h3>
                    <Badge variant="secondary" className="text-[10px]">{columnTasks.length}</Badge>
                  </div>
                  {status.isClosed && (
                    <Badge variant="outline" className="text-[9px]">Closed</Badge>
                  )}
                </div>

                {/* Column tasks */}
                <ScrollArea className="flex-1">
                  <div className="space-y-2 p-2">
                    {columnTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/task-id', String(task.id))}
                        onClick={() => setTaskDrawerTaskId(task.id)}
                        className="group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-medium">{task.title}</p>
                          <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        {task.description && (
                          <p className="mb-2 line-clamp-1 text-xs text-muted-foreground">{task.description}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <TaskPriorityBadge priority={task.priority} />
                            <span className="text-[10px] text-muted-foreground">#{task.id}</span>
                          </div>
                          <span className="max-w-20 truncate text-[10px] text-muted-foreground">
                            {task.assignee?.firstName ?? 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
