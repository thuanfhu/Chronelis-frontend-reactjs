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

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token)
    } else {
      prom.reject(error)
    }
  })
  failedQueue = []
}

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const originalRequest = axios.isAxiosError(error) ? error.config : undefined
    const requestUrl = originalRequest?.url ?? ''
    const onTokenizedAuthRoute = AUTH_403_SAFE_ROUTE_MATCHER.test(window.location.pathname)
    const isAuthVerificationRequest = AUTH_403_SAFE_API_MATCHER.test(requestUrl)
    const onAdminRoute = window.location.pathname.startsWith('/admin')
    const isAdminApiRequest = /\/admin(\/|$)/.test(requestUrl)
    const appError = parseApiError(error)

    if (appError.status === 401 && originalRequest && !(originalRequest as any)._retry) {
      const currentUrl = originalRequest.url ?? ''
      // Avoid infinite loop on auth endpoints
      if (
        currentUrl.includes('/auth/refresh') ||
        currentUrl.includes('/auth/login') ||
        currentUrl.includes('/auth/logout')
      ) {
        return Promise.reject(appError)
      }

      // Check if the access token is actually expired or missing (using client-side time)
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

      // Also consider it expired if backend returns TOKEN_EXPIRED (1005), INVALID_TOKEN (1006), or MISSING_TOKEN (1010)
      const isExpiredCode =
        appError.code === 1005 || appError.code === 1006 || appError.code === 1010

      if (tokenIsExpiredOrMissing || isExpiredCode) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          })
            .then((token) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`
              }
              return http(originalRequest)
            })
            .catch((err) => {
              return Promise.reject(err)
            })
        }

        ;(originalRequest as any)._retry = true
        isRefreshing = true

        return new Promise((resolve, reject) => {
          axios
            .get(`${env.apiBaseUrl}/auth/refresh`, { withCredentials: true })
            .then((res) => {
              const payload = res.data
              if (payload && payload.success && payload.data) {
                const { accessToken: newAccessToken, userSecured } = payload.data
                useAuthStore.getState().setSession({ accessToken: newAccessToken, currentUser: userSecured })

                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
                }

                processQueue(null, newAccessToken)
                resolve(http(originalRequest))
              } else {
                throw new Error('Không thể làm mới token')
              }
            })
            .catch((refreshError) => {
              processQueue(refreshError, null)
              useAuthStore.getState().clearSession()
              if (!window.location.pathname.startsWith('/login')) {
                window.sessionStorage.setItem('chronelis-session-expired', '1')
                window.location.href = '/login?reason=session-expired'
              }
              reject(parseApiError(refreshError))
            })
            .finally(() => {
              isRefreshing = false
            })
        })
      }
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
