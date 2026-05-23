import { AppError } from '@/lib/errors/app-error'

function isNotFoundMessage(message: string): boolean {
  const normalizedMessage = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return (
    /\bnot\s+found\b/i.test(message) ||
    normalizedMessage.includes('khong ton tai') ||
    normalizedMessage.includes('khong tim thay')
  )
}

export function isNotFoundError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.status === 404 || isNotFoundMessage(error.message)
  }

  if (error instanceof Error) {
    return isNotFoundMessage(error.message)
  }

  return false
}
