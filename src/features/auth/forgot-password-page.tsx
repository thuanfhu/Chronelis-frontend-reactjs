import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { authApi } from '@/lib/api/modules/auth-api'
import { forgotPasswordSchema } from '@/features/auth/auth-schemas'
import { AuthSharedShell } from '@/features/auth/auth-shared-shell'
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
  const shellClassName = cn(
    'forgot-standalone-mode',
    fromAuthSlide && 'forgot-from-auth-enter',
    isLeavingToLogin && 'forgot-to-login-leave',
  )

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
    <AuthSharedShell
      pageClassName={shellClassName}
      formsClassName="chronelis-auth-signin-signup--forgot"
      leftPanel={(
        <>
          <Link to="/login" className="chronelis-auth-brand chronelis-auth-brand--desktop">
            <span className="chronelis-auth-brand-badge">C</span>
            <span className="chronelis-auth-brand-text">Chronelis</span>
          </Link>
          <h3>Cần lấy lại mật khẩu?</h3>
          <p>
            Nhập email bạn đã dùng đăng ký, Chronelis sẽ gửi liên kết đặt lại mật khẩu đến hộp thư ngay lập tức.
          </p>
        </>
      )}
      rightPanel={(
        <>
          <h3>Đã nhớ mật khẩu?</h3>
          <p>
            Quay về đăng nhập để tiếp tục quản lý workspace, dự án và theo dõi tiến độ công việc của bạn.
          </p>
          <button type="button" className="chronelis-auth-btn chronelis-auth-btn--ghost" onClick={handleBackToLogin}>
            Đăng nhập
          </button>
        </>
      )}
    >
      <form className="chronelis-auth-form chronelis-auth-forgot-form" onSubmit={form.handleSubmit((values) => forgotMutation.mutate(values))}>
        <Link to="/login" className="chronelis-auth-brand chronelis-auth-brand--mobile">
          <span className="chronelis-auth-brand-badge">C</span>
          <span className="chronelis-auth-brand-text">Chronelis</span>
        </Link>

        <h2 className="chronelis-auth-title">Quên mật khẩu</h2>
        <p className="chronelis-auth-subtitle">Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu.</p>

        {forgotMutation.isSuccess ? (
          <div className="chronelis-auth-forgot-success">
            <div className="chronelis-auth-forgot-success-icon">
              <Mail className="size-5" />
            </div>
            <p className="chronelis-auth-forgot-success-title">Kiểm tra email của bạn</p>
            <p className="chronelis-auth-forgot-success-description">
              Chúng tôi đã gửi liên kết đặt lại mật khẩu đến hộp thư của bạn.
            </p>

            <button type="button" className="chronelis-auth-btn chronelis-auth-btn--solid" onClick={handleBackToLogin}>
              <ArrowLeft className="size-4" />
              Quay lại đăng nhập
            </button>
          </div>
        ) : (
          <>
            <div className="chronelis-auth-input-field">
              <Mail className="chronelis-auth-input-icon" />
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="name@gmail.com"
                {...form.register('email')}
              />
            </div>
            {form.formState.errors.email && <p className="chronelis-auth-error">{form.formState.errors.email.message}</p>}

            <button className="chronelis-auth-btn chronelis-auth-btn--solid" type="submit" disabled={forgotMutation.isPending}>
              {forgotMutation.isPending && <Loader2 className="chronelis-auth-btn-spinner" />}
              Gửi email đặt lại
            </button>
          </>
        )}

        <div className="chronelis-auth-mobile-switch chronelis-auth-mobile-switch--always">
          <span>Đã nhớ mật khẩu?</span>
          <button type="button" className="chronelis-auth-mobile-switch-trigger" onClick={handleBackToLogin}>
            Quay lại đăng nhập
          </button>
        </div>
      </form>
    </AuthSharedShell>
  )
}
