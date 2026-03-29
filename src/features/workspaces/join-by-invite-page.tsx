import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { workspaceInviteApi } from '@/lib/api/modules/workspace-invite-api'

export function JoinByInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code') ?? ''

  const validateQuery = useQuery({
    queryKey: ['invite', 'validate', code],
    queryFn: () => workspaceInviteApi.validate(code),
    enabled: !!code,
    retry: false,
  })

  const joinMutation = useMutation({
    mutationFn: () => workspaceInviteApi.join({ inviteCode: code }),
    onSuccess: () => {
      toast.success('Tham gia workspace thành công!')
      navigate('/workspaces')
    },
    onError: (error: Error) => {
      toast.error('Tham gia thất bại', { description: error.message })
    },
  })

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="mb-3 size-10 text-destructive" />
            <p className="text-sm font-medium">Invite code không hợp lệ</p>
            <Button variant="link" className="mt-2" onClick={() => navigate('/dashboard')}>
              Về trang chủ
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const invite = validateQuery.data

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Tham gia Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {validateQuery.isLoading && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Đang xác thực invite...</p>
            </div>
          )}

          {validateQuery.isError && (
            <div className="flex flex-col items-center py-8">
              <XCircle className="mb-3 size-10 text-destructive" />
              <p className="text-sm font-medium">Invite không hợp lệ hoặc đã hết hạn</p>
              <Button variant="link" className="mt-2" onClick={() => navigate('/dashboard')}>
                Về trang chủ
              </Button>
            </div>
          )}

          {invite && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
                <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                  {invite.workspaceName.charAt(0).toUpperCase()}
                </div>
                <p className="text-lg font-semibold">{invite.workspaceName}</p>
                <Badge variant="outline">{invite.roleToAssign}</Badge>
              </div>

              <Button
                className="w-full"
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
              >
                {joinMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 size-4" />
                )}
                Tham gia workspace
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
