import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { ThemeSync } from '@/app/providers/theme-sync'
import { RealtimeProvider } from '@/app/providers/realtime-provider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <RealtimeProvider>{children}</RealtimeProvider>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}
