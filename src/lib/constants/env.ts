const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1'

export const env = {
  apiBaseUrl: API_BASE_URL,
  wsUrl: toWebSocketUrl(API_BASE_URL),
}

function toWebSocketUrl(apiBaseUrl: string) {
  const parsed = new URL(apiBaseUrl)
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
  parsed.pathname = '/ws'
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString()
}
