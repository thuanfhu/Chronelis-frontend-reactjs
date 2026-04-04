import { AppError } from '@/lib/errors/app-error'

const NOT_FOUND_MESSAGE_PATTERN = /(khong\s+ton\s+tai|không\s+tồn\s+tại|not\s+found)/i

export function isNotFoundError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.status === 404 || NOT_FOUND_MESSAGE_PATTERN.test(error.message)
  }

  if (error instanceof Error) {
    return NOT_FOUND_MESSAGE_PATTERN.test(error.message)
  }

  return false
}
