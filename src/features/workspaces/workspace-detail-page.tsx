import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { EmptyState } from '@/components/shared/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { projectApi } from '@/lib/api/modules/project-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useWorkspaceRealtime } from '@/lib/websocket/use-domain-realtime'
import type { WorkspaceMemberRoleType } from '@/types/domain'

export function WorkspaceDetailPage() {
  const params = useParams()
  const workspaceId = Number(params.workspaceId)
  const queryClient = useQueryClient()

  const [projectName, setProjectName] = useState('')
  const [memberUserId, setMemberUserId] = useState('')
  const [memberRole, setMemberRole] = useState<WorkspaceMemberRoleType>('MEMBER')

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
    mutationFn: () => projectApi.create({ workspaceId, name: projectName }),
    onSuccess: () => {
      setProjectName('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      toast.success('Tao project thanh cong')
    },
    onError: (error: Error) => {
      toast.error('Tao project that bai', { description: error.message })
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: () => workspaceApi.addMember(workspaceId, { userId: memberUserId, role: memberRole }),
    onSuccess: () => {
      setMemberUserId('')
      setMemberRole('MEMBER')
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) })
      toast.success('Them thanh vien thanh cong')
    },
    onError: (error: Error) => {
      toast.error('Them thanh vien that bai', { description: error.message })
    },
  })

  const members = membersQuery.data ?? []
  const projects = projectsQuery.data?.content ?? []

  const canRender = useMemo(
    () => Number.isFinite(workspaceId) && !workspaceQuery.isLoading && !membersQuery.isLoading && !projectsQuery.isLoading,
    [membersQuery.isLoading, projectsQuery.isLoading, workspaceId, workspaceQuery.isLoading],
  )

  if (!canRender) {
    return <LoadingPanel />
  }

  if (!workspaceQuery.data) {
    return <EmptyState title="Workspace khong ton tai" description="Vui long kiem tra lai ID workspace trong duong dan" />
  }

  return (
    <div className="space-y-5">
      <PageHeader title={workspaceQuery.data.name} description="Thanh vien, project va phan quyen trong workspace" />

      <div className="grid gap-4 xl:grid-cols-[1.2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Ten project" />
              <Button
                onClick={() => createProjectMutation.mutate()}
                disabled={createProjectMutation.isPending || projectName.trim().length === 0}
              >
                Tao
              </Button>
            </div>

            <div className="space-y-2">
              {projects.map((project) => (
                <div key={project.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{project.name}</p>
                    <Button variant="outline" size="sm">
                      <Link to={`/workspaces/${workspaceId}/projects/${project.id}`}>Mo</Link>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Trang thai: {project.status}</p>
                </div>
              ))}
              {projects.length === 0 ? <p className="text-sm text-muted-foreground">Chua co project nao.</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[1fr,120px,auto]">
              <Input
                value={memberUserId}
                onChange={(event) => setMemberUserId(event.target.value)}
                placeholder="User ID"
              />
              <Select value={memberRole} onChange={(event) => setMemberRole(event.target.value as WorkspaceMemberRoleType)}>
                <option value="OWNER">OWNER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MEMBER">MEMBER</option>
              </Select>
              <Button onClick={() => addMemberMutation.mutate()} disabled={addMemberMutation.isPending || !memberUserId.trim()}>
                Them
              </Button>
            </div>

            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <div>
                    <p className="font-medium">{member.user.firstName} {member.user.lastName}</p>
                    <p className="text-xs text-muted-foreground">{member.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      defaultValue={member.role}
                      onChange={(event) => {
                        const role = event.target.value as WorkspaceMemberRoleType
                        workspaceApi
                          .updateMemberRole(workspaceId, member.user.userId, role)
                          .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) }))
                          .catch((error: Error) => toast.error('Cap nhat role that bai', { description: error.message }))
                      }}
                    >
                      <option value="OWNER">OWNER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="MEMBER">MEMBER</option>
                    </Select>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        workspaceApi
                          .removeMember(workspaceId, member.user.userId)
                          .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) }))
                          .catch((error: Error) => toast.error('Xoa thanh vien that bai', { description: error.message }))
                      }}
                    >
                      Xoa
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
