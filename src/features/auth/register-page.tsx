import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
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
      toast.success('Dang ky thanh cong, vui long kiem tra email de xac thuc')
      navigate('/login', { replace: true })
    },
    onError: (error: Error) => {
      toast.error('Dang ky that bai', { description: error.message })
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    registerMutation.mutate(values)
  })

  return (
    <AuthLayout title="Tao tai khoan" subtitle="Dang ky de su dung he thong quan tri cong viec Chronelis">
      <form className="space-y-3" onSubmit={onSubmit}>
        <TwoColumns>
          <Field label="Ho" id="lastName" error={form.formState.errors.lastName?.message}>
            <Input id="lastName" {...form.register('lastName')} />
          </Field>
          <Field label="Ten" id="firstName" error={form.formState.errors.firstName?.message}>
            <Input id="firstName" {...form.register('firstName')} />
          </Field>
        </TwoColumns>

        <Field label="Email" id="email" error={form.formState.errors.email?.message}>
          <Input id="email" {...form.register('email')} />
        </Field>

        <Field label="So dien thoai" id="phoneNumber" error={form.formState.errors.phoneNumber?.message}>
          <Input id="phoneNumber" {...form.register('phoneNumber')} />
        </Field>

        <TwoColumns>
          <Field label="Mat khau" id="password" error={form.formState.errors.password?.message}>
            <Input id="password" type="password" {...form.register('password')} />
          </Field>
          <Field label="Xac nhan" id="confirmPassword" error={form.formState.errors.confirmPassword?.message}>
            <Input id="confirmPassword" type="password" {...form.register('confirmPassword')} />
          </Field>
        </TwoColumns>

        <Button className="w-full" type="submit" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? 'Dang tao tai khoan...' : 'Dang ky'}
        </Button>
      </form>

      <p className="mt-4 text-sm text-muted-foreground">
        Da co tai khoan?{' '}
        <Link className="text-primary hover:underline" to="/login">
          Dang nhap ngay
        </Link>
      </p>
    </AuthLayout>
  )
}

function TwoColumns({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
