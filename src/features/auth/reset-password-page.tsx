import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { authApi, type ResetPasswordPayload } from '@/lib/api/modules/auth-api'
import { resetPasswordSchema } from '@/features/auth/auth-schemas'
import { AuthLayout } from '@/features/auth/auth-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const tokenFromQuery = searchParams.get('token') ?? ''

  const form = useForm<ResetPasswordPayload>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: tokenFromQuery,
      newPassword: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    form.setValue('token', tokenFromQuery)
  }, [form, tokenFromQuery])

  const mutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      toast.success('Dat lai mat khau thanh cong')
    },
    onError: (error: Error) => {
      toast.error('Dat lai mat khau that bai', { description: error.message })
    },
  })

  return (
    <AuthLayout title="Dat lai mat khau" subtitle="Nhap token va mat khau moi theo dung quy tac backend">
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div className="space-y-1.5">
          <Label htmlFor="token">Token</Label>
          <Input id="token" {...form.register('token')} />
          {form.formState.errors.token ? <p className="text-xs text-destructive">{form.formState.errors.token.message}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Mat khau moi</Label>
          <Input id="newPassword" type="password" {...form.register('newPassword')} />
          {form.formState.errors.newPassword ? <p className="text-xs text-destructive">{form.formState.errors.newPassword.message}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Xac nhan mat khau</Label>
          <Input id="confirmPassword" type="password" {...form.register('confirmPassword')} />
          {form.formState.errors.confirmPassword ? <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p> : null}
        </div>

        <Button className="w-full" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Dang cap nhat...' : 'Dat lai mat khau'}
        </Button>
      </form>

      <Link className="mt-4 inline-block text-sm text-primary hover:underline" to="/login">
        Quay lai dang nhap
      </Link>
    </AuthLayout>
  )
}
