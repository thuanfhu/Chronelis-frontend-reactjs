import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, XCircle } from 'lucide-react'
import { authApi } from '@/lib/api/modules/auth-api'
import { AuthLayout } from '@/features/auth/auth-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { resolveAuthToken } from '@/features/auth/auth-token'

export function VerifyAccountPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const tokenFromQuery = useMemo(() => resolveAuthToken(searchParams), [searchParams])
  const [token, setToken] = useState(tokenFromQuery)
  const autoSubmitRef = useRef(false)
  const navigate = useNavigate()

  const verifyMutation = useMutation({
    mutationFn: (value: string) => authApi.verifyActiveAccount({ token: value }),
    onSuccess: () => {
      toast.success(t('auth.verifySuccessTitle'), { description: t('auth.verifySuccessDesc') })
      navigate('/login', { replace: true })
    },
    onError: (error: Error) => {
      toast.error(t('auth.verifyFailTitle'), { description: error.message })
    },
  })

  useEffect(() => {
    setToken(tokenFromQuery)
  }, [tokenFromQuery])

  useEffect(() => {
    if (!tokenFromQuery || autoSubmitRef.current) {
      return
    }

    autoSubmitRef.current = true
    verifyMutation.mutate(tokenFromQuery)
  }, [tokenFromQuery, verifyMutation])

  return (
    <AuthLayout title={t('auth.verifyAccountTitle')} subtitle={t('auth.verifyAccountSubtitle')}>
      {verifyMutation.isPending ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('auth.verifying')}</p>
        </div>
      ) : verifyMutation.isError ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="size-6 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">{t('auth.verifyFailRetry')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="token">{t('auth.verificationCode')}</Label>
            <Input id="token" value={token} onChange={(event) => setToken(event.target.value)} placeholder={t('auth.enterCodePlaceholder')} />
          </div>
          <Button className="w-full" onClick={() => verifyMutation.mutate(token)} disabled={!token.trim()}>
            {t('auth.retry')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">{t('auth.verificationCode')}</Label>
            <Input id="token" value={token} onChange={(event) => setToken(event.target.value)} placeholder={t('auth.enterCodePlaceholder')} />
          </div>
          <Button className="w-full" onClick={() => verifyMutation.mutate(token)} disabled={!token.trim()}>
            {t('auth.verifyAccount')}
          </Button>
        </div>
      )}
    </AuthLayout>
  )
}
