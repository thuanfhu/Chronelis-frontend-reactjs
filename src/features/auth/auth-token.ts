const TOKEN_PARAM_KEYS = ['token', 'verifyToken', 'resetToken', 'code'] as const

export function resolveAuthToken(searchParams: URLSearchParams): string {
  for (const key of TOKEN_PARAM_KEYS) {
    const value = searchParams.get(key)?.trim()
    if (value) {
      return value
    }
  }

  return ''
}
