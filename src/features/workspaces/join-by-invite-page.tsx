import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { workspaceInviteApi } from '@/lib/api/modules/workspace-invite-api'

export function JoinByInvitePage() {
  const { t } = useTranslation()
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
      toast.success(t('workspace.join.success'))
      navigate('/workspaces')
    },
    onError: (error: Error) => {
      toast.error(t('workspace.join.action'), { description: error.message })
    },
  })

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="mb-3 size-10 text-destructive" />
            <p className="text-sm font-medium">{t('workspace.join.invalidCode')}</p>
            <Button variant="link" className="mt-2" onClick={() => navigate('/dashboard')}>
              {t('workspace.join.backHome')}
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
          <CardTitle>{t('workspace.join.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {validateQuery.isLoading && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">{t('workspace.join.loading')}</p>
            </div>
          )}

          {validateQuery.isError && (
            <div className="flex flex-col items-center py-8">
              <XCircle className="mb-3 size-10 text-destructive" />
              <p className="text-sm font-medium">{t('workspace.join.invalidInvite')}</p>
              <Button variant="link" className="mt-2" onClick={() => navigate('/dashboard')}>
                {t('workspace.join.backHome')}
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
                {t('workspace.join.action')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
