import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { isNotFoundError } from '@/lib/errors/is-not-found-error'

export const DEFAULT_DEFERRED_DELETE_WINDOW_MS = 5_000

export interface DeferredDeleteEntry<TPayload> {
  key: string
  label: string
  payload: TPayload
  createdAt: number
  expiresAt: number
  status: 'pending' | 'finalizing'
}

interface ScheduleDeleteParams<TPayload> {
  key: string
  label: string
  payload: TPayload
}

interface UseDeferredDeleteOptions<TPayload> {
  undoWindowMs?: number
  onFinalize: (payload: TPayload) => Promise<void>
  onUndo?: (payload: TPayload) => void
  onFinalizeSuccess?: (payload: TPayload) => void | Promise<void>
  onFinalizeError?: (payload: TPayload, error: Error) => void
  pendingMessage?: string | ((entry: DeferredDeleteEntry<TPayload>) => string)
  successMessage?: string | ((entry: DeferredDeleteEntry<TPayload>) => string)
  alreadyDeletedMessage?: string | ((entry: DeferredDeleteEntry<TPayload>) => string)
  duplicateMessage?: string
  errorTitle?: string
}

function resolveMessage<TPayload>(
  message: string | ((entry: DeferredDeleteEntry<TPayload>) => string) | undefined,
  entry: DeferredDeleteEntry<TPayload>,
  fallback: string,
): string {
  if (typeof message === 'function') {
    return message(entry)
  }

  if (typeof message === 'string' && message.trim()) {
    return message
  }

  return fallback
}

export function useDeferredDelete<TPayload>(options: UseDeferredDeleteOptions<TPayload>) {
  const undoWindowMs = options.undoWindowMs ?? DEFAULT_DEFERRED_DELETE_WINDOW_MS
  const [pendingDeletes, setPendingDeletes] = useState<Array<DeferredDeleteEntry<TPayload>>>([])
  const [clockMs, setClockMs] = useState(() => Date.now())
  const pendingDeletesRef = useRef<Array<DeferredDeleteEntry<TPayload>>>([])
  const finalizingKeysRef = useRef(new Set<string>())

  useEffect(() => {
    pendingDeletesRef.current = pendingDeletes
  }, [pendingDeletes])

  const removePendingDelete = useCallback((key: string) => {
    finalizingKeysRef.current.delete(key)
    setPendingDeletes((previous) => previous.filter((entry) => entry.key !== key))
  }, [])

  const finalizeDelete = useCallback(async (key: string) => {
    const pendingEntry = pendingDeletesRef.current.find((entry) => entry.key === key)
    if (!pendingEntry || pendingEntry.status !== 'pending') {
      return
    }

    if (finalizingKeysRef.current.has(key)) {
      return
    }

    finalizingKeysRef.current.add(key)
    setPendingDeletes((previous) => previous.map((entry) => (
      entry.key === key
        ? { ...entry, status: 'finalizing' }
        : entry
    )))

    try {
      await options.onFinalize(pendingEntry.payload)
      toast.success(resolveMessage(options.successMessage, pendingEntry, `Đã xóa "${pendingEntry.label}"`))
      await options.onFinalizeSuccess?.(pendingEntry.payload)
    } catch (error) {
      if (error instanceof Error && isNotFoundError(error)) {
        toast.success(resolveMessage(options.alreadyDeletedMessage, pendingEntry, `"${pendingEntry.label}" đã được xóa trước đó`))
        await options.onFinalizeSuccess?.(pendingEntry.payload)
      } else {
        const resolvedError = error instanceof Error
          ? error
          : new Error('Đã xảy ra lỗi không xác định')

        options.onUndo?.(pendingEntry.payload)
        options.onFinalizeError?.(pendingEntry.payload, resolvedError)
        toast.error(options.errorTitle ?? 'Xóa dữ liệu thất bại', { description: resolvedError.message })
      }
    } finally {
      removePendingDelete(key)
    }
  }, [options, removePendingDelete])

  useEffect(() => {
    if (pendingDeletes.length === 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      const now = Date.now()
      setClockMs(now)

      const expiredKeys = pendingDeletesRef.current
        .filter((entry) => entry.status === 'pending' && entry.expiresAt <= now)
        .map((entry) => entry.key)

      for (const key of expiredKeys) {
        void finalizeDelete(key)
      }
    }, 100)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [finalizeDelete, pendingDeletes.length])

  const scheduleDelete = useCallback((params: ScheduleDeleteParams<TPayload>): boolean => {
    const existing = pendingDeletesRef.current.find((entry) => entry.key === params.key)
    if (existing) {
      toast.error(options.duplicateMessage ?? 'Mục này đang chờ xóa. Bạn có thể hoàn tác hoặc đợi xử lý xong.')
      return false
    }

    const createdAt = Date.now()
    const pendingEntry: DeferredDeleteEntry<TPayload> = {
      key: params.key,
      label: params.label,
      payload: params.payload,
      createdAt,
      expiresAt: createdAt + undoWindowMs,
      status: 'pending',
    }

    setPendingDeletes((previous) => [...previous, pendingEntry])
    return true
  }, [options, undoWindowMs])

  const undoDelete = useCallback((key: string) => {
    const pendingEntry = pendingDeletesRef.current.find((entry) => entry.key === key)
    if (!pendingEntry || pendingEntry.status !== 'pending') {
      return
    }

    options.onUndo?.(pendingEntry.payload)
    removePendingDelete(key)
    toast.success(`Đã hoàn tác xóa "${pendingEntry.label}"`)
  }, [options, removePendingDelete])

  const isQueued = useCallback((key: string) => (
    pendingDeletesRef.current.some((entry) => entry.key === key)
  ), [])

  return {
    pendingDeletes,
    clockMs,
    undoWindowMs,
    scheduleDelete,
    undoDelete,
    isQueued,
  }
}
