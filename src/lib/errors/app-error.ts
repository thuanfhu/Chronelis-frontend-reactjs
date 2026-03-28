import type { ErrorDetail } from '@/types/api'

export class AppError extends Error {
  readonly status?: number
  readonly code?: number
  readonly details: ErrorDetail[]

  constructor(message: string, options?: { status?: number; code?: number; details?: ErrorDetail[] }) {
    super(message)
    this.name = 'AppError'
    this.status = options?.status
    this.code = options?.code
    this.details = options?.details ?? []
  }
}
