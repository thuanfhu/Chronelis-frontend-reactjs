import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useUiStore } from '@/app/store/ui-store'
import type { UserSecure } from '@/types/domain'

interface AuthState {
  accessToken: string | null
  currentUser: UserSecure | null
  isHydrated: boolean
  setSession: (payload: { accessToken: string; currentUser: UserSecure }) => void
  clearSession: () => void
  setHydrated: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      currentUser: null,
      isHydrated: false,
      setSession: ({ accessToken, currentUser }) => {
        set({ accessToken, currentUser })
      },
      clearSession: () => {
        useUiStore.getState().clearWorkspaceContext()
        set({ accessToken: null, currentUser: null })
      },
      setHydrated: (value) => {
        set({ isHydrated: value })
      },
    }),
    {
      name: 'chronelis-auth-store',
      partialize: (state) => ({
        accessToken: state.accessToken,
        currentUser: state.currentUser,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    },
  ),
)
