import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, PanelsTopLeft, ArrowRight, Loader2, Users } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { queryKeys } from '@/lib/api/query-keys'

export function WorkspacesPage() {
  const [name, setName] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: queryKeys.workspaces.list(1, 30),
    queryFn: () => workspaceApi.list({ page: 1, size: 30 }),
  })

  const createMutation = useMutation({
    mutationFn: workspaceApi.create,
    onSuccess: () => {
      setName('')
      setDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      toast.success('Tạo workspace thành công')
    },
    onError: (error: unknown) => {
      const description = error instanceof Error ? error.message : 'Đã xảy ra lỗi không mong muốn, vui lòng thử lại.'
      toast.error('Tạo workspace thất bại', { description })
    },
  })

  const workspaces = listQuery.data?.content ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspaces"
        description="Không gian làm việc cho đội nhóm và dự án"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1.5 size-4" />
                Tạo workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tạo workspace mới</DialogTitle>
                <DialogDescription>Workspace là không gian chứa các project và thành viên của bạn.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="ws-name">Tên workspace</Label>
                <Input
                  id="ws-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Team Product"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) {
                      createMutation.mutate({ name: name.trim() })
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
                <Button
                  onClick={() => createMutation.mutate({ name: name.trim() })}
                  disabled={createMutation.isPending || !name.trim()}
                >
                  {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Tạo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {listQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <PanelsTopLeft className="mb-4 size-12 text-muted-foreground/30" />
            <h3 className="text-base font-semibold">Chưa có workspace nào</h3>
            <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
              Tạo workspace đầu tiên để bắt đầu tổ chức dự án và cộng tác với đội nhóm.
            </p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Tạo workspace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((ws) => (
            <Link key={ws.id} to={`/workspaces/${ws.id}`}>
              <Card className="group h-full transition-all hover:border-primary/30 hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      {ws.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base">{ws.name}</CardTitle>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="size-3" />
                        <span>{ws.owner.firstName} {ws.owner.lastName}</span>
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Tạo lúc: {new Date(ws.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
