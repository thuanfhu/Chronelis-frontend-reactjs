const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1'
const PROJECT_ASSISTANT_ENABLED = toBoolean(import.meta.env.VITE_PROJECT_ASSISTANT_ENABLED, true)

export const env = {
  apiBaseUrl: API_BASE_URL,
  wsUrl: toWebSocketUrl(API_BASE_URL),
  projectAssistantEnabled: PROJECT_ASSISTANT_ENABLED,
}

function toWebSocketUrl(apiBaseUrl: string) {
  const parsed = new URL(apiBaseUrl)
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
  parsed.pathname = '/ws'
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString()
}

function toBoolean(value: string | undefined, fallback: boolean) {
  if (value == null) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false
  }

  return fallback
}
