import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, FolderKanban, Users, Loader2, UserPlus, Trash2, Crown, Shield, User, MoreHorizontal, Pencil, Archive, CheckCircle2, RotateCcw, Link2, QrCode, Copy, UsersRound } from 'lucide-react'
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
import { workspaceInviteApi } from '@/lib/api/modules/workspace-invite-api'
import { workspaceTeamApi } from '@/lib/api/modules/workspace-team-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useWorkspaceRealtime } from '@/lib/websocket/use-domain-realtime'
import { isNotFoundError } from '@/lib/errors/is-not-found-error'
import type { PageResult, Project, ProjectStatusType, Workspace, WorkspaceMemberRoleType } from '@/types/domain'

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
  const navigate = useNavigate()
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
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false)
  const [deleteProject, setDeleteProject] = useState<Project | null>(null)
  const [deleteWorkspaceDialogOpen, setDeleteWorkspaceDialogOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRoleType>('MEMBER')
  const [inviteMaxUses, setInviteMaxUses] = useState('')
  const [teamDialogOpen, setTeamDialogOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')

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

  const invitesQuery = useQuery({
    queryKey: queryKeys.invites.byWorkspace(workspaceId),
    queryFn: () => workspaceInviteApi.listActive(workspaceId),
    enabled: Number.isFinite(workspaceId),
  })

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams.byWorkspace(workspaceId),
    queryFn: () => workspaceTeamApi.listByWorkspace(workspaceId),
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

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: number) => projectApi.remove(projectId),
    onMutate: async (projectId: number) => {
      await queryClient.cancelQueries({ queryKey: ['projects', 'workspace', workspaceId] })

      const projectSnapshots = queryClient.getQueriesData<PageResult<Project>>({ queryKey: ['projects', 'workspace', workspaceId] })

      queryClient.setQueriesData<PageResult<Project>>(
        { queryKey: ['projects', 'workspace', workspaceId] },
        (oldData) => {
          if (!oldData) return oldData
          return {
            ...oldData,
            content: oldData.content.filter((project) => project.id !== projectId),
          }
        },
      )

      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(projectId) })

      return {
        projectSnapshots,
      }
    },
    onSuccess: () => {
      setDeleteProjectDialogOpen(false)
      setDeleteProject(null)
      toast.success('Xóa project thành công')
    },
    onError: (error: Error, _projectId, context) => {
      if (context?.projectSnapshots) {
        for (const [queryKey, snapshotData] of context.projectSnapshots) {
          queryClient.setQueryData(queryKey, snapshotData)
        }
      }

      if (isNotFoundError(error)) {
        setDeleteProjectDialogOpen(false)
        setDeleteProject(null)
        toast.success('Project đã được xóa trước đó')
        return
      }

      toast.error('Xóa project thất bại', { description: error.message })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', 'workspace', workspaceId] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) })
    },
  })

  const deleteWorkspaceMutation = useMutation({
    mutationFn: () => workspaceApi.remove(workspaceId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.all })

      const workspaceListSnapshots = queryClient.getQueriesData<PageResult<Workspace>>({ queryKey: ['workspaces', 'list'] })

      queryClient.setQueriesData<PageResult<Workspace>>(
        { queryKey: ['workspaces', 'list'] },
        (oldData) => {
          if (!oldData) return oldData
          return {
            ...oldData,
            content: oldData.content.filter((workspace) => workspace.id !== workspaceId),
          }
        },
      )

      return {
        workspaceListSnapshots,
      }
    },
    onSuccess: () => {
      setDeleteWorkspaceDialogOpen(false)
      toast.success('Xóa workspace thành công')
      navigate('/dashboard', { replace: true })
    },
    onError: (error: Error, _variables, context) => {
      if (context?.workspaceListSnapshots) {
        for (const [queryKey, snapshotData] of context.workspaceListSnapshots) {
          queryClient.setQueryData(queryKey, snapshotData)
        }
      }

      if (isNotFoundError(error)) {
        setDeleteWorkspaceDialogOpen(false)
        toast.success('Workspace đã được xóa trước đó')
        navigate('/dashboard', { replace: true })
        return
      }

      toast.error('Xóa workspace thất bại', { description: error.message })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      void queryClient.invalidateQueries({ queryKey: ['projects', 'workspace'] })
    },
  })

  const createInviteMutation = useMutation({
    mutationFn: () => workspaceInviteApi.create({
      workspaceId,
      roleToAssign: inviteRole,
      maxUses: inviteMaxUses ? Number(inviteMaxUses) : undefined,
    }),
    onSuccess: () => {
      setInviteDialogOpen(false)
      setInviteMaxUses('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.invites.byWorkspace(workspaceId) })
      toast.success('Tạo invite link thành công')
    },
    onError: (error: Error) => toast.error('Tạo invite thất bại', { description: error.message }),
  })

  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: number) => workspaceInviteApi.revoke(inviteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invites.byWorkspace(workspaceId) })
      toast.success('Thu hồi invite thành công')
    },
    onError: (error: Error) => toast.error('Thu hồi thất bại', { description: error.message }),
  })

  const createTeamMutation = useMutation({
    mutationFn: () => workspaceTeamApi.create({
      workspaceId,
      name: teamName.trim(),
      description: teamDescription.trim() || undefined,
    }),
    onSuccess: () => {
      setTeamDialogOpen(false)
      setTeamName('')
      setTeamDescription('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams.byWorkspace(workspaceId) })
      toast.success('Tạo team thành công')
    },
    onError: (error: Error) => toast.error('Tạo team thất bại', { description: error.message }),
  })

  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: number) => workspaceTeamApi.remove(teamId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams.byWorkspace(workspaceId) })
      toast.success('Xóa team thành công')
    },
    onError: (error: Error) => toast.error('Xóa team thất bại', { description: error.message }),
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
  const invites = invitesQuery.data ?? []
  const teams = teamsQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={workspaceQuery.data.name}
        description={`Owner: ${workspaceQuery.data.owner.firstName} ${workspaceQuery.data.owner.lastName} · ${members.length} thành viên · ${projects.length} project`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" onClick={() => setDeleteWorkspaceDialogOpen(true)}>
              <Trash2 className="mr-1.5 size-3.5" />
              Xóa workspace
            </Button>

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
          </div>
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
          <TabsTrigger value="invites" className="gap-1.5">
            <Link2 className="size-3.5" />
            Invites ({invites.length})
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-1.5">
            <UsersRound className="size-3.5" />
            Teams ({teams.length})
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
                  <DialogDescription>Project sẽ tự động tạo 3 cột trạng thái: To do, In Progress, Done.</DialogDescription>
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setDeleteProject(project)
                            setDeleteProjectDialogOpen(true)
                          }}
                        >
                          <Trash2 className="mr-2 size-3.5" />
                          Xóa project
                        </DropdownMenuItem>
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

          <Dialog
            open={deleteProjectDialogOpen}
            onOpenChange={(open) => {
              setDeleteProjectDialogOpen(open)
              if (!open) {
                setDeleteProject(null)
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Xóa project</DialogTitle>
                <DialogDescription>
                  Bạn có chắc muốn xóa project {deleteProject ? `"${deleteProject.name}"` : 'này'} không?
                  Hành động này sẽ xóa toàn bộ goals, tasks, lịch và comment liên quan.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteProjectDialogOpen(false)}>Hủy</Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (!deleteProject) {
                      return
                    }
                    deleteProjectMutation.mutate(deleteProject.id)
                  }}
                  disabled={deleteProjectMutation.isPending || !deleteProject}
                >
                  {deleteProjectMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Xóa project
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

        {/* Invites tab */}
        <TabsContent value="invites" className="mt-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Quản lý invite link cho workspace</p>
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 size-3.5" />
                  Tạo invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tạo invite link</DialogTitle>
                  <DialogDescription>Chia sẻ link hoặc QR code để mời thành viên tham gia workspace.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Vai trò được gán</Label>
                    <div className="flex gap-2">
                      {(['ADMIN', 'MEMBER'] as const).map((r) => (
                        <Button key={r} type="button" variant={inviteRole === r ? 'default' : 'outline'} size="sm" onClick={() => setInviteRole(r)}>
                          {r}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Giới hạn lượt dùng (tùy chọn)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={inviteMaxUses}
                      onChange={(e) => setInviteMaxUses(e.target.value)}
                      placeholder="Không giới hạn"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Hủy</Button>
                  <Button onClick={() => createInviteMutation.mutate()} disabled={createInviteMutation.isPending}>
                    {createInviteMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Tạo
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {invites.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Link2 className="mb-3 size-10 text-muted-foreground/30" />
                <p className="text-sm font-medium">Chưa có invite nào</p>
                <p className="mt-1 text-xs text-muted-foreground">Tạo invite link để mời thành viên</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {invites.map((invite) => {
                const inviteUrl = `${window.location.origin}/join?code=${invite.inviteCode}`
                return (
                  <div key={invite.id} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30">
                    <QrCode className="size-8 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono">{invite.inviteCode}</code>
                        <Badge variant="outline" className="text-[10px]">{invite.roleToAssign}</Badge>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {invite.usedCount}{invite.maxUses ? `/${invite.maxUses}` : ''} lượt dùng
                        {invite.expiresAt ? ` · Hết hạn: ${invite.expiresAt}` : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => {
                        void navigator.clipboard.writeText(inviteUrl)
                        toast.success('Đã copy invite link')
                      }}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => revokeInviteMutation.mutate(invite.id)}
                      disabled={revokeInviteMutation.isPending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Teams tab */}
        <TabsContent value="teams" className="mt-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Quản lý team trong workspace</p>
            <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 size-3.5" />
                  Tạo team
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tạo team mới</DialogTitle>
                  <DialogDescription>Nhóm thành viên lại để phân công hiệu quả hơn.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Tên team</Label>
                    <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Ví dụ: Frontend Team" />
                  </div>
                  <div className="space-y-2">
                    <Label>Mô tả (tùy chọn)</Label>
                    <Textarea value={teamDescription} onChange={(e) => setTeamDescription(e.target.value)} rows={3} placeholder="Mô tả ngắn về team..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTeamDialogOpen(false)}>Hủy</Button>
                  <Button onClick={() => createTeamMutation.mutate()} disabled={createTeamMutation.isPending || !teamName.trim()}>
                    {createTeamMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Tạo
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {teams.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UsersRound className="mb-3 size-10 text-muted-foreground/30" />
                <p className="text-sm font-medium">Chưa có team nào</p>
                <p className="mt-1 text-xs text-muted-foreground">Tạo team để nhóm thành viên</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {teams.map((team) => (
                <Card key={team.id} className="group transition-all hover:border-primary/30 hover:shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-semibold">{team.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-destructive opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        onClick={() => deleteTeamMutation.mutate(team.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    {team.description && <p className="text-xs text-muted-foreground">{team.description}</p>}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="size-3" />
                      <span>{team.memberCount} thành viên</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={deleteWorkspaceDialogOpen} onOpenChange={setDeleteWorkspaceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa workspace</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa workspace "{workspaceQuery.data.name}" không?
              Hành động này không thể hoàn tác và sẽ xóa toàn bộ project, goals, tasks, comment, team và invite liên quan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteWorkspaceDialogOpen(false)}>Hủy</Button>
            <Button
              variant="destructive"
              onClick={() => deleteWorkspaceMutation.mutate()}
              disabled={deleteWorkspaceMutation.isPending}
            >
              {deleteWorkspaceMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Xóa workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
