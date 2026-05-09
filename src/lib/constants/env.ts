let API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1'

export const env = {
  get apiBaseUrl() {
    return API_BASE_URL
  },
  get wsUrl() {
    return toWebSocketUrl(API_BASE_URL)
  },
}

export function setApiBaseUrl(url: string) {
  API_BASE_URL = url
}

function toWebSocketUrl(apiBaseUrl: string) {
  const parsed = new URL(apiBaseUrl)
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
  parsed.pathname = '/ws'
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString()
}
