import axios, { type AxiosError } from 'axios'
import type { ApiResponse, ErrorDetail } from '@/types/api'
import { AppError } from '@/lib/errors/app-error'

export function parseApiError(error: unknown): AppError {
  if (!axios.isAxiosError(error)) {
    return new AppError('Đã xảy ra lỗi không mong muốn')
  }

  const axiosError = error as AxiosError<ApiResponse<unknown>>
  const status = axiosError.response?.status
  const payload = axiosError.response?.data
  const details = payload?.errors ?? fallbackDetails(axiosError)
  const message = details[0]?.message ?? payload?.message ?? axiosError.message

  return new AppError(message, {
    status,
    code: details[0]?.code,
    details,
  })
}

function fallbackDetails(error: AxiosError<ApiResponse<unknown>>): ErrorDetail[] {
  const detail: ErrorDetail = {
    message: error.message || 'Yeu cau that bai',
  }

  return [detail]
}
