import { useCallback, useMemo, useState } from 'react'

export type DashboardLearningStepKey =
  | 'kanbanVisited'
  | 'todoVisited'
  | 'calendarVisited'
  | 'activityVisited'
  | 'notificationsVisited'

export interface DashboardOnboardingState {
  hasSeenDashboardOnboarding: boolean
  dismissedDashboardHub: boolean
  collapsedDashboardHub: boolean
  completedLearningSteps: DashboardLearningStepKey[]
  lastOpenedAt?: string
}

const STORAGE_VERSION = 'v1'

const defaultState: DashboardOnboardingState = {
  hasSeenDashboardOnboarding: false,
  dismissedDashboardHub: false,
  collapsedDashboardHub: false,
  completedLearningSteps: [],
}

interface CachedOnboardingState {
  storageKey: string | null
  state: DashboardOnboardingState
}

function getStorageKey(userId: string) {
  return `chronelis:onboarding:${STORAGE_VERSION}:${userId}`
}

function readStoredState(storageKey: string): DashboardOnboardingState {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return defaultState
    }

    const parsed = JSON.parse(raw) as Partial<DashboardOnboardingState>
    return {
      ...defaultState,
      ...parsed,
      completedLearningSteps: Array.isArray(parsed.completedLearningSteps)
        ? parsed.completedLearningSteps.filter(Boolean)
        : [],
    }
  } catch {
    return defaultState
  }
}

function writeStoredState(storageKey: string, state: DashboardOnboardingState) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    // Ignore storage failures. Onboarding state is local UI convenience only.
  }
}

export function useDashboardOnboardingState(userId?: string | number | null) {
  const normalizedUserId = userId == null ? '' : String(userId)
  const storageKey = useMemo(() => (normalizedUserId ? getStorageKey(normalizedUserId) : null), [normalizedUserId])
  const [cachedState, setCachedState] = useState<CachedOnboardingState>(() => ({
    storageKey,
    state: storageKey ? readStoredState(storageKey) : defaultState,
  }))

  const state =
    cachedState.storageKey === storageKey ? cachedState.state : storageKey ? readStoredState(storageKey) : defaultState

  const updateState = useCallback(
    (updater: (current: DashboardOnboardingState) => DashboardOnboardingState) => {
      setCachedState((current) => {
        const currentState =
          current.storageKey === storageKey ? current.state : storageKey ? readStoredState(storageKey) : defaultState
        const next = updater(currentState)
        if (storageKey) {
          writeStoredState(storageKey, next)
        }
        return {
          storageKey,
          state: next,
        }
      })
    },
    [storageKey],
  )

  const markSeen = useCallback(() => {
    if (!storageKey) {
      return
    }
    updateState((current) => {
      if (current.hasSeenDashboardOnboarding) {
        return current
      }
      return {
        ...current,
        hasSeenDashboardOnboarding: true,
        lastOpenedAt: new Date().toISOString(),
      }
    })
  }, [storageKey, updateState])

  const setCollapsed = useCallback(
    (collapsedDashboardHub: boolean) => {
      updateState((current) => ({
        ...current,
        collapsedDashboardHub,
        dismissedDashboardHub: false,
        lastOpenedAt: new Date().toISOString(),
      }))
    },
    [updateState],
  )

  const dismiss = useCallback(() => {
    updateState((current) => ({
      ...current,
      dismissedDashboardHub: true,
      collapsedDashboardHub: false,
      lastOpenedAt: new Date().toISOString(),
    }))
  }, [updateState])

  const restore = useCallback(() => {
    updateState((current) => ({
      ...current,
      dismissedDashboardHub: false,
      collapsedDashboardHub: false,
      lastOpenedAt: new Date().toISOString(),
    }))
  }, [updateState])

  const markLearningStep = useCallback(
    (step: DashboardLearningStepKey) => {
      updateState((current) => {
        if (current.completedLearningSteps.includes(step)) {
          return current
        }
        return {
          ...current,
          completedLearningSteps: [...current.completedLearningSteps, step],
          lastOpenedAt: new Date().toISOString(),
        }
      })
    },
    [updateState],
  )

  return {
    state,
    markSeen,
    setCollapsed,
    dismiss,
    restore,
    markLearningStep,
  }
}
