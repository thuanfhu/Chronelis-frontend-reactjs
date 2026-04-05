import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, KeyRound, Loader2, Mail, Phone, UserRound } from 'lucide-react'
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

const ROUTE_SWITCH_DELAY_MS = 680
const FORGOT_TRANSITION_DELAY_MS = 420

type PasswordStrengthLevel = 'weak' | 'fair' | 'good' | 'strong' | 'very-strong'

interface PasswordStrengthResult {
  level: PasswordStrengthLevel
  score: number
  label: string
  helper: string
}

function resolvePasswordStrength(password: string): PasswordStrengthResult {
  const checks = [
    password.length >= 8,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[@$!%*?&]/.test(password),
  ]

  const score = checks.filter(Boolean).length

  if (score <= 1) {
    return {
      level: 'weak',
      score,
      label: 'Yếu',
      helper: 'Cần thêm độ dài và đa dạng ký tự',
    }
  }

  if (score === 2) {
    return {
      level: 'fair',
      score,
      label: 'Tạm ổn',
      helper: 'Nên thêm chữ hoa, số và ký tự đặc biệt',
    }
  }

  if (score === 3) {
    return {
      level: 'good',
      score,
      label: 'Khá',
      helper: 'Thêm 1-2 tiêu chí nữa để mạnh hơn',
    }
  }

  if (score === 4) {
    return {
      level: 'strong',
      score,
      label: 'Mạnh',
      helper: 'Đã gần đạt chuẩn bảo mật cao',
    }
  }

  return {
    level: 'very-strong',
    score,
    label: 'Rất mạnh',
    helper: 'Mật khẩu đáp ứng đầy đủ tiêu chí',
  }
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
  const [isForgotTransitioning, setIsForgotTransitioning] = useState(false)
  const [showSignInPassword, setShowSignInPassword] = useState(false)
  const [showSignUpPassword, setShowSignUpPassword] = useState(false)
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false)
  const routeSwitchTimeoutRef = useRef<number | null>(null)
  const forgotTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => () => {
    if (routeSwitchTimeoutRef.current !== null) {
      window.clearTimeout(routeSwitchTimeoutRef.current)
      routeSwitchTimeoutRef.current = null
    }

    if (forgotTimeoutRef.current !== null) {
      window.clearTimeout(forgotTimeoutRef.current)
      forgotTimeoutRef.current = null
    }
  }, [])

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode === mode) {
      return
    }

    setIsForgotTransitioning(false)
    setMode(nextMode)

    if (routeSwitchTimeoutRef.current !== null) {
      window.clearTimeout(routeSwitchTimeoutRef.current)
    }

    routeSwitchTimeoutRef.current = window.setTimeout(() => {
      navigate(nextMode === 'sign-in' ? '/login' : '/register', { replace: true })
      routeSwitchTimeoutRef.current = null
    }, ROUTE_SWITCH_DELAY_MS)
  }

  const handleForgotTransition = () => {
    if (isForgotTransitioning) {
      return
    }

    if (routeSwitchTimeoutRef.current !== null) {
      window.clearTimeout(routeSwitchTimeoutRef.current)
      routeSwitchTimeoutRef.current = null
    }

    if (forgotTimeoutRef.current !== null) {
      window.clearTimeout(forgotTimeoutRef.current)
    }

    setIsForgotTransitioning(true)
    forgotTimeoutRef.current = window.setTimeout(() => {
      navigate('/forgot-password')
      forgotTimeoutRef.current = null
    }, FORGOT_TRANSITION_DELAY_MS)
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

  const signUpPassword = registerForm.watch('password')
  const passwordStrength = resolvePasswordStrength(signUpPassword)
  const strengthPercent = Math.max((passwordStrength.score / 5) * 100, 8)

  return (
    <div className={`chronelis-auth-page ${mode === 'sign-up' ? 'sign-up-mode' : ''} ${isForgotTransitioning ? 'forgot-mode' : ''}`}>
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

            <div className="chronelis-auth-input-field chronelis-auth-input-field--password">
              <KeyRound className="chronelis-auth-input-icon" />
              <input
                type={showSignInPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Mật khẩu"
                {...loginForm.register('password')}
              />
              <button
                type="button"
                className="chronelis-auth-input-toggle"
                onClick={() => setShowSignInPassword((prev) => !prev)}
                aria-label={showSignInPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showSignInPassword ? <EyeOff className="chronelis-auth-input-icon" /> : <Eye className="chronelis-auth-input-icon" />}
              </button>
            </div>
            <FieldError message={loginForm.formState.errors.password?.message} />

            <div className="chronelis-auth-form-meta">
              <button type="button" className="chronelis-auth-link" onClick={handleForgotTransition}>Quên mật khẩu?</button>
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
                <div className="chronelis-auth-input-field chronelis-auth-input-field--password">
                  <KeyRound className="chronelis-auth-input-icon" />
                  <input
                    type={showSignUpPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Mật khẩu"
                    {...registerForm.register('password')}
                  />
                  <button
                    type="button"
                    className="chronelis-auth-input-toggle"
                    onClick={() => setShowSignUpPassword((prev) => !prev)}
                    aria-label={showSignUpPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showSignUpPassword ? <EyeOff className="chronelis-auth-input-icon" /> : <Eye className="chronelis-auth-input-icon" />}
                  </button>
                </div>
                <FieldError message={registerForm.formState.errors.password?.message} />
              </div>
              <div>
                <div className="chronelis-auth-input-field chronelis-auth-input-field--password">
                  <KeyRound className="chronelis-auth-input-icon" />
                  <input
                    type={showSignUpConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Xác nhận"
                    {...registerForm.register('confirmPassword')}
                  />
                  <button
                    type="button"
                    className="chronelis-auth-input-toggle"
                    onClick={() => setShowSignUpConfirmPassword((prev) => !prev)}
                    aria-label={showSignUpConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                  >
                    {showSignUpConfirmPassword ? <EyeOff className="chronelis-auth-input-icon" /> : <Eye className="chronelis-auth-input-icon" />}
                  </button>
                </div>
                <FieldError message={registerForm.formState.errors.confirmPassword?.message} />
              </div>
            </div>

            {signUpPassword ? (
              <div className="chronelis-auth-strength">
                <div className="chronelis-auth-strength-track" aria-hidden>
                  <span
                    className={`chronelis-auth-strength-fill chronelis-auth-strength-fill--${passwordStrength.level}`}
                    style={{ width: `${strengthPercent}%` }}
                  />
                </div>
                <div className="chronelis-auth-strength-meta">
                  <span>Mức độ mật khẩu: <strong>{passwordStrength.label}</strong></span>
                  <span>{passwordStrength.helper}</span>
                </div>
              </div>
            ) : null}

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
