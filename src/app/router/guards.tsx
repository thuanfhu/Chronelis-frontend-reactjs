import type { PropsWithChildren } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/app/store/auth-store'
import { isAdminUser } from '@/lib/auth/role-utils'

export function ProtectedGuard({ children }: PropsWithChildren) {
  const { t } = useTranslation()
  const token = useAuthStore((state) => state.accessToken)
  const isHydrated = useAuthStore((state) => state.isHydrated)
  const location = useLocation()

  if (!isHydrated) {
    return <div className="p-6 text-sm text-muted-foreground">{t('common.initializingSession')}</div>
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export function AdminGuard({ children }: PropsWithChildren) {
  const { t } = useTranslation()
  const token = useAuthStore((state) => state.accessToken)
  const isHydrated = useAuthStore((state) => state.isHydrated)
  const currentUser = useAuthStore((state) => state.currentUser)
  const location = useLocation()

  if (!isHydrated) {
    return <div className="p-6 text-sm text-muted-foreground">{t('common.initializingSession')}</div>
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isAdminUser(currentUser)) {
    return <Navigate to="/forbidden" replace />
  }

  return <>{children}</>
}

export function PublicOnlyGuard({ children }: PropsWithChildren) {
  const token = useAuthStore((state) => state.accessToken)
  const location = useLocation()

  const isTokenizedAuthRoute = (
    location.pathname === '/verify-account'
    || location.pathname === '/auth/verify-active-account'
    || location.pathname === '/reset-password'
    || location.pathname === '/auth/reset-password'
  ) && Boolean(new URLSearchParams(location.search).get('token'))

  if (token && !isTokenizedAuthRoute) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
