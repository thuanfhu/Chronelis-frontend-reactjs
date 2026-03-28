export function toLocalDateTimePayload(value: string) {
  if (!value) {
    return value
  }

  return value.length === 16 ? `${value}:00` : value
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return '-'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}
