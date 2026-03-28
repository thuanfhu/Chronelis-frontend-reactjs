import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/app/store/auth-store'

export function ProtectedGuard({ children }: PropsWithChildren) {
  const token = useAuthStore((state) => state.accessToken)
  const isHydrated = useAuthStore((state) => state.isHydrated)
  const location = useLocation()

  if (!isHydrated) {
    return <div className="p-6 text-sm text-muted-foreground">Dang khoi tao phien...</div>
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export function PublicOnlyGuard({ children }: PropsWithChildren) {
  const token = useAuthStore((state) => state.accessToken)

  if (token) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
