import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { authApi } from '@/lib/api/modules/auth-api'
import { forgotPasswordSchema } from '@/features/auth/auth-schemas'
import { AuthLayout } from '@/features/auth/auth-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import '@/features/auth/auth-sliding.css'

const FORGOT_TO_LOGIN_DELAY_MS = 320

interface ForgotPayload {
  email: string
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const form = useForm<ForgotPayload>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  const forgotMutation = useMutation({
    mutationFn: (payload: ForgotPayload) => authApi.forgotPassword(payload.email),
    onSuccess: () => {
      toast.success('Đã gửi email đặt lại mật khẩu', { description: 'Vui lòng kiểm tra hộp thư của bạn.' })
    },
    onError: (error: Error) => {
      toast.error('Gửi email thất bại', { description: error.message })
    },
  })

  const leaveTimeoutRef = useRef<number | null>(null)
  const [isLeavingToLogin, setIsLeavingToLogin] = useState(false)
  const fromAuthSlide = Boolean((location.state as { fromAuthSlide?: boolean } | null)?.fromAuthSlide)

  useEffect(() => () => {
    if (leaveTimeoutRef.current !== null) {
      window.clearTimeout(leaveTimeoutRef.current)
      leaveTimeoutRef.current = null
    }
  }, [])

  const handleBackToLogin = () => {
    if (isLeavingToLogin) {
      return
    }

    setIsLeavingToLogin(true)
    leaveTimeoutRef.current = window.setTimeout(() => {
      navigate('/login', { replace: true, state: { fromForgot: true } })
      leaveTimeoutRef.current = null
    }, FORGOT_TO_LOGIN_DELAY_MS)
  }

  return (
    <AuthLayout title="Quên mật khẩu" subtitle="Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu">
      <div
        className={cn(
          'chronelis-forgot-shell',
          fromAuthSlide && 'chronelis-forgot-shell--enter',
          isLeavingToLogin && 'chronelis-forgot-shell--leaving',
        )}
      >
        {forgotMutation.isSuccess ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Kiểm tra email của bạn</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Chúng tôi đã gửi liên kết đặt lại mật khẩu đến email của bạn.
              </p>
            </div>
            <Button variant="outline" className="w-full" type="button" onClick={handleBackToLogin}>
              <ArrowLeft className="mr-2 size-4" />
              Quay lại đăng nhập
            </Button>
          </div>
        ) : (
          <>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => forgotMutation.mutate(values))}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" placeholder="name@gmail.com" autoComplete="email" {...form.register('email')} />
                {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
              </div>

              <Button className="w-full" type="submit" disabled={forgotMutation.isPending}>
                {forgotMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Gửi email đặt lại
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <button type="button" className="font-medium text-primary hover:underline" onClick={handleBackToLogin}>
                <ArrowLeft className="mr-1 inline size-3" />
                Quay lại đăng nhập
              </button>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
