import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
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
      toast.success('Da gui email dat lai mat khau')
    },
    onError: (error: Error) => {
      toast.error('Gui email that bai', { description: error.message })
    },
  })

  return (
    <AuthLayout title="Quen mat khau" subtitle="Nhap email da dang ky de nhan lien ket reset mat khau">
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => forgotMutation.mutate(values))}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" {...form.register('email')} />
          {form.formState.errors.email ? <p className="text-xs text-destructive">{form.formState.errors.email.message}</p> : null}
        </div>

        <Button className="w-full" type="submit" disabled={forgotMutation.isPending}>
          {forgotMutation.isPending ? 'Dang gui...' : 'Gui email'}
        </Button>
      </form>

      <Link className="mt-4 inline-block text-sm text-primary hover:underline" to="/login">
        Quay lai dang nhap
      </Link>
    </AuthLayout>
  )
}
