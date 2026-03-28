import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, FolderKanban, Users, ArrowRight, Loader2, UserPlus, Trash2, Crown, Shield, User, MoreHorizontal, Pencil, Archive, CheckCircle2, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
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
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { projectApi } from '@/lib/api/modules/project-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useWorkspaceRealtime } from '@/lib/websocket/use-domain-realtime'
import type { ProjectStatusType, WorkspaceMemberRoleType } from '@/types/domain'

const roleIcon = {
  OWNER: Crown,
  ADMIN: Shield,
  MEMBER: User,
}

const roleBadgeVariant = {
  OWNER: 'default' as const,
  ADMIN: 'secondary' as const,
  MEMBER: 'outline' as const,
}

export function WorkspaceDetailPage() {
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const queryClient = useQueryClient()

  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [memberUserId, setMemberUserId] = useState('')
  const [memberRole, setMemberRole] = useState<WorkspaceMemberRoleType>('MEMBER')
  const [editWsDialogOpen, setEditWsDialogOpen] = useState(false)
  const [editWsName, setEditWsName] = useState('')
  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false)
  const [editProjectId, setEditProjectId] = useState<number | null>(null)
  const [editProjectName, setEditProjectName] = useState('')
  const [editProjectDescription, setEditProjectDescription] = useState('')

  useWorkspaceRealtime(Number.isFinite(workspaceId) ? workspaceId : null)

  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId),
    queryFn: () => workspaceApi.detail(workspaceId),
    enabled: Number.isFinite(workspaceId),
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId),
    queryFn: () => workspaceApi.members(workspaceId),
    enabled: Number.isFinite(workspaceId),
  })

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50),
    queryFn: () => projectApi.listByWorkspace(workspaceId, { page: 1, size: 50 }),
    enabled: Number.isFinite(workspaceId),
  })

  const createProjectMutation = useMutation({
    mutationFn: () => projectApi.create({ workspaceId, name: projectName.trim(), description: projectDescription.trim() || undefined }),
    onSuccess: () => {
      setProjectName('')
      setProjectDescription('')
      setProjectDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      toast.success('Tạo project thành công')
    },
    onError: (error: Error) => {
      toast.error('Tạo project thất bại', { description: error.message })
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: () => workspaceApi.addMember(workspaceId, { userId: memberUserId.trim(), role: memberRole }),
    onSuccess: () => {
      setMemberUserId('')
      setMemberRole('MEMBER')
      setMemberDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) })
      toast.success('Thêm thành viên thành công')
    },
    onError: (error: Error) => {
      toast.error('Thêm thành viên thất bại', { description: error.message })
    },
  })

  const updateWorkspaceMutation = useMutation({
    mutationFn: () => workspaceApi.update(workspaceId, { name: editWsName.trim() }),
    onSuccess: () => {
      setEditWsDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      toast.success('Cập nhật workspace thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật workspace thất bại', { description: error.message })
    },
  })

  const updateProjectMutation = useMutation({
    mutationFn: () => {
      if (!editProjectId) throw new Error('Project không tồn tại')
      return projectApi.update(editProjectId, {
        name: editProjectName.trim(),
        description: editProjectDescription.trim() || undefined,
      })
    },
    onSuccess: () => {
      setEditProjectDialogOpen(false)
      setEditProjectId(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      toast.success('Cập nhật project thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật project thất bại', { description: error.message })
    },
  })

  const updateProjectStatusMutation = useMutation({
    mutationFn: ({ projectId, status }: { projectId: number; status: ProjectStatusType }) =>
      projectApi.updateStatus(projectId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      toast.success('Cập nhật trạng thái project thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật trạng thái thất bại', { description: error.message })
    },
  })

  const isLoading = workspaceQuery.isLoading || membersQuery.isLoading || projectsQuery.isLoading

  if (isLoading) {
    return <LoadingPanel />
  }

  if (!workspaceQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Workspace không tồn tại.</p>
        <Link to="/workspaces" className="mt-2 text-sm text-primary hover:underline">Quay lại danh sách</Link>
      </div>
    )
  }

  const members = membersQuery.data ?? []
  const projects = projectsQuery.data?.content ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={workspaceQuery.data.name}
        description={`Owner: ${workspaceQuery.data.owner.firstName} ${workspaceQuery.data.owner.lastName} · ${members.length} thành viên · ${projects.length} project`}
        actions={
          <Dialog open={editWsDialogOpen} onOpenChange={setEditWsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditWsName(workspaceQuery.data!.name)}
              >
                <Pencil className="mr-1.5 size-3.5" />
                Chỉnh sửa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Chỉnh sửa workspace</DialogTitle>
                <DialogDescription>Đổi tên workspace.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Tên workspace</Label>
                <Input
                  value={editWsName}
                  onChange={(e) => setEditWsName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editWsName.trim()) updateWorkspaceMutation.mutate()
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditWsDialogOpen(false)}>Hủy</Button>
                <Button onClick={() => updateWorkspaceMutation.mutate()} disabled={updateWorkspaceMutation.isPending || !editWsName.trim()}>
                  {updateWorkspaceMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Lưu
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects" className="gap-1.5">
            <FolderKanban className="size-3.5" />
            Projects ({projects.length})
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5">
            <Users className="size-3.5" />
            Thành viên ({members.length})
          </TabsTrigger>
        </TabsList>

        {/* Projects tab */}
        <TabsContent value="projects" className="mt-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Danh sách project trong workspace</p>
            <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 size-3.5" />
                  Tạo project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tạo project mới</DialogTitle>
                  <DialogDescription>Project sẽ tự động tạo 4 cột trạng thái: Inbox, Planned, Doing, Done.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="proj-name">Tên project</Label>
                    <Input
                      id="proj-name"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Ví dụ: Sprint 1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proj-desc">Mô tả (tùy chọn)</Label>
                    <Textarea
                      id="proj-desc"
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="Mô tả ngắn về project..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>Hủy</Button>
                  <Button onClick={() => createProjectMutation.mutate()} disabled={createProjectMutation.isPending || !projectName.trim()}>
                    {createProjectMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Tạo
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {projects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderKanban className="mb-3 size-10 text-muted-foreground/30" />
                <p className="text-sm font-medium">Chưa có project nào</p>
                <p className="mt-1 text-xs text-muted-foreground">Tạo project đầu tiên để bắt đầu</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {projects.map((project) => (
                <Card key={project.id} className="group h-full transition-all hover:border-primary/30 hover:shadow-sm">
                  <CardContent className="flex items-start gap-3 p-4">
                    <Link to={`/workspaces/${workspaceId}/projects/${project.id}`} className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-sm font-bold text-accent-foreground">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{project.name}</p>
                        {project.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{project.description}</p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant={project.status === 'ACTIVE' ? 'default' : project.status === 'COMPLETED' ? 'secondary' : 'outline'} className="text-[10px]">
                            {project.status}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {project.createdBy.firstName} {project.createdBy.lastName}
                          </span>
                        </div>
                      </div>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditProjectId(project.id)
                            setEditProjectName(project.name)
                            setEditProjectDescription(project.description ?? '')
                            setEditProjectDialogOpen(true)
                          }}
                        >
                          <Pencil className="mr-2 size-3.5" />
                          Chỉnh sửa
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {project.status !== 'ACTIVE' && (
                          <DropdownMenuItem onClick={() => updateProjectStatusMutation.mutate({ projectId: project.id, status: 'ACTIVE' })}>
                            <RotateCcw className="mr-2 size-3.5" />
                            Kích hoạt lại
                          </DropdownMenuItem>
                        )}
                        {project.status !== 'COMPLETED' && (
                          <DropdownMenuItem onClick={() => updateProjectStatusMutation.mutate({ projectId: project.id, status: 'COMPLETED' })}>
                            <CheckCircle2 className="mr-2 size-3.5" />
                            Hoàn thành
                          </DropdownMenuItem>
                        )}
                        {project.status !== 'ARCHIVED' && (
                          <DropdownMenuItem onClick={() => updateProjectStatusMutation.mutate({ projectId: project.id, status: 'ARCHIVED' })}>
                            <Archive className="mr-2 size-3.5" />
                            Lưu trữ
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Edit project dialog */}
          <Dialog open={editProjectDialogOpen} onOpenChange={setEditProjectDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Chỉnh sửa project</DialogTitle>
                  <DialogDescription>Cập nhật thông tin project.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Tên project</Label>
                    <Input value={editProjectName} onChange={(e) => setEditProjectName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Mô tả</Label>
                    <Textarea value={editProjectDescription} onChange={(e) => setEditProjectDescription(e.target.value)} rows={3} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditProjectDialogOpen(false)}>Hủy</Button>
                  <Button onClick={() => updateProjectMutation.mutate()} disabled={updateProjectMutation.isPending || !editProjectName.trim()}>
                    {updateProjectMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Lưu
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </TabsContent>

        {/* Members tab */}
        <TabsContent value="members" className="mt-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Quản lý thành viên và phân quyền</p>
            <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="mr-1.5 size-3.5" />
                  Thêm thành viên
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Thêm thành viên</DialogTitle>
                  <DialogDescription>Nhập User ID và chọn vai trò cho thành viên mới.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="member-id">User ID</Label>
                    <Input
                      id="member-id"
                      value={memberUserId}
                      onChange={(e) => setMemberUserId(e.target.value)}
                      placeholder="UUID của user"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vai trò</Label>
                    <div className="flex gap-2">
                      {(['ADMIN', 'MEMBER'] as const).map((r) => (
                        <Button
                          key={r}
                          type="button"
                          variant={memberRole === r ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setMemberRole(r)}
                        >
                          {r}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>Hủy</Button>
                  <Button onClick={() => addMemberMutation.mutate()} disabled={addMemberMutation.isPending || !memberUserId.trim()}>
                    {addMemberMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Thêm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2">
            {members.map((member) => {
              const RoleIcon = roleIcon[member.role]
              return (
                <div key={member.id} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30">
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {member.user.firstName.charAt(0)}{member.user.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{member.user.firstName} {member.user.lastName}</p>
                    <p className="text-xs text-muted-foreground">{member.user.email}</p>
                  </div>
                  <Badge variant={roleBadgeVariant[member.role]} className="gap-1">
                    <RoleIcon className="size-3" />
                    {member.role}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="size-8 p-0">···</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(['ADMIN', 'MEMBER'] as const).map((r) => (
                        <DropdownMenuItem
                          key={r}
                          disabled={member.role === r}
                          onClick={() => {
                            workspaceApi
                              .updateMemberRole(workspaceId, member.user.userId, r)
                              .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) }))
                              .catch((err: Error) => toast.error('Cập nhật role thất bại', { description: err.message }))
                          }}
                        >
                          Đổi thành {r}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          workspaceApi
                            .removeMember(workspaceId, member.user.userId)
                            .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) }))
                            .catch((err: Error) => toast.error('Xóa thành viên thất bại', { description: err.message }))
                        }}
                      >
                        <Trash2 className="mr-2 size-3.5" />
                        Xóa khỏi workspace
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
