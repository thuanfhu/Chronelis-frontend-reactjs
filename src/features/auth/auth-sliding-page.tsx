import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, KeyRound, Loader2, Mail, Phone, UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAuthStore } from '@/app/store/auth-store'
import { authApi, type RegisterPayload } from '@/lib/api/modules/auth-api'
import { forgotPasswordSchema, loginSchema, registerSchema } from '@/features/auth/auth-schemas'
import { AuthSharedShell } from '@/features/auth/auth-shared-shell'
import '@/features/auth/auth-sliding.css'

type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password'

type LoginFormValues = z.infer<typeof loginSchema>
type RegisterFormValues = z.infer<typeof registerSchema>
type ForgotFormValues = z.infer<typeof forgotPasswordSchema>

interface AuthSlidingPageProps {
  initialMode: AuthMode
}

interface PanelCopy {
  key: string
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  showBrand?: boolean
}

const ROUTE_SWITCH_DELAY_MS = 780
const FORM_TRANSITION = {
  duration: 0.32,
  ease: [0.22, 1, 0.36, 1] as const,
}

const PANEL_TEXT_TRANSITION = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1] as const,
}

const AUTH_MODE_ROUTE: Record<AuthMode, string> = {
  'sign-in': '/login',
  'sign-up': '/register',
  'forgot-password': '/forgot-password',
}

const AUTH_MODE_CLASS: Record<AuthMode, string> = {
  'sign-in': '',
  'sign-up': 'sign-up-mode',
  'forgot-password': 'forgot-password-mode',
}

const RESEND_COOLDOWN_SECONDS = 30

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

interface AuthPanelContentProps {
  side: 'left' | 'right'
  content: PanelCopy
}

function AuthPanelContent({ side, content }: AuthPanelContentProps) {
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={`${side}-${content.key}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={PANEL_TEXT_TRANSITION}
        className="chronelis-auth-panel-copy"
      >
        {content.showBrand ? (
          <Link to="/login" className="chronelis-auth-brand chronelis-auth-brand--desktop">
            <span className="chronelis-auth-brand-badge">C</span>
            <span className="chronelis-auth-brand-text">Chronelis</span>
          </Link>
        ) : null}

        <h3>{content.title}</h3>
        <p>{content.description}</p>
        <button type="button" className="chronelis-auth-btn chronelis-auth-btn--ghost" onClick={content.onAction}>
          {content.actionLabel}
        </button>
      </motion.div>
    </AnimatePresence>
  )
}

export function AuthSlidingPage({ initialMode }: AuthSlidingPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const setSession = useAuthStore((state) => state.setSession)
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [showSignInPassword, setShowSignInPassword] = useState(false)
  const [showSignUpPassword, setShowSignUpPassword] = useState(false)
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false)
  const [signUpResendCountdown, setSignUpResendCountdown] = useState(0)
  const [forgotResendCountdown, setForgotResendCountdown] = useState(0)
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

  useEffect(() => {
    if (signUpResendCountdown <= 0 && forgotResendCountdown <= 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      setSignUpResendCountdown((previous) => (previous > 0 ? previous - 1 : 0))
      setForgotResendCountdown((previous) => (previous > 0 ? previous - 1 : 0))
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [forgotResendCountdown, signUpResendCountdown])

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode === mode) {
      return
    }

    setMode(nextMode)

    if (routeSwitchTimeoutRef.current !== null) {
      window.clearTimeout(routeSwitchTimeoutRef.current)
      routeSwitchTimeoutRef.current = null
    }

    const nextRoute = AUTH_MODE_ROUTE[nextMode]
    if (location.pathname === nextRoute) {
      return
    }

    routeSwitchTimeoutRef.current = window.setTimeout(() => {
      navigate(nextRoute, { replace: true })
      routeSwitchTimeoutRef.current = null
    }, ROUTE_SWITCH_DELAY_MS)
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

  const forgotForm = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  const forgotMutation = useMutation({
    mutationFn: (payload: ForgotFormValues) => authApi.forgotPassword(payload.email),
    onSuccess: () => {
      setForgotResendCountdown(RESEND_COOLDOWN_SECONDS)
      toast.success('Đã gửi email đặt lại mật khẩu', { description: 'Vui lòng kiểm tra hộp thư của bạn.' })
    },
    onError: (error: Error) => {
      toast.error('Gửi email thất bại', { description: error.message })
    },
  })

  const resendVerifyMutation = useMutation({
    mutationFn: (email: string) => authApi.resendVerify(email),
    onSuccess: () => {
      setSignUpResendCountdown(RESEND_COOLDOWN_SECONDS)
      toast.success('Đã gửi lại email xác thực', { description: 'Vui lòng kiểm tra hộp thư của bạn.' })
    },
    onError: (error: Error) => {
      toast.error('Gửi lại email xác thực thất bại', { description: error.message })
    },
  })

  const resendForgotMutation = useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onSuccess: () => {
      setForgotResendCountdown(RESEND_COOLDOWN_SECONDS)
      toast.success('Đã gửi lại email đặt lại mật khẩu', { description: 'Vui lòng kiểm tra hộp thư của bạn.' })
    },
    onError: (error: Error) => {
      toast.error('Gửi lại email thất bại', { description: error.message })
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
      setSignUpResendCountdown(RESEND_COOLDOWN_SECONDS)
      toast.success('Đăng ký thành công', { description: 'Vui lòng kiểm tra email để xác thực tài khoản.' })
    },
    onError: (error: Error) => {
      toast.error('Đăng ký thất bại', { description: error.message })
    },
  })

  const signUpPassword = registerForm.watch('password')
  const signUpEmail = registerForm.watch('email')?.trim() ?? ''
  const forgotEmail = forgotForm.watch('email')?.trim() ?? ''
  const passwordStrength = resolvePasswordStrength(signUpPassword)
  const pageClassName = AUTH_MODE_CLASS[mode]

  const leftPanelCopy: PanelCopy = mode === 'forgot-password'
    ? {
        key: 'forgot-left',
        showBrand: true,
        title: 'Cần lấy lại mật khẩu?',
        description: 'Nhập email bạn đã dùng đăng ký, Chronelis sẽ gửi liên kết đặt lại mật khẩu đến hộp thư ngay lập tức.',
        actionLabel: 'Đăng ký',
        onAction: () => switchMode('sign-up'),
      }
    : {
        key: 'welcome-left',
        showBrand: true,
        title: 'Bạn mới đến Chronelis?',
        description: 'Tạo tài khoản để bắt đầu quản lý workspace, theo dõi tiến độ và cộng tác realtime cùng đội nhóm.',
        actionLabel: 'Đăng ký',
        onAction: () => switchMode('sign-up'),
      }

  const rightPanelCopy: PanelCopy = mode === 'forgot-password'
    ? {
        key: 'forgot-right',
        title: 'Đã nhớ mật khẩu?',
        description: 'Quay về đăng nhập để tiếp tục quản lý workspace, dự án và theo dõi tiến độ công việc của bạn.',
        actionLabel: 'Đăng nhập',
        onAction: () => switchMode('sign-in'),
      }
    : {
        key: 'signin-right',
        title: 'Đã có tài khoản?',
        description: 'Đăng nhập để tiếp tục xử lý task, kế hoạch lịch và cập nhật tiến độ cho dự án của bạn.',
        actionLabel: 'Đăng nhập',
        onAction: () => switchMode('sign-in'),
      }

  return (
    <AuthSharedShell
      pageClassName={pageClassName}
      leftPanel={<AuthPanelContent side="left" content={leftPanelCopy} />}
      rightPanel={<AuthPanelContent side="right" content={rightPanelCopy} />}
    >
      <AnimatePresence initial={false}>
        {mode === 'sign-in' ? (
          <motion.form
            key="sign-in-form"
            className="chronelis-auth-form chronelis-auth-sign-in-form"
            onSubmit={loginForm.handleSubmit((values) => loginMutation.mutate(values))}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={FORM_TRANSITION}
          >
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
              <button type="button" className="chronelis-auth-link" onClick={() => switchMode('forgot-password')}>Quên mật khẩu?</button>
            </div>

            <button className="chronelis-auth-btn chronelis-auth-btn--solid" type="submit" disabled={loginMutation.isPending}>
              {loginMutation.isPending && <Loader2 className="chronelis-auth-btn-spinner" />}
              Đăng nhập
            </button>

            <div className="chronelis-auth-mobile-switch" role="group" aria-label="Chuyển đổi chế độ đăng nhập">
              <span>Chưa có tài khoản?</span>
              <button
                type="button"
                className="chronelis-auth-mobile-switch-trigger"
                onClick={() => switchMode('sign-up')}
              >
                Đăng ký
              </button>
            </div>
          </motion.form>
        ) : null}

        {mode === 'sign-up' ? (
          <motion.form
            key="sign-up-form"
            className="chronelis-auth-form chronelis-auth-sign-up-form"
            onSubmit={registerForm.handleSubmit((values) => registerMutation.mutate(values))}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={FORM_TRANSITION}
          >
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
              <div className="chronelis-auth-strength-bar" data-level={passwordStrength.level}>
                <div className="chronelis-auth-strength-segments">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={i <= passwordStrength.score ? 'chronelis-auth-strength-seg active' : 'chronelis-auth-strength-seg'} />
                  ))}
                </div>
                <span className="chronelis-auth-strength-lbl">{passwordStrength.label}</span>
                <span className="chronelis-auth-strength-hint">{passwordStrength.helper}</span>
              </div>
            ) : null}

            {registerMutation.isSuccess ? (
              <div className="chronelis-auth-forgot-success">
                <div className="chronelis-auth-forgot-success-icon">
                  <Mail className="size-5" />
                </div>
                <p className="chronelis-auth-forgot-success-title">Kiểm tra hộp thư của bạn</p>
                <p className="chronelis-auth-forgot-success-description">
                  Email xác thực đã được gửi. Bấm vào liên kết trong email để kích hoạt tài khoản.
                </p>
                <button
                  type="button"
                  className="chronelis-auth-resend-btn"
                  onClick={() => resendVerifyMutation.mutate(signUpEmail)}
                  disabled={!signUpEmail || signUpResendCountdown > 0 || resendVerifyMutation.isPending}
                >
                  {resendVerifyMutation.isPending && <Loader2 className="chronelis-auth-resend-spinner" />}
                  {signUpResendCountdown > 0 ? `Gửi lại sau ${signUpResendCountdown}s` : 'Gửi lại email xác thực'}
                </button>
              </div>
            ) : (
              <button className="chronelis-auth-btn chronelis-auth-btn--solid" type="submit" disabled={registerMutation.isPending}>
                {registerMutation.isPending && <Loader2 className="chronelis-auth-btn-spinner" />}
                Tạo tài khoản
              </button>
            )}

            <div className="chronelis-auth-mobile-switch" role="group" aria-label="Chuyển đổi chế độ đăng ký">
              <span>Đã có tài khoản?</span>
              <button
                type="button"
                className="chronelis-auth-mobile-switch-trigger"
                onClick={() => switchMode('sign-in')}
              >
                Đăng nhập
              </button>
            </div>
          </motion.form>
        ) : null}

        {mode === 'forgot-password' ? (
          <motion.form
            key="forgot-form"
            className="chronelis-auth-form chronelis-auth-forgot-form"
            onSubmit={forgotForm.handleSubmit((values) => forgotMutation.mutate(values))}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={FORM_TRANSITION}
          >
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
                <button
                  type="button"
                  className="chronelis-auth-resend-btn"
                  onClick={() => resendForgotMutation.mutate(forgotEmail)}
                  disabled={!forgotEmail || forgotResendCountdown > 0 || resendForgotMutation.isPending}
                >
                  {resendForgotMutation.isPending && <Loader2 className="chronelis-auth-resend-spinner" />}
                  {forgotResendCountdown > 0 ? `Gửi lại sau ${forgotResendCountdown}s` : 'Gửi lại email'}
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
                    {...forgotForm.register('email')}
                  />
                </div>
                <FieldError message={forgotForm.formState.errors.email?.message} />

                <button className="chronelis-auth-btn chronelis-auth-btn--solid" type="submit" disabled={forgotMutation.isPending}>
                  {forgotMutation.isPending && <Loader2 className="chronelis-auth-btn-spinner" />}
                  Gửi email đặt lại
                </button>
              </>
            )}

          </motion.form>
        ) : null}
      </AnimatePresence>
    </AuthSharedShell>
  )
}
