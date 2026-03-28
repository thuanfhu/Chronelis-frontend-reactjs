import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { queryKeys } from '@/lib/api/query-keys'

export function WorkspacesPage() {
  const [name, setName] = useState('')
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: queryKeys.workspaces.list(1, 30),
    queryFn: () => workspaceApi.list({ page: 1, size: 30 }),
  })

  const createMutation = useMutation({
    mutationFn: workspaceApi.create,
    onSuccess: () => {
      setName('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      toast.success('Tao workspace thanh cong')
    },
    onError: (error: Error) => {
      toast.error('Tao workspace that bai', { description: error.message })
    },
  })

  if (listQuery.isLoading) {
    return <LoadingPanel />
  }

  const workspaces = listQuery.data?.content ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workspaces"
        description="Khong gian cong viec trung tam cho team va project"
        actions={
          <div className="flex items-center gap-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ten workspace" />
            <Button
              onClick={() => createMutation.mutate({ name })}
              disabled={createMutation.isPending || name.trim().length === 0}
            >
              <Plus className="mr-2 size-4" />
              Tao
            </Button>
          </div>
        }
      />

      {workspaces.length === 0 ? (
        <EmptyState
          title="Chua co workspace"
          description="Tao workspace dau tien de bat dau quan ly cong viec theo backend Chronelis."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace) => (
            <Card key={workspace.id} className="transition-transform hover:-translate-y-0.5">
              <CardHeader>
                <CardTitle className="line-clamp-1">{workspace.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">Owner: {workspace.owner.firstName} {workspace.owner.lastName}</p>
                <Button className="w-full" variant="outline">
                  <Link className="w-full" to={`/workspaces/${workspace.id}`}>
                    Mo workspace
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
