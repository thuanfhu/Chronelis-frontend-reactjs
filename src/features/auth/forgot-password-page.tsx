import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { authApi } from '@/lib/api/modules/auth-api'
import { forgotPasswordSchema } from '@/features/auth/auth-schemas'
import { AuthLayout } from '@/features/auth/auth-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface ForgotPayload {
  email: string
}

export function ForgotPasswordPage() {
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

  return (
    <AuthLayout title="Quên mật khẩu" subtitle="Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu">
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
          <Link to="/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="mr-2 size-4" />
              Quay lại đăng nhập
            </Button>
          </Link>
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
            <Link className="font-medium text-primary hover:underline" to="/login">
              <ArrowLeft className="mr-1 inline size-3" />
              Quay lại đăng nhập
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
