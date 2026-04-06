import axios from 'axios'
import { env } from '@/lib/constants/env'
import { parseApiError } from '@/lib/errors/parse-api-error'
import { useAuthStore } from '@/app/store/auth-store'
import type { ApiResponse, PaginationResponse } from '@/types/api'

const PUBLIC_AUTH_API_PATHS = [
  '/auth/register',
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-active-account',
  '/auth/resend-verify',
]

const PUBLIC_AUTH_PAGES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/reset-password',
  '/verify-account',
  '/auth/verify-active-account',
]

function isPublicAuthApiRequest(url?: string): boolean {
  if (!url) {
    return false
  }

  return PUBLIC_AUTH_API_PATHS.some((path) => url.includes(path))
}

function isPublicAuthPage(pathname: string): boolean {
  return PUBLIC_AUTH_PAGES.some((path) => pathname === path)
}

export const http = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token && !isPublicAuthApiRequest(config.url)) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const appError = parseApiError(error)
    const pathname = window.location.pathname
    const requestUrl = axios.isAxiosError(error) ? error.config?.url : undefined
    const isPublicAuthRequest = isPublicAuthApiRequest(requestUrl)
    const isAuthAccountRequest = typeof requestUrl === 'string' && requestUrl.includes('/auth/account')
    const onPublicAuthPage = isPublicAuthPage(pathname)

    if (appError.status === 401 || (appError.status === 403 && isAuthAccountRequest)) {
      useAuthStore.getState().clearSession()
      if (!onPublicAuthPage && !pathname.startsWith('/login')) {
        window.location.href = '/login'
      }

      return Promise.reject(appError)
    }

    if (appError.status === 403 && !isPublicAuthRequest && !onPublicAuthPage && !pathname.startsWith('/forbidden')) {
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
