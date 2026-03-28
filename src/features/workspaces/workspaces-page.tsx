import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, PanelsTopLeft, Loader2, Users, MoreHorizontal, Pencil } from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { queryKeys } from '@/lib/api/query-keys'

export function WorkspacesPage() {
  const [name, setName] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editWsId, setEditWsId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
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

  const editMutation = useMutation({
    mutationFn: () => {
      if (!editWsId) throw new Error('Workspace không tồn tại')
      return workspaceApi.update(editWsId, { name: editName.trim() })
    },
    onSuccess: () => {
      setEditDialogOpen(false)
      setEditWsId(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      toast.success('Cập nhật workspace thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật workspace thất bại', { description: error.message })
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
            <Card key={ws.id} className="group h-full transition-all hover:border-primary/30 hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Link to={`/workspaces/${ws.id}`} className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    {ws.name.charAt(0).toUpperCase()}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/workspaces/${ws.id}`}>
                      <CardTitle className="truncate text-base hover:text-primary">{ws.name}</CardTitle>
                    </Link>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="size-3" />
                      <span>{ws.owner.firstName} {ws.owner.lastName}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditWsId(ws.id); setEditName(ws.name); setEditDialogOpen(true) }}>
                        <Pencil className="mr-2 size-4" />
                        Chỉnh sửa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <Link to={`/workspaces/${ws.id}`} className="block">
                  <p className="text-xs text-muted-foreground">
                    Tạo lúc: {new Date(ws.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit workspace dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa workspace</DialogTitle>
            <DialogDescription>Đổi tên workspace của bạn.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-ws-name">Tên workspace</Label>
            <Input
              id="edit-ws-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editName.trim()) editMutation.mutate()
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Hủy</Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending || !editName.trim()}>
              {editMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
