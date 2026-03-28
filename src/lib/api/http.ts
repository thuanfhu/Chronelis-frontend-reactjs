import axios from 'axios'
import { env } from '@/lib/constants/env'
import { parseApiError } from '@/lib/errors/parse-api-error'
import { useAuthStore } from '@/app/store/auth-store'
import type { ApiResponse, PaginationResponse } from '@/types/api'

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
    const appError = parseApiError(error)

    if (appError.status === 401) {
      useAuthStore.getState().clearSession()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }

    if (appError.status === 403 && !window.location.pathname.startsWith('/forbidden')) {
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
