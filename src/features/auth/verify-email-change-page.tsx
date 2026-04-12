import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useAuthStore } from '@/app/store/auth-store'
import { AuthLayout } from '@/features/auth/auth-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { userApi } from '@/lib/api/modules/user-api'

export function VerifyEmailChangePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const clearSession = useAuthStore((state) => state.clearSession)

  const [token, setToken] = useState(searchParams.get('token') ?? '')

  const mutation = useMutation({
    mutationFn: (value: string) => userApi.verifyChangeEmail({ token: value }),
    onSuccess: () => {
      clearSession()
      toast.success('Cập nhật email thành công', { description: 'Vui lòng đăng nhập lại bằng email mới.' })
    },
    onError: (error: Error) => {
      toast.error('Xác thực đổi email thất bại', { description: error.message })
    },
  })

  useEffect(() => {
    const queryToken = searchParams.get('token')
    if (queryToken && !mutation.isPending && !mutation.isSuccess && !mutation.isError) {
      mutation.mutate(queryToken)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthLayout
      title="Xác thực đổi email"
      subtitle="Xác nhận token trong email để hoàn tất cập nhật địa chỉ đăng nhập"
    >
      {mutation.isPending ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Đang xác thực đổi email...</p>
        </div>
      ) : mutation.isSuccess ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="size-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium">Email đã được cập nhật</p>
            <p className="mt-1 text-sm text-muted-foreground">Vui lòng đăng nhập lại bằng email mới để tiếp tục.</p>
          </div>
          <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
            Đăng nhập lại
          </Button>
        </div>
      ) : mutation.isError ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="size-6 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">Token không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verify-change-token">Token xác thực</Label>
            <Input
              id="verify-change-token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Nhập token từ email"
            />
          </div>

          <Button className="w-full" disabled={!token.trim()} onClick={() => mutation.mutate(token.trim())}>
            Xác thực lại
          </Button>

          <Link to="/profile" className="block text-center text-sm text-primary hover:underline">
            <ArrowLeft className="mr-1 inline size-3" />
            Quay lại hồ sơ
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verify-change-token">Token xác thực</Label>
            <Input
              id="verify-change-token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Nhập token từ email"
            />
          </div>

          <Button className="w-full" disabled={!token.trim()} onClick={() => mutation.mutate(token.trim())}>
            Xác thực đổi email
          </Button>

          <Link to="/profile" className="block text-center text-sm text-primary hover:underline">
            <ArrowLeft className="mr-1 inline size-3" />
            Quay lại hồ sơ
          </Link>
        </div>
      )}
    </AuthLayout>
  )
}
