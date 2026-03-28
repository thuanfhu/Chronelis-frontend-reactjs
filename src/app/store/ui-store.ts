import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark'

interface UiState {
  sidebarOpen: boolean
  taskDrawerTaskId: number | null
  selectedWorkspaceId: number | null
  selectedProjectId: number | null
  commandPaletteOpen: boolean
  theme: ThemeMode
  setSidebarOpen: (value: boolean) => void
  setTaskDrawerTaskId: (taskId: number | null) => void
  setSelectedWorkspaceId: (workspaceId: number | null) => void
  setSelectedProjectId: (projectId: number | null) => void
  setCommandPaletteOpen: (value: boolean) => void
  toggleTheme: () => void
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarOpen: true,
  taskDrawerTaskId: null,
  selectedWorkspaceId: null,
  selectedProjectId: null,
  commandPaletteOpen: false,
  theme: 'light',
  setSidebarOpen: (value) => set({ sidebarOpen: value }),
  setTaskDrawerTaskId: (taskId) => set({ taskDrawerTaskId: taskId }),
  setSelectedWorkspaceId: (workspaceId) => set({ selectedWorkspaceId: workspaceId }),
  setSelectedProjectId: (projectId) => set({ selectedProjectId: projectId }),
  setCommandPaletteOpen: (value) => set({ commandPaletteOpen: value }),
  toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
}))
