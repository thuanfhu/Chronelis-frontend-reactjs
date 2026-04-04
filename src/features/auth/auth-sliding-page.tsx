import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Eye, KeyRound, Loader2, Mail, Phone, UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAuthStore } from '@/app/store/auth-store'
import { authApi, type RegisterPayload } from '@/lib/api/modules/auth-api'
import { loginSchema, registerSchema } from '@/features/auth/auth-schemas'
import '@/features/auth/auth-sliding.css'

type AuthMode = 'sign-in' | 'sign-up'

type LoginFormValues = z.infer<typeof loginSchema>
type RegisterFormValues = z.infer<typeof registerSchema>

interface AuthSlidingPageProps {
  initialMode: AuthMode
}

interface FieldErrorProps {
  message?: string
}

function FieldError({ message }: FieldErrorProps) {
  if (!message) return null
  return <p className="chronelis-auth-error">{message}</p>
}

export function AuthSlidingPage({ initialMode }: AuthSlidingPageProps) {
  const navigate = useNavigate()
  const setSession = useAuthStore((state) => state.setSession)
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const routeSwitchTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => () => {
    if (routeSwitchTimeoutRef.current !== null) {
      window.clearTimeout(routeSwitchTimeoutRef.current)
      routeSwitchTimeoutRef.current = null
    }
  }, [])

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)

    if (routeSwitchTimeoutRef.current !== null) {
      window.clearTimeout(routeSwitchTimeoutRef.current)
    }

    routeSwitchTimeoutRef.current = window.setTimeout(() => {
      navigate(nextMode === 'sign-in' ? '/login' : '/register', { replace: true })
      routeSwitchTimeoutRef.current = null
    }, 420)
  }

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  })

  const registerForm = useForm<RegisterFormValues>({
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

  const registerMutation = useMutation({
    mutationFn: (values: RegisterPayload) => authApi.register(values),
    onSuccess: () => {
      toast.success('Đăng ký thành công', { description: 'Vui lòng kiểm tra email để xác thực tài khoản.' })
      registerForm.reset()
      switchMode('sign-in')
    },
    onError: (error: Error) => {
      toast.error('Đăng ký thất bại', { description: error.message })
    },
  })

  return (
    <div className={`chronelis-auth-page ${mode === 'sign-up' ? 'sign-up-mode' : ''}`}>
      <div className="chronelis-auth-forms-container">
        <div className="chronelis-auth-signin-signup">
          <form className="chronelis-auth-form chronelis-auth-sign-in-form" onSubmit={loginForm.handleSubmit((values) => loginMutation.mutate(values))}>
            <Link to="/login" className="chronelis-auth-brand chronelis-auth-brand--mobile">
              <span className="chronelis-auth-brand-badge">C</span>
              <span className="chronelis-auth-brand-text">Chronelis</span>
            </Link>

            <h2 className="chronelis-auth-title">Đăng nhập</h2>
            <p className="chronelis-auth-subtitle">Truy cập workspace và dự án của bạn</p>

            <div className="chronelis-auth-input-field">
              <Mail className="chronelis-auth-input-icon" />
              <input
                type="text"
                autoComplete="username"
                placeholder="Email hoặc số điện thoại"
                {...loginForm.register('identifier')}
              />
            </div>
            <FieldError message={loginForm.formState.errors.identifier?.message} />

            <div className="chronelis-auth-input-field">
              <KeyRound className="chronelis-auth-input-icon" />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Mật khẩu"
                {...loginForm.register('password')}
              />
            </div>
            <FieldError message={loginForm.formState.errors.password?.message} />

            <div className="chronelis-auth-form-meta">
              <Link to="/forgot-password" className="chronelis-auth-link">Quên mật khẩu?</Link>
            </div>

            <button className="chronelis-auth-btn chronelis-auth-btn--solid" type="submit" disabled={loginMutation.isPending}>
              {loginMutation.isPending && <Loader2 className="chronelis-auth-btn-spinner" />}
              Đăng nhập
            </button>
          </form>

          <form className="chronelis-auth-form chronelis-auth-sign-up-form" onSubmit={registerForm.handleSubmit((values) => registerMutation.mutate(values))}>
            <h2 className="chronelis-auth-title">Đăng ký</h2>
            <p className="chronelis-auth-subtitle">Tạo tài khoản để cộng tác cùng đội nhóm</p>

            <div className="chronelis-auth-grid-2">
              <div>
                <div className="chronelis-auth-input-field">
                  <UserRound className="chronelis-auth-input-icon" />
                  <input
                    type="text"
                    autoComplete="family-name"
                    placeholder="Họ"
                    {...registerForm.register('lastName')}
                  />
                </div>
                <FieldError message={registerForm.formState.errors.lastName?.message} />
              </div>
              <div>
                <div className="chronelis-auth-input-field">
                  <UserRound className="chronelis-auth-input-icon" />
                  <input
                    type="text"
                    autoComplete="given-name"
                    placeholder="Tên"
                    {...registerForm.register('firstName')}
                  />
                </div>
                <FieldError message={registerForm.formState.errors.firstName?.message} />
              </div>
            </div>

            <div className="chronelis-auth-input-field">
              <Mail className="chronelis-auth-input-icon" />
              <input
                type="email"
                autoComplete="email"
                placeholder="Email"
                {...registerForm.register('email')}
              />
            </div>
            <FieldError message={registerForm.formState.errors.email?.message} />

            <div className="chronelis-auth-input-field">
              <Phone className="chronelis-auth-input-icon" />
              <input
                type="tel"
                autoComplete="tel"
                placeholder="Số điện thoại"
                {...registerForm.register('phoneNumber')}
              />
            </div>
            <FieldError message={registerForm.formState.errors.phoneNumber?.message} />

            <div className="chronelis-auth-grid-2">
              <div>
                <div className="chronelis-auth-input-field">
                  <KeyRound className="chronelis-auth-input-icon" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Mật khẩu"
                    {...registerForm.register('password')}
                  />
                </div>
                <FieldError message={registerForm.formState.errors.password?.message} />
              </div>
              <div>
                <div className="chronelis-auth-input-field">
                  <Eye className="chronelis-auth-input-icon" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Xác nhận"
                    {...registerForm.register('confirmPassword')}
                  />
                </div>
                <FieldError message={registerForm.formState.errors.confirmPassword?.message} />
              </div>
            </div>

            <button className="chronelis-auth-btn chronelis-auth-btn--solid" type="submit" disabled={registerMutation.isPending}>
              {registerMutation.isPending && <Loader2 className="chronelis-auth-btn-spinner" />}
              Tạo tài khoản
            </button>
          </form>
        </div>
      </div>

      <div className="chronelis-auth-panels-container">
        <section className="chronelis-auth-panel chronelis-auth-left-panel">
          <div className="chronelis-auth-panel-content">
            <Link to="/login" className="chronelis-auth-brand chronelis-auth-brand--desktop">
              <span className="chronelis-auth-brand-badge">C</span>
              <span className="chronelis-auth-brand-text">Chronelis</span>
            </Link>
            <h3>Bạn mới đến Chronelis?</h3>
            <p>
              Tạo tài khoản để bắt đầu quản lý workspace, theo dõi tiến độ và cộng tác realtime cùng đội nhóm.
            </p>
            <button type="button" className="chronelis-auth-btn chronelis-auth-btn--ghost" onClick={() => switchMode('sign-up')}>
              Đăng ký
            </button>
          </div>
        </section>

        <section className="chronelis-auth-panel chronelis-auth-right-panel">
          <div className="chronelis-auth-panel-content">
            <h3>Đã có tài khoản?</h3>
            <p>
              Đăng nhập để tiếp tục xử lý task, kế hoạch lịch và cập nhật tiến độ cho dự án của bạn.
            </p>
            <button type="button" className="chronelis-auth-btn chronelis-auth-btn--ghost" onClick={() => switchMode('sign-in')}>
              Đăng nhập
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
