import axios from 'axios'
import { env } from '@/lib/constants/env'
import { parseApiError } from '@/lib/errors/parse-api-error'
import { useAuthStore } from '@/app/store/auth-store'
import type { ApiResponse, PaginationResponse } from '@/types/api'

const AUTH_403_SAFE_ROUTE_MATCHER = /^\/auth\/(verify-active-account|reset-password)$/
const AUTH_403_SAFE_API_MATCHER = /\/auth\/(verify-active-account|reset-password|forgot-password|resend-verify)$/

export const http = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const requestUrl = axios.isAxiosError(error) ? (error.config?.url ?? '') : ''
    const onTokenizedAuthRoute = AUTH_403_SAFE_ROUTE_MATCHER.test(window.location.pathname)
    const isAuthVerificationRequest = AUTH_403_SAFE_API_MATCHER.test(requestUrl)
    const onAdminRoute = window.location.pathname.startsWith('/admin')
    const isAdminApiRequest = /\/admin(\/|$)/.test(requestUrl)
    const appError = parseApiError(error)

    if (appError.status === 401) {
      // Only redirect to login if the access token is actually expired or missing.
      // The backend may return 401 for "insufficient workspace permissions" on some endpoints
      // (e.g. /workspace-teams/:id/members). In that case, the user IS authenticated but
      // lacks the required role - we must not log them out.
      const accessToken = useAuthStore.getState().accessToken
      let tokenIsExpiredOrMissing = !accessToken
      if (accessToken) {
        try {
          const [, b64Payload] = accessToken.split('.')
          const payload = JSON.parse(atob(b64Payload)) as { exp?: number }
          tokenIsExpiredOrMissing = payload.exp != null && payload.exp * 1000 < Date.now()
        } catch {
          tokenIsExpiredOrMissing = true
        }
      }

      if (tokenIsExpiredOrMissing) {
        useAuthStore.getState().clearSession()
        if (!window.location.pathname.startsWith('/login')) {
          window.sessionStorage.setItem('chronelis-session-expired', '1')
          window.location.href = '/login?reason=session-expired'
        }
      }
      // If the token is still valid, let the error propagate normally (caught by mutation onError).
    }

    if (
      appError.status === 403 &&
      (onAdminRoute || isAdminApiRequest) &&
      !onTokenizedAuthRoute &&
      !isAuthVerificationRequest &&
      !window.location.pathname.startsWith('/forbidden')
    ) {
      window.location.href = '/forbidden'
    }

    return Promise.reject(appError)
  },
)

export function unwrapData<T>(payload: ApiResponse<T>): T {
  if (!payload.success || payload.data === undefined) {
    throw new Error('Du lieu tra ve khong hop le')
  }
  return payload.data
}

export function unwrapVoid(payload: ApiResponse<unknown>): void {
  if (!payload.success) {
    throw new Error('Phan hoi thao tac khong hop le')
  }
}

export function unwrapPagination<T>(payload: ApiResponse<unknown>): PaginationResponse<T> {
  if (!payload.success || payload.data === undefined) {
    throw new Error('Du lieu phan trang tra ve khong hop le')
  }

  if (typeof payload.data !== 'object' || payload.data === null) {
    throw new Error('Du lieu phan trang tra ve khong dung dinh dang')
  }

  const data = payload.data as PaginationResponse<unknown>
  if (!Array.isArray(data.content)) {
    throw new Error('Noi dung phan trang khong hop le')
  }

  return {
    meta: data.meta,
    content: data.content as T[],
  }
}
