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

export function isAfter(date1: string, date2: string) {
  if (!date1 || !date2) return false
  return new Date(date1) > new Date(date2)
}
