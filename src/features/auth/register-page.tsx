import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { authApi, type RegisterPayload } from '@/lib/api/modules/auth-api'
import { registerSchema } from '@/features/auth/auth-schemas'
import { AuthLayout } from '@/features/auth/auth-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function RegisterPage() {
  const navigate = useNavigate()

  const form = useForm<RegisterPayload>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      phoneNumber: '',
      firstName: '',
      lastName: '',
      password: '',
      confirmPassword: '',
    },
  })

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      toast.success('Đăng ký thành công', { description: 'Vui lòng kiểm tra email để xác thực tài khoản.' })
      navigate('/login', { replace: true })
    },
    onError: (error: Error) => {
      toast.error('Đăng ký thất bại', { description: error.message })
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    registerMutation.mutate(values)
  })

  return (
    <AuthLayout title="Tạo tài khoản" subtitle="Đăng ký để bắt đầu quản lý công việc cùng đội nhóm">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Họ" id="lastName" error={form.formState.errors.lastName?.message}>
            <Input id="lastName" placeholder="Nguyễn" autoComplete="family-name" {...form.register('lastName')} />
          </Field>
          <Field label="Tên" id="firstName" error={form.formState.errors.firstName?.message}>
            <Input id="firstName" placeholder="Văn A" autoComplete="given-name" {...form.register('firstName')} />
          </Field>
        </div>

        <Field label="Email" id="email" error={form.formState.errors.email?.message}>
          <Input id="email" placeholder="name@gmail.com" autoComplete="email" {...form.register('email')} />
        </Field>

        <Field label="Số điện thoại" id="phoneNumber" error={form.formState.errors.phoneNumber?.message}>
          <Input id="phoneNumber" placeholder="098xxxxxxx" autoComplete="tel" {...form.register('phoneNumber')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mật khẩu" id="password" error={form.formState.errors.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
          </Field>
          <Field label="Xác nhận mật khẩu" id="confirmPassword" error={form.formState.errors.confirmPassword?.message}>
            <Input id="confirmPassword" type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
          </Field>
        </div>

        <Button className="w-full" type="submit" disabled={registerMutation.isPending}>
          {registerMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Đăng ký
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Đã có tài khoản?{' '}
        <Link className="font-medium text-primary hover:underline" to="/login">Đăng nhập ngay</Link>
      </p>
    </AuthLayout>
  )
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
