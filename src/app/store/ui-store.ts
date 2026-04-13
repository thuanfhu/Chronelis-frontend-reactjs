import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark'
export type TaskDrawerMode = 'view' | 'edit' | 'duplicate'

interface OpenAIAssistantOptions {
  projectId?: number | null
  workspaceId?: number | null
  prompt?: string
}

interface UiState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  taskDrawerTaskId: number | null
  taskDrawerMode: TaskDrawerMode
  taskDeleteConfirmTaskId: number | null
  selectedWorkspaceId: number | null
  selectedProjectId: number | null
  commandPaletteOpen: boolean
  aiAssistantOpen: boolean
  aiAssistantPromptSeed: string | null
  theme: ThemeMode
  setSidebarOpen: (value: boolean) => void
  setSidebarCollapsed: (value: boolean) => void
  setTaskDrawerTaskId: (taskId: number | null) => void
  openTaskDrawer: (taskId: number, mode?: TaskDrawerMode) => void
  closeTaskDrawer: () => void
  setTaskDrawerMode: (mode: TaskDrawerMode) => void
  openTaskDeleteConfirm: (taskId: number) => void
  closeTaskDeleteConfirm: () => void
  setSelectedWorkspaceId: (workspaceId: number | null) => void
  setSelectedProjectId: (projectId: number | null) => void
  clearWorkspaceContext: () => void
  setCommandPaletteOpen: (value: boolean) => void
  openAIAssistant: (options?: OpenAIAssistantOptions) => void
  closeAIAssistant: () => void
  clearAIAssistantPromptSeed: () => void
  toggleTheme: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarOpen: false,
      sidebarCollapsed: false,
      taskDrawerTaskId: null,
      taskDrawerMode: 'view',
      taskDeleteConfirmTaskId: null,
      selectedWorkspaceId: null,
      selectedProjectId: null,
      commandPaletteOpen: false,
      aiAssistantOpen: false,
      aiAssistantPromptSeed: null,
      theme: 'light',
      setSidebarOpen: (value) => set({ sidebarOpen: value }),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      setTaskDrawerTaskId: (taskId) => set({ taskDrawerTaskId: taskId, taskDrawerMode: 'view' }),
      openTaskDrawer: (taskId, mode = 'view') => set({ taskDrawerTaskId: taskId, taskDrawerMode: mode }),
      closeTaskDrawer: () => set({ taskDrawerTaskId: null, taskDrawerMode: 'view' }),
      setTaskDrawerMode: (mode) => set({ taskDrawerMode: mode }),
      openTaskDeleteConfirm: (taskId) => set({ taskDeleteConfirmTaskId: taskId }),
      closeTaskDeleteConfirm: () => set({ taskDeleteConfirmTaskId: null }),
      setSelectedWorkspaceId: (workspaceId) => set({ selectedWorkspaceId: workspaceId }),
      setSelectedProjectId: (projectId) => set({ selectedProjectId: projectId }),
      clearWorkspaceContext: () => set({ selectedWorkspaceId: null, selectedProjectId: null }),
      setCommandPaletteOpen: (value) => set({ commandPaletteOpen: value }),
      openAIAssistant: (options) => set((state) => ({
        aiAssistantOpen: true,
        aiAssistantPromptSeed: options?.prompt ?? state.aiAssistantPromptSeed,
        selectedProjectId: options?.projectId ?? state.selectedProjectId,
        selectedWorkspaceId: options?.workspaceId ?? state.selectedWorkspaceId,
      })),
      closeAIAssistant: () => set({ aiAssistantOpen: false }),
      clearAIAssistantPromptSeed: () => set({ aiAssistantPromptSeed: null }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
    }),
    {
      name: 'chronelis-ui-store',
      partialize: (state) => ({
        selectedWorkspaceId: state.selectedWorkspaceId,
        selectedProjectId: state.selectedProjectId,
      }),
    },
  ),
)
