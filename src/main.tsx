import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n'
import { App } from './App'
import { env, setApiBaseUrl } from './lib/constants/env'

async function bootstrap() {
  // If we are in local development and the base URL is set to localhost
  if (import.meta.env.DEV && env.apiBaseUrl.includes('localhost')) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1000)

      // Ping the local API to check if it's running
      await fetch(env.apiBaseUrl, {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      console.log('✅ Local backend detected. Using local API.')
    } catch (error) {
      // If fetch fails (network error), local BE is not running, fallback to cloud
      const cloudUrl =
        import.meta.env.VITE_CLOUD_API_BASE_URL ??
        'https://chronelis-ekgadxekd8hhf0fq.eastasia-01.azurewebsites.net/api/v1'
      console.warn(`⚠️ Local backend not detected. Falling back to Cloud API: ${cloudUrl}`)
      setApiBaseUrl(cloudUrl)
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()
