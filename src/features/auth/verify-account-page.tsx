import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { authApi } from '@/lib/api/modules/auth-api'
import { useAuthStore } from '@/app/store/auth-store'
import { AuthLayout } from '@/features/auth/auth-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function VerifyAccountPage() {
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState(searchParams.get('token') ?? '')
  const setSession = useAuthStore((state) => state.setSession)
  const navigate = useNavigate()

  const verifyMutation = useMutation({
    mutationFn: (value: string) => authApi.verifyActiveAccount({ token: value }),
    onSuccess: (data) => {
      setSession({
        accessToken: data.accessToken,
        currentUser: data.userSecured,
      })
      toast.success('Xac thuc tai khoan thanh cong')
      navigate('/dashboard', { replace: true })
    },
    onError: (error: Error) => {
      toast.error('Xac thuc that bai', { description: error.message })
    },
  })

  return (
    <AuthLayout title="Xac thuc tai khoan" subtitle="Dinh kem token tu email kich hoat cua ban">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="token">Token kich hoat</Label>
          <Input id="token" value={token} onChange={(event) => setToken(event.target.value)} />
        </div>

        <Button className="w-full" onClick={() => verifyMutation.mutate(token)} disabled={verifyMutation.isPending || !token}>
          {verifyMutation.isPending ? 'Dang xac thuc...' : 'Xac thuc tai khoan'}
        </Button>
      </div>
    </AuthLayout>
  )
}
