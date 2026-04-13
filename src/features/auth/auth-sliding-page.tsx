import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, KeyRound, Loader2, Mail, Phone, UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
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
      label: 'auth.strengthWeak',
      helper: 'auth.strengthWeakHelper',
    }
  }

  if (score === 2) {
    return {
      level: 'fair',
      score,
      label: 'auth.strengthFair',
      helper: 'auth.strengthFairHelper',
    }
  }

  if (score === 3) {
    return {
      level: 'good',
      score,
      label: 'auth.strengthGood',
      helper: 'auth.strengthGoodHelper',
    }
  }

  if (score === 4) {
    return {
      level: 'strong',
      score,
      label: 'auth.strengthStrong',
      helper: 'auth.strengthStrongHelper',
    }
  }

  return {
    level: 'very-strong',
    score,
    label: 'auth.strengthVeryStrong',
    helper: 'auth.strengthVeryStrongHelper',
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
  const { t } = useTranslation()
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
      toast.success(t('auth.forgotEmailSentTitle'), { description: t('auth.forgotEmailSentDesc') })
    },
    onError: (error: Error) => {
      toast.error(t('auth.forgotEmailFailTitle'), { description: error.message })
    },
  })

  const resendVerifyMutation = useMutation({
    mutationFn: (email: string) => authApi.resendVerify(email),
    onSuccess: () => {
      setSignUpResendCountdown(RESEND_COOLDOWN_SECONDS)
      toast.success(t('auth.resendVerifySentTitle'), { description: t('auth.resendVerifySentDesc') })
    },
    onError: (error: Error) => {
      toast.error(t('auth.resendVerifyFailTitle'), { description: error.message })
    },
  })

  const resendForgotMutation = useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onSuccess: () => {
      setForgotResendCountdown(RESEND_COOLDOWN_SECONDS)
      toast.success(t('auth.resendForgotSentTitle'), { description: t('auth.resendForgotSentDesc') })
    },
    onError: (error: Error) => {
      toast.error(t('auth.resendForgotFailTitle'), { description: error.message })
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
      toast.success(t('auth.loginSuccessTitle'))
      navigate('/dashboard', { replace: true })
    },
    onError: (error: Error) => {
      toast.error(t('auth.loginFailTitle'), { description: error.message })
    },
  })

  const registerMutation = useMutation({
    mutationFn: (values: RegisterPayload) => authApi.register(values),
    onSuccess: () => {
      setSignUpResendCountdown(RESEND_COOLDOWN_SECONDS)
      toast.success(t('auth.registerSuccessTitle'), { description: t('auth.registerSuccessDesc') })
    },
    onError: (error: Error) => {
      toast.error(t('auth.registerFailTitle'), { description: error.message })
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
        title: t('auth.panelForgotLeftTitle'),
        description: t('auth.panelForgotLeftDesc'),
        actionLabel: t('auth.switchSignUp'),
        onAction: () => switchMode('sign-up'),
      }
    : {
        key: 'welcome-left',
        showBrand: true,
        title: t('auth.panelWelcomeTitle'),
        description: t('auth.panelWelcomeDesc'),
        actionLabel: t('auth.switchSignUp'),
        onAction: () => switchMode('sign-up'),
      }

  const rightPanelCopy: PanelCopy = mode === 'forgot-password'
    ? {
        key: 'forgot-right',
        title: t('auth.panelForgotRightTitle'),
        description: t('auth.panelForgotRightDesc'),
        actionLabel: t('auth.switchSignIn'),
        onAction: () => switchMode('sign-in'),
      }
    : {
        key: 'signin-right',
        title: t('auth.panelSignInRightTitle'),
        description: t('auth.panelSignInRightDesc'),
        actionLabel: t('auth.switchSignIn'),
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

            <h2 className="chronelis-auth-title">{t('auth.login')}</h2>
            <p className="chronelis-auth-subtitle">{t('auth.loginSubtitle')}</p>

            <div className="chronelis-auth-input-field">
              <Mail className="chronelis-auth-input-icon" />
              <input
                type="text"
                autoComplete="username"
                placeholder={t('auth.emailOrPhone')}
                {...loginForm.register('identifier')}
              />
            </div>
            <FieldError message={loginForm.formState.errors.identifier?.message} />

            <div className="chronelis-auth-input-field chronelis-auth-input-field--password">
              <KeyRound className="chronelis-auth-input-icon" />
              <input
                type={showSignInPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={t('auth.password')}
                {...loginForm.register('password')}
              />
              <button
                type="button"
                className="chronelis-auth-input-toggle"
                onClick={() => setShowSignInPassword((prev) => !prev)}
                aria-label={showSignInPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showSignInPassword ? <EyeOff className="chronelis-auth-input-icon" /> : <Eye className="chronelis-auth-input-icon" />}
              </button>
            </div>
            <FieldError message={loginForm.formState.errors.password?.message} />

            <div className="chronelis-auth-form-meta">
              <button type="button" className="chronelis-auth-link" onClick={() => switchMode('forgot-password')}>{t('auth.forgotPasswordLink')}</button>
            </div>

            <button className="chronelis-auth-btn chronelis-auth-btn--solid" type="submit" disabled={loginMutation.isPending}>
              {loginMutation.isPending && <Loader2 className="chronelis-auth-btn-spinner" />}
              {t('auth.login')}
            </button>

            <div className="chronelis-auth-mobile-switch" role="group" aria-label={t('auth.switchModeLogin')}>
              <span>{t('auth.noAccount')}</span>
              <button
                type="button"
                className="chronelis-auth-mobile-switch-trigger"
                onClick={() => switchMode('sign-up')}
              >
                {t('auth.switchSignUp')}
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
            <h2 className="chronelis-auth-title">{t('auth.register')}</h2>
            <p className="chronelis-auth-subtitle">{t('auth.registerSubtitle')}</p>

            <div className="chronelis-auth-grid-2">
              <div>
                <div className="chronelis-auth-input-field">
                  <UserRound className="chronelis-auth-input-icon" />
                  <input
                    type="text"
                    autoComplete="family-name"
                    placeholder={t('auth.lastName')}
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
                    placeholder={t('auth.firstName')}
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
                placeholder={t('auth.email')}
                {...registerForm.register('email')}
              />
            </div>
            <FieldError message={registerForm.formState.errors.email?.message} />

            <div className="chronelis-auth-input-field">
              <Phone className="chronelis-auth-input-icon" />
              <input
                type="tel"
                autoComplete="tel"
                placeholder={t('auth.phone')}
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
                    placeholder={t('auth.password')}
                    {...registerForm.register('password')}
                  />
                  <button
                    type="button"
                    className="chronelis-auth-input-toggle"
                    onClick={() => setShowSignUpPassword((prev) => !prev)}
                    aria-label={showSignUpPassword ? t('auth.hidePassword') : t('auth.showPassword')}
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
                    placeholder={t('auth.confirmPassword')}
                    {...registerForm.register('confirmPassword')}
                  />
                  <button
                    type="button"
                    className="chronelis-auth-input-toggle"
                    onClick={() => setShowSignUpConfirmPassword((prev) => !prev)}
                    aria-label={showSignUpConfirmPassword ? t('auth.hideConfirmPassword') : t('auth.showConfirmPassword')}
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
                <span className="chronelis-auth-strength-lbl">{t(passwordStrength.label)}</span>
                <span className="chronelis-auth-strength-hint">{t(passwordStrength.helper)}</span>
              </div>
            ) : null}

            {registerMutation.isSuccess ? (
              <div className="chronelis-auth-forgot-success">
                <div className="chronelis-auth-forgot-success-icon">
                  <Mail className="size-5" />
                </div>
                <p className="chronelis-auth-forgot-success-title">{t('auth.checkInbox')}</p>
                <p className="chronelis-auth-forgot-success-description">
                  {t('auth.verifyEmailSent')}
                </p>
                <button
                  type="button"
                  className="chronelis-auth-resend-btn"
                  onClick={() => resendVerifyMutation.mutate(signUpEmail)}
                  disabled={!signUpEmail || signUpResendCountdown > 0 || resendVerifyMutation.isPending}
                >
                  {resendVerifyMutation.isPending && <Loader2 className="chronelis-auth-resend-spinner" />}
                  {signUpResendCountdown > 0 ? t('auth.resendAfter', { seconds: signUpResendCountdown }) : t('auth.resendVerifyEmail')}
                </button>
              </div>
            ) : (
              <button className="chronelis-auth-btn chronelis-auth-btn--solid" type="submit" disabled={registerMutation.isPending}>
                {registerMutation.isPending && <Loader2 className="chronelis-auth-btn-spinner" />}
                {t('auth.createAccount')}
              </button>
            )}

            <div className="chronelis-auth-mobile-switch" role="group" aria-label={t('auth.switchModeRegister')}>
              <span>{t('auth.hasAccount')}</span>
              <button
                type="button"
                className="chronelis-auth-mobile-switch-trigger"
                onClick={() => switchMode('sign-in')}
              >
                {t('auth.switchSignIn')}
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

            <h2 className="chronelis-auth-title">{t('auth.forgotPassword')}</h2>
            <p className="chronelis-auth-subtitle">{t('auth.forgotSubtitle')}</p>

            {forgotMutation.isSuccess ? (
              <div className="chronelis-auth-forgot-success">
                <div className="chronelis-auth-forgot-success-icon">
                  <Mail className="size-5" />
                </div>
                <p className="chronelis-auth-forgot-success-title">{t('auth.checkYourEmail')}</p>
                <p className="chronelis-auth-forgot-success-description">
                  {t('auth.resetLinkSent')}
                </p>
                <button
                  type="button"
                  className="chronelis-auth-resend-btn"
                  onClick={() => resendForgotMutation.mutate(forgotEmail)}
                  disabled={!forgotEmail || forgotResendCountdown > 0 || resendForgotMutation.isPending}
                >
                  {resendForgotMutation.isPending && <Loader2 className="chronelis-auth-resend-spinner" />}
                  {forgotResendCountdown > 0 ? t('auth.resendAfter', { seconds: forgotResendCountdown }) : t('auth.resendEmail')}
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
                    placeholder={t('auth.email')}
                    {...forgotForm.register('email')}
                  />
                </div>
                <FieldError message={forgotForm.formState.errors.email?.message} />

                <button className="chronelis-auth-btn chronelis-auth-btn--solid" type="submit" disabled={forgotMutation.isPending}>
                  {forgotMutation.isPending && <Loader2 className="chronelis-auth-btn-spinner" />}
                  {t('auth.sendResetEmail')}
                </button>
              </>
            )}

          </motion.form>
        ) : null}
      </AnimatePresence>
    </AuthSharedShell>
  )
}
