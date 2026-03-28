import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { authApi, type LoginPayload } from '@/lib/api/modules/auth-api'
import { useAuthStore } from '@/app/store/auth-store'
import { AuthLayout } from '@/features/auth/auth-layout'
import { loginSchema } from '@/features/auth/auth-schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((state) => state.setSession)

  const form = useForm<LoginPayload>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      phoneNumber: '',
      password: '',
    },
  })

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setSession({
        accessToken: data.accessToken,
        currentUser: data.userSecured,
      })
      toast.success('Dang nhap thanh cong')
      navigate('/dashboard', { replace: true })
    },
    onError: (error: Error) => {
      toast.error('Dang nhap that bai', { description: error.message })
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    loginMutation.mutate(values)
  })

  return (
    <AuthLayout title="Dang nhap" subtitle="Quan ly workspace, task va lich trinh trong Chronelis">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email (tuy chon)</Label>
          <Input id="email" placeholder="name@gmail.com" {...form.register('email')} />
          {form.formState.errors.email ? <p className="text-xs text-destructive">{form.formState.errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phoneNumber">So dien thoai (tuy chon)</Label>
          <Input id="phoneNumber" placeholder="098xxxxxxx" {...form.register('phoneNumber')} />
          {form.formState.errors.phoneNumber ? <p className="text-xs text-destructive">{form.formState.errors.phoneNumber.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mat khau</Label>
          <Input id="password" type="password" {...form.register('password')} />
          {form.formState.errors.password ? <p className="text-xs text-destructive">{form.formState.errors.password.message}</p> : null}
        </div>

        <Button className="w-full" type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Dang dang nhap...' : 'Dang nhap'}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link className="text-primary hover:underline" to="/forgot-password">
          Quen mat khau
        </Link>
        <Link className="text-primary hover:underline" to="/register">
          Tao tai khoan
        </Link>
      </div>
    </AuthLayout>
  )
}
