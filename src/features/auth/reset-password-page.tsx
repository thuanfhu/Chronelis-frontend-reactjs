import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { authApi, type ResetPasswordPayload } from '@/lib/api/modules/auth-api'
import { resetPasswordSchema } from '@/features/auth/auth-schemas'
import { AuthLayout } from '@/features/auth/auth-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { resolveAuthToken } from '@/features/auth/auth-token'

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const tokenFromQuery = useMemo(() => resolveAuthToken(searchParams), [searchParams])

  const form = useForm<ResetPasswordPayload>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: tokenFromQuery,
      newPassword: '',
      confirmPassword: '',
    },
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    form.setValue('token', tokenFromQuery)
  }, [form, tokenFromQuery])

  const mutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      toast.success(t('auth.resetSuccessTitle'))
    },
    onError: (error: Error) => {
      toast.error(t('auth.resetFailTitle'), { description: error.message })
    },
  })

  return (
    <AuthLayout title={t('auth.resetPasswordTitle')} subtitle={t('auth.resetPasswordDescription')}>
      {mutation.isSuccess ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="size-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium">{t('auth.passwordUpdated')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('auth.passwordUpdatedDesc')}</p>
          </div>
          <Link to="/login">
            <Button className="w-full">{t('auth.loginNow')}</Button>
          </Link>
        </div>
      ) : (
        <>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <input type="hidden" {...form.register('token')} />

            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('auth.newPassword')}</Label>
              <div className="relative">
                <Input id="newPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...form.register('newPassword')} />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 inline-flex w-9 items-center justify-center text-muted-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {form.formState.errors.newPassword && <p className="text-xs text-destructive">{form.formState.errors.newPassword.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
              <div className="relative">
                <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" {...form.register('confirmPassword')} />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 inline-flex w-9 items-center justify-center text-muted-foreground"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {form.formState.errors.confirmPassword && <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>}
            </div>

            <Button className="w-full" type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('auth.resetPassword')}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link className="font-medium text-primary hover:underline" to="/login">
              <ArrowLeft className="mr-1 inline size-3" />
              {t('auth.backToLogin')}
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
