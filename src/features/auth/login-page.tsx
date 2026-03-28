import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'
import { authApi } from '@/lib/api/modules/auth-api'
import { useAuthStore } from '@/app/store/auth-store'
import { AuthLayout } from '@/features/auth/auth-layout'
import { loginSchema } from '@/features/auth/auth-schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((state) => state.setSession)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  })

  const loginMutation = useMutation({
    mutationFn: (values: LoginFormValues) => {
      const trimmed = values.identifier.trim()
      const isEmail = trimmed.includes('@')
      return authApi.login({
        email: isEmail ? trimmed : undefined,
        phoneNumber: isEmail ? undefined : trimmed,
        password: values.password,
      })
    },
    onSuccess: (data) => {
      setSession({
        accessToken: data.accessToken,
        currentUser: data.userSecured,
      })
      toast.success('Đăng nhập thành công')
      navigate('/dashboard', { replace: true })
    },
    onError: (error: Error) => {
      toast.error('Đăng nhập thất bại', { description: error.message })
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    loginMutation.mutate(values)
  })

  return (
    <AuthLayout title="Đăng nhập" subtitle="Nhập thông tin để truy cập workspace của bạn">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="identifier">Email hoặc số điện thoại</Label>
          <Input id="identifier" placeholder="name@gmail.com hoặc 098xxxxxxx" autoComplete="username" {...form.register('identifier')} />
          {form.formState.errors.identifier && <p className="text-xs text-destructive">{form.formState.errors.identifier.message}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mật khẩu</Label>
            <Link className="text-xs text-primary hover:underline" to="/forgot-password">Quên mật khẩu?</Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
          {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
        </div>

        <Button className="w-full" type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Đăng nhập
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{' '}
        <Link className="font-medium text-primary hover:underline" to="/register">Đăng ký ngay</Link>
      </p>
    </AuthLayout>
  )
}
