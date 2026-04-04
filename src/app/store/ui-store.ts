import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark'
export type TaskDrawerMode = 'view' | 'edit'

interface UiState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  taskDrawerTaskId: number | null
  taskDrawerMode: TaskDrawerMode
  selectedWorkspaceId: number | null
  selectedProjectId: number | null
  commandPaletteOpen: boolean
  theme: ThemeMode
  setSidebarOpen: (value: boolean) => void
  setSidebarCollapsed: (value: boolean) => void
  setTaskDrawerTaskId: (taskId: number | null) => void
  openTaskDrawer: (taskId: number, mode?: TaskDrawerMode) => void
  closeTaskDrawer: () => void
  setTaskDrawerMode: (mode: TaskDrawerMode) => void
  setSelectedWorkspaceId: (workspaceId: number | null) => void
  setSelectedProjectId: (projectId: number | null) => void
  setCommandPaletteOpen: (value: boolean) => void
  toggleTheme: () => void
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  taskDrawerTaskId: null,
  taskDrawerMode: 'view',
  selectedWorkspaceId: null,
  selectedProjectId: null,
  commandPaletteOpen: false,
  theme: 'light',
  setSidebarOpen: (value) => set({ sidebarOpen: value }),
  setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
  setTaskDrawerTaskId: (taskId) => set({ taskDrawerTaskId: taskId, taskDrawerMode: 'view' }),
  openTaskDrawer: (taskId, mode = 'view') => set({ taskDrawerTaskId: taskId, taskDrawerMode: mode }),
  closeTaskDrawer: () => set({ taskDrawerTaskId: null, taskDrawerMode: 'view' }),
  setTaskDrawerMode: (mode) => set({ taskDrawerMode: mode }),
  setSelectedWorkspaceId: (workspaceId) => set({ selectedWorkspaceId: workspaceId }),
  setSelectedProjectId: (projectId) => set({ selectedProjectId: projectId }),
  setCommandPaletteOpen: (value) => set({ commandPaletteOpen: value }),
  toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
}))
